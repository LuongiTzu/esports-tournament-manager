import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(
        new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
});

const { API_BASE_URL, ApiError, request } =
  await import("../lib/api/client.ts");
const { tokenStore } = await import("../lib/api/token-store.ts");

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("API client sends auth and JSON headers and unwraps the backend response", async (t) => {
  tokenStore.accessToken = "access-token";
  t.after(() => tokenStore.clear());
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, `${API_BASE_URL}/tournaments`);
    assert.equal(options.credentials, "include");
    assert.equal(options.headers.get("Authorization"), "Bearer access-token");
    assert.equal(options.headers.get("Content-Type"), "application/json");
    return json(
      { statusCode: 201, message: "Created", data: { id: "t-1" } },
      201,
    );
  });

  assert.deepEqual(
    await request("/tournaments", {
      auth: true,
      method: "POST",
      body: JSON.stringify({ name: "Cup" }),
    }),
    { id: "t-1" },
  );
});

test("API client refreshes an expired token and retries with the new token", async (t) => {
  tokenStore.accessToken = "expired";
  t.after(() => tokenStore.clear());
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, auth: options.headers?.get("Authorization") });
    if (url.endsWith("/auth/refresh")) {
      assert.equal(options.credentials, "include");
      return json({
        statusCode: 200,
        message: "OK",
        data: { accessToken: "fresh" },
      });
    }
    if (options.headers.get("Authorization") === "Bearer expired") {
      return json({ message: "Unauthorized" }, 401);
    }
    return json({ statusCode: 200, message: "OK", data: { id: "own-data" } });
  });

  assert.deepEqual(await request("/users/me", { auth: true }), {
    id: "own-data",
  });
  assert.equal(tokenStore.accessToken, "fresh");
  assert.deepEqual(
    calls.map((call) => call.auth ?? "refresh"),
    ["Bearer expired", "refresh", "Bearer fresh"],
  );
});

test("concurrent unauthorized requests share one token refresh", async (t) => {
  tokenStore.accessToken = "expired";
  t.after(() => tokenStore.clear());
  let refreshCount = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("/auth/refresh")) {
      refreshCount++;
      return json({ accessToken: "fresh" });
    }
    return options.headers.get("Authorization") === "Bearer expired"
      ? json({ message: "Unauthorized" }, 401)
      : json({ statusCode: 200, message: "OK", data: { path: url } });
  });

  const results = await Promise.all([
    request("/first", { auth: true }),
    request("/second", { auth: true }),
  ]);
  assert.equal(refreshCount, 1);
  assert.deepEqual(
    results.map((result) => result.path),
    [`${API_BASE_URL}/first`, `${API_BASE_URL}/second`],
  );
});

test("failed token refresh clears the session and does not retry the request", async (t) => {
  tokenStore.accessToken = "expired";
  t.after(() => tokenStore.clear());
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(url);
    return json({ message: "Unauthorized" }, 401);
  });

  await assert.rejects(request("/users/me", { auth: true }), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 401);
    assert.match(error.message, /Phiên đăng nhập đã hết hạn/);
    return true;
  });
  assert.equal(tokenStore.accessToken, null);
  assert.equal(calls.length, 2);
});

test("forbidden and rate-limited responses expose their status without refreshing", async (t) => {
  tokenStore.accessToken = "valid";
  t.after(() => tokenStore.clear());
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return calls === 1
      ? json({ message: "Forbidden", code: "NOT_OWNER" }, 403)
      : json({ message: "Provider detail" }, 429);
  });

  await assert.rejects(request("/private", { auth: true }), (error) => {
    assert.equal(error.status, 403);
    assert.equal(error.code, "NOT_OWNER");
    return true;
  });
  await assert.rejects(request("/limited"), (error) => {
    assert.equal(error.status, 429);
    assert.match(error.message, /thao tác quá nhiều lần/);
    assert.doesNotMatch(error.message, /Provider detail/);
    return true;
  });
  assert.equal(calls, 2);
});

test("validation errors retain usable field and member details", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    json(
      {
        message: ["Tên không hợp lệ", "Thiếu thành viên"],
        code: "VALIDATION_ERROR",
        details: { field: "members" },
        errors: [
          { field: "members.0.ign", memberIndex: 0, message: "Bắt buộc" },
          { field: 42, memberIndex: 0, message: "Sai định dạng" },
        ],
      },
      400,
    ),
  );

  await assert.rejects(request("/teams", { method: "POST" }), (error) => {
    assert.equal(error.status, 400);
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.equal(error.message, "Tên không hợp lệ, Thiếu thành viên");
    assert.deepEqual(error.details, { field: "members" });
    assert.deepEqual(error.errors, [
      { field: "members.0.ign", memberIndex: 0, message: "Bắt buộc" },
    ]);
    return true;
  });
});

test("multipart requests leave Content-Type to the browser", async (t) => {
  const body = new FormData();
  body.set("file", new Blob(["image"]), "banner.png");
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.headers.has("Content-Type"), false);
    assert.equal(options.body, body);
    return json(
      { statusCode: 201, message: "Created", data: { id: "image" } },
      201,
    );
  });

  assert.deepEqual(await request("/uploads", { method: "POST", body }), {
    id: "image",
  });
});

test("network failures propagate instead of being mistaken for an API response", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Network unavailable");
  });
  await assert.rejects(request("/tournaments"), {
    name: "TypeError",
    message: "Network unavailable",
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { safeReturnTo } from "../features/auth/return-to.ts";

test("authentication return path accepts internal routes with query parameters", () => {
  assert.equal(
    safeReturnTo("/tournaments/cup/manage?section=teams"),
    "/tournaments/cup/manage?section=teams",
  );
});

test("authentication return path rejects external URLs and backslash redirects", () => {
  for (const value of [
    null,
    "",
    "https://evil.test",
    "//evil.test/path",
    "/\\evil.test/path",
  ]) {
    assert.equal(safeReturnTo(value), null, String(value));
  }
});

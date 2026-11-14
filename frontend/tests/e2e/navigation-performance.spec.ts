import { expect, test } from "@playwright/test";

test("discovery controls update the URL and results without a server navigation", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("etm-locale", "en");
  });
  await page.goto("/tournaments");
  const results = page.locator("#tournament-results");
  await expect(results).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("button", { name: "Grid view", exact: true })).toHaveAttribute("aria-pressed", "true");

  const serverNavigations: string[] = [];
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/tournaments" && (url.searchParams.has("_rsc") || request.isNavigationRequest())) {
      serverNavigations.push(url.href);
    }
    if (url.pathname === "/api/tournaments") apiRequests.push(url.href);
  });

  const listView = page.getByRole("button", { name: "List view", exact: true });
  await listView.click();
  await expect(listView).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/view=list/);
  await expect(results).toHaveAttribute("aria-busy", "false");
  expect(apiRequests).toEqual([]);

  const filteredResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/tournaments" && url.searchParams.get("status") === "ONGOING";
  });
  await page.locator("#tournament-status").selectOption("ONGOING");
  expect((await filteredResponse).ok()).toBeTruthy();
  await expect(results).toHaveAttribute("aria-busy", "false");
  await expect(page).toHaveURL(/status=ONGOING/);
  await expect(listView).toHaveAttribute("aria-pressed", "true");
  expect(serverNavigations).toEqual([]);

  // Filter URLs must continue to work when opened directly.
  await page.reload();
  await expect(page.locator("#tournament-status")).toHaveValue("ONGOING");
  await expect(listView).toHaveAttribute("aria-pressed", "true");
  await expect(results).toHaveAttribute("aria-busy", "false");
});

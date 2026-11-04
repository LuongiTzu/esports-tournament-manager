import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`navigation feedback survives slow responses on ${mobile ? "mobile" : "desktop"}`, async ({ page }) => {
    await page.setViewportSize(mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: mobile ? "reduce" : "no-preference" });
    await page.addInitScript((light) => {
      localStorage.setItem("etm-locale", "en");
      localStorage.setItem("etm-theme", light ? "light" : "dark");
    }, mobile);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // This navigation test needs no real account or database writes.
    await page.route("**/api/**", (route) => route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Not signed in" }),
    }));

    let releaseNavigation!: () => void;
    const responseGate = new Promise<void>((resolve) => { releaseNavigation = resolve; });
    await page.route("**/register**", async (route) => {
      if (route.request().headers().rsc) await responseGate;
      await route.continue();
    });

    try {
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      if (mobile) await page.getByRole("button", { name: "Open menu", exact: true }).click();
      await expect(page.getByRole("button", { name: "en", exact: true })).toHaveAttribute("aria-pressed", "true");
      const link = page.locator(mobile
        ? '#mobile-navigation a[href="/register"]'
        : 'main a[href="/register"]');
      await link.click();

      const indicator = page.locator('body > [role="status"]');
      await expect(indicator).toBeVisible();
      await expect(indicator).toHaveCSS("opacity", "1");
      await expect(indicator).toContainText("Loading");
      if (mobile) await expect(page.locator("#mobile-navigation")).toHaveCount(0);
      await page.screenshot({ path: test.info().outputPath("navigation-pending.png") });

      releaseNavigation();
      await expect(page).toHaveURL(/\/register$/);
      await expect(page.getByRole("heading", { name: "Create account", exact: true })).toBeVisible();
      await expect(indicator).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      releaseNavigation();
    }
  });
}

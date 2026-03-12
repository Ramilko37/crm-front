import { test, expect } from "@playwright/test";

test.describe("crm-front smoke", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("CRM Front")).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { createCredential, setAuthenticatedSession, clearAuthStorage } from "./support/auth";

/**
 * Dedicated FR-12 (local login gate) layer tests.
 *
 * NOTE: FR-12 is implemented in PR #5 but is not in requirements.md/
 * architecture.md as a formally approved requirement. We exercise the
 * behavior as implemented and described in PR#5 and PR-description.md.
 */

test.describe("FR-12 login gate (dedicated)", () => {
  test.beforeEach(async ( { page }) => {
    await clearAuthStorage(page);
  });

  test("default: login form visible, contact manager not visible", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("banner")).toBeVisible();

    // Login form
    await expect(page.getByTestId("login-form")).toBeVisible();

    // Contact manager is rendered only after auth
    await expect(page.getByTestId("contact-manager")).toHaveCount(0);
  });

  test("setup: creates credential and authenticates", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Username").fill("testuser");
    await page.getByLabel("Passcode").fill("123456");
    await page.getByRole("button", { name: "Set up" }).click();

    await expect(page.getByTestId("contact-manager")).toBeVisible();
    await expect(page.getByTestId("login-form")).toHaveCount(0);
  });

  test("login: valid credentials authenticate and show contact manager", async ({ page }) => {
    await page.goto("/");
    await createCredential(page, { username: "testuser", passcode: "123456" });

    await page.reload(); // get back to login screen for subsequent login
    await expect(page.getByTestId("login-form")).toBeVisible();

    await page.getByLabel("Username").fill("testuser");
    await page.getByLabel("Passcode").fill("123456");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByTestId("contact-manager")).toBeVisible();
  });

  test("login: invalid passcode shows generic error", async ({ page }) => {
    await page.goto("/");
    await createCredential(page, { username: "testuser", passcode: "123456" });
    await clearAuthStorage(page, { preserveCredential: true });

    await page.reload();

    await page.getByLabel("Username").fill("testuser");
    await page.getByLabel("Passcode").fill("000000");
    await page.getByRole("button", { name: "Log in" }).click();

    // App should stay on login view and display a generic error message
    await expect(page.getByTestId("login-form")).toBeVisible();
    await expect(page.getByText("invalid", { exact: false })).toBeVisible();
  });

  test("session: reload keeps auth but logout clears it", async ({ page }) => {
    await page.goto("/");
    await createCredential(page, { username: "testuser", passcode: "123456" });
    await setAuthenticatedSession(page);

    await page.reload();
    await expect(page.getByTestId("contact-manager")).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByTestId("login-form")).toBeVisible();
    await expect(page.getByTestId("contact-manager")).toHaveCount(0);
  });
});

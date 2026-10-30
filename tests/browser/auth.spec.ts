import { expect, test } from "@playwright/test";
import { AUTH_SESSION_KEY, AUTH_STORAGE_KEY, TEST_PASSCODE, TEST_USERNAME, signInForTest, testCredential } from "./support/auth";

const localOnlyDisclosureFragment = "local convenience gate for this browser profile only";

test("requires setup, then login, before any contact UI is reachable", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Set up your local sign-in" })).toBeVisible();
  await expect(page.getByText(localOnlyDisclosureFragment)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add contact" })).toHaveCount(0);
  await expect(page.getByRole("searchbox", { name: "Search by name or phone" })).toHaveCount(0);
  await expect(page.locator("#contact-list")).toHaveCount(0);

  await page.getByLabel("Username").fill(TEST_USERNAME);
  await page.getByLabel("Passcode").fill(TEST_PASSCODE);
  await page.getByRole("button", { name: "Create sign-in" }).click();

  await expect(page.getByRole("button", { name: "Add contact" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Set up your local sign-in" })).toHaveCount(0);

  const storedCredentialRaw = await page.evaluate((key) => localStorage.getItem(key), AUTH_STORAGE_KEY);
  expect(storedCredentialRaw).toBeTruthy();
  expect(storedCredentialRaw).not.toContain(TEST_PASSCODE);
  const storedCredential = JSON.parse(storedCredentialRaw!);
  expect(storedCredential).toMatchObject({ schemaVersion: 1, username: TEST_USERNAME, hashAlgorithm: "SHA-256" });
});

test("requires login (not setup) on a later visit once a credential exists", async ({ page }) => {
  await page.addInitScript(
    ({ key, credential }) => localStorage.setItem(key, JSON.stringify(credential)),
    { key: AUTH_STORAGE_KEY, credential: testCredential },
  );
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add contact" })).toHaveCount(0);
});

test("shows one generic error for a wrong username or passcode without revealing which field was wrong", async ({ page }) => {
  await page.addInitScript(
    ({ key, credential }) => localStorage.setItem(key, JSON.stringify(credential)),
    { key: AUTH_STORAGE_KEY, credential: testCredential },
  );
  await page.goto("/");

  await page.getByLabel("Username").fill(TEST_USERNAME);
  await page.getByLabel("Passcode").fill("wrong-passcode");
  await page.getByRole("button", { name: "Sign in" }).click();
  const wrongPasscodeError = page.getByRole("alert");
  await expect(wrongPasscodeError).toHaveText("Invalid username or passcode.");

  await page.getByLabel("Username").fill("not-" + TEST_USERNAME);
  await page.getByLabel("Passcode").fill(TEST_PASSCODE);
  await page.getByRole("button", { name: "Sign in" }).click();
  const wrongUsernameError = page.getByRole("alert");
  await expect(wrongUsernameError).toHaveText("Invalid username or passcode.");

  await expect(page.getByRole("button", { name: "Add contact" })).toHaveCount(0);

  await page.getByLabel("Username").fill(TEST_USERNAME);
  await page.getByLabel("Passcode").fill(TEST_PASSCODE);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Add contact" })).toBeVisible();
});

test("completes setup and login using keyboard input only", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "contactbook" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Username")).toBeFocused();
  await page.keyboard.type(TEST_USERNAME);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Passcode")).toBeFocused();
  await page.keyboard.type(TEST_PASSCODE);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("button", { name: "Add contact" })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "contactbook" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Username")).toBeFocused();
  await page.keyboard.type(TEST_USERNAME);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Passcode")).toBeFocused();
  await page.keyboard.type(TEST_PASSCODE);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("button", { name: "Add contact" })).toBeVisible();
});

test("logs out without deleting stored contacts or the credential, and persists session across a reload", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Add contact" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Grace Hopper");
  await page.getByLabel("Phone number", { exact: true }).fill("1234567");
  await page.getByRole("button", { name: "Save contact" }).click();
  await expect(page.getByRole("heading", { name: "Grace Hopper", level: 3 })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Grace Hopper", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Grace Hopper", level: 3 })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add contact" })).toHaveCount(0);

  const sessionValueAfterLogout = await page.evaluate((key) => sessionStorage.getItem(key), AUTH_SESSION_KEY);
  expect(sessionValueAfterLogout).toBeNull();
  const credentialAfterLogout = await page.evaluate((key) => localStorage.getItem(key), AUTH_STORAGE_KEY);
  expect(credentialAfterLogout).toBeTruthy();

  await page.getByLabel("Username").fill(TEST_USERNAME);
  await page.getByLabel("Passcode").fill(TEST_PASSCODE);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Grace Hopper", level: 3 })).toBeVisible();
});

test("requires re-prompting in a fresh tab session even with the same stored credential", async ({ page, context }) => {
  await signInForTest(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add contact" })).toBeVisible();

  const freshTabPage = await context.newPage();
  await freshTabPage.addInitScript(
    ({ key, credential }) => localStorage.setItem(key, JSON.stringify(credential)),
    { key: AUTH_STORAGE_KEY, credential: testCredential },
  );
  await freshTabPage.goto("/");

  await expect(freshTabPage.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await expect(freshTabPage.getByRole("button", { name: "Add contact" })).toHaveCount(0);
  await freshTabPage.close();
});

test("prevents duplicate UI mounting on rapid authentication state changes", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill(TEST_USERNAME);
  await page.getByLabel("Passcode").fill(TEST_PASSCODE);
  await page.getByRole("button", { name: "Create sign-in" }).click();
  await expect(page.getByRole("button", { name: "Add contact" })).toBeVisible();
  
  // Verify only one contact manager UI is mounted
  const contactLists = await page.locator("#contact-list").count();
  expect(contactLists).toBe(1);
  
  // Reload page to trigger authentication state change
  await page.reload();
  await expect(page.getByRole("button", { name: "Add contact" })).toBeVisible();
  
  // Still only one UI should be mounted
  const contactListsAfterReload = await page.locator("#contact-list").count();
  expect(contactListsAfterReload).toBe(1);
});

test("cleanly transitions between login and contact UIs on logout and re-login", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill(TEST_USERNAME);
  await page.getByLabel("Passcode").fill(TEST_PASSCODE);
  await page.getByRole("button", { name: "Create sign-in" }).click();
  await expect(page.getByRole("button", { name: "Add contact" })).toBeVisible();
  
  // Add a contact to verify it persists
  await page.getByRole("button", { name: "Add contact" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Test Contact");
  await page.getByLabel("Phone number", { exact: true }).fill("1234567");
  await page.getByRole("button", { name: "Save contact" }).click();
  await expect(page.getByRole("heading", { name: "Test Contact", level: 3 })).toBeVisible();
  
  // Verify contact UI elements are present
  expect(await page.locator("#contact-list").count()).toBe(1);
  
  // Logout
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  
  // Verify contact UI is completely removed
  expect(await page.locator("#contact-list").count()).toBe(0);
  expect(await page.getByRole("button", { name: "Add contact" }).count()).toBe(0);
  
  // Re-login
  await page.getByLabel("Username").fill(TEST_USERNAME);
  await page.getByLabel("Passcode").fill(TEST_PASSCODE);
  await page.getByRole("button", { name: "Sign in" }).click();
  
  // Verify contact UI is re-mounted and contact persists
  await expect(page.getByRole("heading", { name: "Test Contact", level: 3 })).toBeVisible();
  expect(await page.locator("#contact-list").count()).toBe(1);
});

test("handles multiple rapid logout and login cycles without UI duplication", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill(TEST_USERNAME);
  await page.getByLabel("Passcode").fill(TEST_PASSCODE);
  await page.getByRole("button", { name: "Create sign-in" }).click();
  await expect(page.getByRole("button", { name: "Add contact" })).toBeVisible();
  
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
    expect(await page.locator("#contact-list").count()).toBe(0);
    
    await page.getByLabel("Username").fill(TEST_USERNAME);
    await page.getByLabel("Passcode").fill(TEST_PASSCODE);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("button", { name: "Add contact" })).toBeVisible();
    expect(await page.locator("#contact-list").count()).toBe(1);
  }
});

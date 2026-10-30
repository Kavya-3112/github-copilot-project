import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";

export const AUTH_STORAGE_KEY = "contact-management:auth:v1";
export const AUTH_SESSION_KEY = "contact-management:auth:session:v1";

export const TEST_USERNAME = "ada";
export const TEST_PASSCODE = "correct-passcode";

const TEST_SALT = "test-salt-fixture-0123456789abcdef";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export const testCredential = {
  schemaVersion: 1,
  username: TEST_USERNAME,
  salt: TEST_SALT,
  passwordHash: sha256Hex(`${TEST_SALT}:${TEST_PASSCODE}`),
  hashAlgorithm: "SHA-256",
};

/**
 * Pre-seeds a valid stored credential and an authenticated session flag
 * before the page loads, so tests that exercise contact behavior do not
 * need to walk through the login UI on every run. Auth-specific behavior
 * (setup, login, logout, re-prompting) is covered separately in
 * auth.spec.ts without this bypass.
 */
export async function signInForTest(page: Page): Promise<void> {
  await page.addInitScript(
    ({ authKey, sessionKey, credential, sessionValue }) => {
      localStorage.setItem(authKey, JSON.stringify(credential));
      sessionStorage.setItem(sessionKey, sessionValue);
    },
    {
      authKey: AUTH_STORAGE_KEY,
      sessionKey: AUTH_SESSION_KEY,
      credential: testCredential,
      sessionValue: "authenticated",
    },
  );
}

/**
 * Creates a test credential by performing the setup flow in the browser.
 * Used by tests that need to verify login behavior after setup has occurred.
 */
export async function createCredential(
  page: Page,
  { username, passcode }: { username: string; passcode: string }
): Promise<void> {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Passcode").fill(passcode);
  await page.getByRole("button", { name: /Set up|Create sign-in/i }).click();
  // Wait for authentication to complete
  await page.waitForTimeout(100);
}

/**
 * Sets an authenticated session flag in sessionStorage without going through
 * the login flow. Requires a valid credential to already exist in localStorage.
 */
export async function setAuthenticatedSession(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => sessionStorage.setItem(key, value),
    { key: AUTH_SESSION_KEY, value: "authenticated" }
  );
}

/**
 * Clears authentication storage. By default clears both credential and session.
 * Pass { preserveCredential: true } to clear only the session flag.
 */
export async function clearAuthStorage(
  page: Page,
  options: { preserveCredential?: boolean } = {}
): Promise<void> {
  await page.addInitScript(
    ({ authKey, sessionKey, preserveCredential }) => {
      if (!preserveCredential) {
        localStorage.removeItem(authKey);
      }
      sessionStorage.removeItem(sessionKey);
    },
    {
      authKey: AUTH_STORAGE_KEY,
      sessionKey: AUTH_SESSION_KEY,
      preserveCredential: options.preserveCredential ?? false,
    }
  );
}

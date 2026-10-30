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

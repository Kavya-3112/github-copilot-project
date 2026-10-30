import { HASH_ALGORITHM } from "./types";

/**
 * Checks whether the Web Crypto API and SubtleCrypto are available in the
 * current environment. Returns true if crypto operations can proceed safely.
 */
export function isCryptoAvailable(): boolean {
  return typeof globalThis.crypto !== "undefined"
    && typeof globalThis.crypto.getRandomValues === "function"
    && typeof globalThis.crypto.subtle !== "undefined"
    && typeof globalThis.crypto.subtle.digest === "function";
}

/**
 * Generates a random per-setup salt as a hex string. The salt is not secret;
 * it only needs to be unique per credential so identical passcodes do not
 * produce identical stored hashes.
 */
export function generateSalt(byteLength = 16): string {
  if (!isCryptoAvailable()) {
    throw new Error("Cryptographic functionality is unavailable in this environment.");
  }
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/**
 * Hashes a passcode with its salt using the Web Crypto SubtleCrypto digest
 * API. The passcode is never stored or logged in plaintext; only this
 * digest is persisted.
 */
export async function hashPasscode(passcode: string, salt: string): Promise<string> {
  if (!isCryptoAvailable()) {
    throw new Error("Cryptographic functionality is unavailable in this environment.");
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${passcode}`);
  const digest = await globalThis.crypto.subtle.digest(HASH_ALGORITHM, data);
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

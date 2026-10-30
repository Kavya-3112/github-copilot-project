import { describe, expect, it, vi } from "vitest";
import { generateSalt, hashPasscode, isCryptoAvailable } from "../../src/auth/crypto";

describe("auth crypto", () => {
  it("produces the same hash for the same passcode and salt", async () => {
    const salt = generateSalt();
    const first = await hashPasscode("correct-passcode", salt);
    const second = await hashPasscode("correct-passcode", salt);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a different hash for an incorrect passcode with the same salt", async () => {
    const salt = generateSalt();
    const correct = await hashPasscode("correct-passcode", salt);
    const incorrect = await hashPasscode("wrong-passcode", salt);
    expect(incorrect).not.toBe(correct);
  });

  it("produces a different hash for the same passcode with a different salt", async () => {
    const saltA = generateSalt();
    const saltB = generateSalt();
    expect(saltA).not.toBe(saltB);
    const hashA = await hashPasscode("same-passcode", saltA);
    const hashB = await hashPasscode("same-passcode", saltB);
    expect(hashA).not.toBe(hashB);
  });

  it("never stores or returns the plaintext passcode itself", async () => {
    const salt = generateSalt();
    const passcode = "never-store-this-plaintext";
    const hash = await hashPasscode(passcode, salt);
    expect(hash).not.toContain(passcode);
    expect(hash.includes(passcode)).toBe(false);
  });

  it("rejects a tampered stored hash when verifying a correct passcode", async () => {
    const salt = generateSalt();
    const storedHash = await hashPasscode("correct-passcode", salt);
    const tamperedHash = `${storedHash.slice(0, -1)}${storedHash.endsWith("0") ? "1" : "0"}`;

    const freshlyComputedHash = await hashPasscode("correct-passcode", salt);
    expect(freshlyComputedHash).toBe(storedHash);
    expect(freshlyComputedHash).not.toBe(tamperedHash);
  });

  it("generates salts of the requested byte length as hex", () => {
    const salt = generateSalt(16);
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    const longerSalt = generateSalt(32);
    expect(longerSalt).toMatch(/^[0-9a-f]{64}$/);
  });

  it("checks crypto availability and returns true when available", () => {
    expect(isCryptoAvailable()).toBe(true);
  });

  // FIND-003 FIX: Use vi.stubGlobal instead of delete for test isolation
  it("throws an error when attempting to generate salt without crypto", () => {
    vi.stubGlobal("crypto", undefined);
    try {
      expect(isCryptoAvailable()).toBe(false);
      expect(() => generateSalt()).toThrow("Cryptographic functionality is unavailable");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  // FIND-003 FIX: Use vi.stubGlobal instead of delete for test isolation
  it("throws an error when attempting to hash passcode without crypto", async () => {
    vi.stubGlobal("crypto", undefined);
    try {
      expect(isCryptoAvailable()).toBe(false);
      await expect(hashPasscode("test-passcode", "test-salt")).rejects.toThrow("Cryptographic functionality is unavailable");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

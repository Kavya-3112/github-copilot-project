import { beforeEach, describe, expect, it } from "vitest";
import {
  AUTH_STORAGE_KEY,
  CredentialRepository,
  type CredentialStoragePort,
} from "../../src/auth/credential-repository";
import { AUTH_SESSION_KEY, type SessionPort } from "../../src/auth/session";
import { AuthState, isContactAccessAuthorized } from "../../src/auth/auth-state";

class MemoryStorage implements CredentialStoragePort, SessionPort {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("auth state", () => {
  let localValues: MemoryStorage;
  let sessionValues: MemoryStorage;

  beforeEach(() => {
    localValues = new MemoryStorage();
    sessionValues = new MemoryStorage();
  });

  function createState(): AuthState {
    return new AuthState(new CredentialRepository(localValues), sessionValues);
  }

  it("requires first-use setup when no credential is stored", () => {
    const state = createState();
    state.load();
    expect(state.snapshot).toEqual({ status: "needs-setup", username: null, error: null });
  });

  it("completes first-use setup, stores only a salted hash, and authenticates the session", async () => {
    const state = createState();
    state.load();

    const result = await state.setup("ada", "correct-passcode");
    expect(result).toEqual({ kind: "authenticated" });
    expect(state.snapshot).toEqual({ status: "authenticated", username: "ada", error: null });

    const storedRaw = localValues.getItem(AUTH_STORAGE_KEY);
    expect(storedRaw).toBeTruthy();
    expect(storedRaw).not.toContain("correct-passcode");
    const stored = JSON.parse(storedRaw!);
    expect(stored).toMatchObject({ schemaVersion: 1, username: "ada", hashAlgorithm: "SHA-256" });
    expect(typeof stored.salt).toBe("string");
    expect(stored.salt.length).toBeGreaterThan(0);
    expect(typeof stored.passwordHash).toBe("string");
    expect(stored.passwordHash).not.toBe("correct-passcode");

    expect(sessionValues.getItem(AUTH_SESSION_KEY)).toBe("authenticated");
  });

  it("rejects setup with missing fields without touching storage", async () => {
    const state = createState();
    state.load();

    expect(await state.setup("", "")).toMatchObject({
      kind: "invalid",
      errors: { username: expect.any(String), passcode: expect.any(String) },
    });
    expect(localValues.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(state.snapshot.status).toBe("needs-setup");
  });

  it("requires login (not setup) on a later load once a credential exists, independent of session state", async () => {
    const setupState = createState();
    setupState.load();
    await setupState.setup("ada", "correct-passcode");

    const reopenedState = new AuthState(new CredentialRepository(localValues), new MemoryStorage());
    reopenedState.load();
    expect(reopenedState.snapshot).toEqual({ status: "needs-login", username: null, error: null });
  });

  it("authenticates a correct login and rejects an incorrect username or passcode with one generic message", async () => {
    const setupState = createState();
    setupState.load();
    await setupState.setup("ada", "correct-passcode");

    const loginState = new AuthState(new CredentialRepository(localValues), new MemoryStorage());
    loginState.load();
    expect(loginState.snapshot.status).toBe("needs-login");

    const wrongPasscode = await loginState.login("ada", "wrong-passcode");
    expect(wrongPasscode).toEqual({ kind: "failed", reason: "Invalid username or passcode." });
    expect(loginState.snapshot).toMatchObject({ status: "needs-login", error: "Invalid username or passcode." });

    const wrongUsername = await loginState.login("not-ada", "correct-passcode");
    expect(wrongUsername).toEqual({ kind: "failed", reason: "Invalid username or passcode." });
    expect(wrongUsername).toEqual(wrongPasscode);

    const success = await loginState.login("ada", "correct-passcode");
    expect(success).toEqual({ kind: "authenticated" });
    expect(loginState.snapshot).toEqual({ status: "authenticated", username: "ada", error: null });
  });

  it("rejects login against a tampered stored hash even with the correct passcode", async () => {
    const setupState = createState();
    setupState.load();
    await setupState.setup("ada", "correct-passcode");

    const stored = JSON.parse(localValues.getItem(AUTH_STORAGE_KEY)!);
    const tamperedHash = stored.passwordHash.slice(0, -1) + (stored.passwordHash.endsWith("0") ? "1" : "0");
    localValues.setItem(AUTH_STORAGE_KEY, JSON.stringify({ ...stored, passwordHash: tamperedHash }));

    const loginState = new AuthState(new CredentialRepository(localValues), new MemoryStorage());
    loginState.load();
    const result = await loginState.login("ada", "correct-passcode");
    expect(result).toEqual({ kind: "failed", reason: "Invalid username or passcode." });
  });

  it("logs out by clearing only the session flag, leaving the credential in place", async () => {
    const state = createState();
    state.load();
    await state.setup("ada", "correct-passcode");
    expect(state.snapshot.status).toBe("authenticated");

    state.logout();
    expect(state.snapshot).toEqual({ status: "needs-login", username: null, error: null });
    expect(sessionValues.getItem(AUTH_SESSION_KEY)).toBeNull();
    expect(localValues.getItem(AUTH_STORAGE_KEY)).not.toBeNull();

    const result = await state.login("ada", "correct-passcode");
    expect(result).toEqual({ kind: "authenticated" });
  });

  it("re-requires login after reopening with the same stored credential but no session flag", async () => {
    const state = createState();
    state.load();
    await state.setup("ada", "correct-passcode");

    const reopenedAfterBrowserClose = new AuthState(new CredentialRepository(localValues), new MemoryStorage());
    reopenedAfterBrowserClose.load();
    expect(reopenedAfterBrowserClose.snapshot.status).toBe("needs-login");
  });

  it("resumes an authenticated session within the same session storage (e.g. a reload)", async () => {
    const state = createState();
    state.load();
    await state.setup("ada", "correct-passcode");

    const reloadedState = new AuthState(new CredentialRepository(localValues), sessionValues);
    reloadedState.load();
    expect(reloadedState.snapshot).toEqual({ status: "authenticated", username: "ada", error: null });
  });

  it("reports an unavailable status without exposing a raw storage exception", () => {
    const throwingStorage: CredentialStoragePort = {
      getItem: () => {
        throw new Error("Private detail: should not leak");
      },
      setItem: () => undefined,
    };
    const state = new AuthState(new CredentialRepository(throwingStorage), new MemoryStorage());
    state.load();
    expect(state.snapshot.status).toBe("unavailable");
    expect(state.snapshot.error).not.toContain("Private detail");
  });

  it("gates contact access: only an authenticated snapshot authorizes exposing contact data or operations", async () => {
    const state = createState();
    state.load();
    expect(isContactAccessAuthorized(state.snapshot)).toBe(false);

    await state.setup("ada", "correct-passcode");
    expect(isContactAccessAuthorized(state.snapshot)).toBe(true);

    state.logout();
    expect(isContactAccessAuthorized(state.snapshot)).toBe(false);

    await state.login("ada", "wrong-passcode");
    expect(isContactAccessAuthorized(state.snapshot)).toBe(false);

    await state.login("ada", "correct-passcode");
    expect(isContactAccessAuthorized(state.snapshot)).toBe(true);
  });

  it("rejects setup with whitespace-only username", async () => {
    const state = createState();
    state.load();

    const result = await state.setup("   ", "valid-passcode");
    expect(result).toMatchObject({
      kind: "invalid",
      errors: { username: expect.any(String) },
    });
    expect(localValues.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(state.snapshot.status).toBe("needs-setup");
  });

  it("rejects setup with whitespace-only passcode", async () => {
    const state = createState();
    state.load();

    const result = await state.setup("valid-username", "   ");
    expect(result).toMatchObject({
      kind: "invalid",
      errors: { passcode: expect.any(String) },
    });
    expect(localValues.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(state.snapshot.status).toBe("needs-setup");
  });

  it("trims leading and trailing whitespace from username during setup", async () => {
    const state = createState();
    state.load();

    const result = await state.setup("  ada  ", "correct-passcode");
    expect(result).toEqual({ kind: "authenticated" });
    expect(state.snapshot).toEqual({ status: "authenticated", username: "ada", error: null });

    const storedRaw = localValues.getItem(AUTH_STORAGE_KEY);
    const stored = JSON.parse(storedRaw!);
    expect(stored.username).toBe("ada");
  });

  it("trims username during login to match stored trimmed username", async () => {
    const setupState = createState();
    setupState.load();
    await setupState.setup("ada", "correct-passcode");

    const loginState = new AuthState(new CredentialRepository(localValues), new MemoryStorage());
    loginState.load();

    const result = await loginState.login("  ada  ", "correct-passcode");
    expect(result).toEqual({ kind: "authenticated" });
    expect(loginState.snapshot).toEqual({ status: "authenticated", username: "ada", error: null });
  });

  it("rejects login with whitespace-only username even if credential exists", async () => {
    const setupState = createState();
    setupState.load();
    await setupState.setup("ada", "correct-passcode");

    const loginState = new AuthState(new CredentialRepository(localValues), new MemoryStorage());
    loginState.load();

    const result = await loginState.login("   ", "correct-passcode");
    expect(result).toEqual({ kind: "failed", reason: "Invalid username or passcode." });
  });
});

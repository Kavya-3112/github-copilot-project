import { generateSalt, hashPasscode } from "./crypto";
import type { CredentialRepository } from "./credential-repository";
import { AUTH_SESSION_KEY, type SessionPort } from "./session";
import { HASH_ALGORITHM, type CredentialFieldErrors, type StoredCredentialV1 } from "./types";

const SESSION_AUTHENTICATED_VALUE = "authenticated";
const GENERIC_LOGIN_ERROR = "Invalid username or passcode.";

export type AuthStatus = "loading" | "needs-setup" | "needs-login" | "authenticated" | "unavailable";

export type AuthSnapshot = {
  status: AuthStatus;
  username: string | null;
  error: string | null;
};

export type AuthActionResult =
  | { kind: "authenticated" }
  | { kind: "invalid"; errors: CredentialFieldErrors }
  | { kind: "failed"; reason: string };

export type AuthStateRepository = Pick<CredentialRepository, "load" | "save">;

/**
 * Determines whether contact data and operations may be exposed to the UI.
 * Only an authenticated snapshot authorizes rendering contact data/controls.
 */
export function isContactAccessAuthorized(snapshot: Pick<AuthSnapshot, "status">): boolean {
  return snapshot.status === "authenticated";
}

export class AuthState {
  private current: AuthSnapshot = { status: "loading", username: null, error: null };
  private readonly listeners = new Set<(snapshot: AuthSnapshot) => void>();
  private credential: StoredCredentialV1 | null = null;

  constructor(
    private readonly repository: AuthStateRepository,
    private readonly session: SessionPort,
  ) {}

  get snapshot(): AuthSnapshot {
    return { ...this.current };
  }

  subscribe(listener: (snapshot: AuthSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  load(): void {
    this.current = { status: "loading", username: null, error: null };
    this.notify();

    const result = this.repository.load();
    if (result.kind === "failed") {
      this.credential = null;
      this.current = { status: "unavailable", username: null, error: result.reason };
      this.notify();
      return;
    }

    if (result.kind === "none") {
      this.credential = null;
      this.current = { status: "needs-setup", username: null, error: null };
      this.notify();
      return;
    }

    this.credential = result.credential;
    let sessionValue: string | null;
    try {
      sessionValue = this.session.getItem(AUTH_SESSION_KEY);
    } catch {
      sessionValue = null;
    }

    this.current = sessionValue === SESSION_AUTHENTICATED_VALUE
      ? { status: "authenticated", username: result.credential.username, error: null }
      : { status: "needs-login", username: null, error: null };
    this.notify();
  }

  async setup(username: unknown, passcode: unknown): Promise<AuthActionResult> {
    if (this.current.status !== "needs-setup") {
      return { kind: "failed", reason: "Setup is not available." };
    }

    const errors: CredentialFieldErrors = {};
    if (typeof username !== "string" || username.length === 0) errors.username = "Enter a username.";
    if (typeof passcode !== "string" || passcode.length === 0) errors.passcode = "Enter a passcode.";
    if (Object.keys(errors).length > 0) return { kind: "invalid", errors };

    const trimmedUsername = username as string;
    const enteredPasscode = passcode as string;
    const salt = generateSalt();
    const passwordHash = await hashPasscode(enteredPasscode, salt);
    const credential: StoredCredentialV1 = {
      schemaVersion: 1,
      username: trimmedUsername,
      salt,
      passwordHash,
      hashAlgorithm: HASH_ALGORITHM,
    };

    const saveResult = this.repository.save(credential);
    if (saveResult.kind === "failed") {
      this.current = { ...this.current, error: saveResult.reason };
      this.notify();
      return { kind: "failed", reason: saveResult.reason };
    }

    this.credential = credential;
    this.setSessionFlag();
    this.current = { status: "authenticated", username: credential.username, error: null };
    this.notify();
    return { kind: "authenticated" };
  }

  async login(username: unknown, passcode: unknown): Promise<AuthActionResult> {
    if (this.current.status !== "needs-login" || !this.credential) {
      return { kind: "failed", reason: "Sign-in is not available." };
    }

    const candidateUsername = typeof username === "string" ? username : "";
    const candidatePasscode = typeof passcode === "string" ? passcode : "";
    const candidateHash = await hashPasscode(candidatePasscode, this.credential.salt);
    const matches = candidateUsername === this.credential.username
      && candidateHash === this.credential.passwordHash;

    if (!matches) {
      this.current = { ...this.current, error: GENERIC_LOGIN_ERROR };
      this.notify();
      return { kind: "failed", reason: GENERIC_LOGIN_ERROR };
    }

    this.setSessionFlag();
    this.current = { status: "authenticated", username: this.credential.username, error: null };
    this.notify();
    return { kind: "authenticated" };
  }

  logout(): void {
    if (this.current.status !== "authenticated") return;
    try {
      this.session.removeItem(AUTH_SESSION_KEY);
    } catch {
      // Session storage may be unavailable; the in-memory state still ends
      // the authenticated session for this render.
    }
    this.current = { status: "needs-login", username: null, error: null };
    this.notify();
  }

  private setSessionFlag(): void {
    try {
      this.session.setItem(AUTH_SESSION_KEY, SESSION_AUTHENTICATED_VALUE);
    } catch {
      // Session persistence is best-effort; authentication for this render
      // still succeeds in memory even if the flag cannot be written.
    }
  }

  private notify(): void {
    const snapshot = this.snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }
}

import { HASH_ALGORITHM, type StoredCredentialV1 } from "./types";

export const AUTH_STORAGE_KEY = "contact-management:auth:v1";

export interface CredentialStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createBrowserCredentialStoragePort(): CredentialStoragePort {
  return {
    getItem(key) {
      return globalThis.localStorage.getItem(key);
    },
    setItem(key, value) {
      globalThis.localStorage.setItem(key, value);
    },
  };
}

export type LoadCredentialResult =
  | { kind: "none" }
  | { kind: "found"; credential: StoredCredentialV1 }
  | { kind: "failed"; reason: string };

export type SaveCredentialResult =
  | { kind: "saved" }
  | { kind: "failed"; reason: string };

export class CredentialRepository {
  constructor(private readonly storage: CredentialStoragePort) {}

  load(): LoadCredentialResult {
    let raw: string | null;
    try {
      raw = this.storage.getItem(AUTH_STORAGE_KEY);
    } catch {
      return { kind: "failed", reason: "The saved sign-in could not be read from browser storage." };
    }

    if (raw === null) return { kind: "none" };

    const credential = parseCredential(raw);
    if (!credential) {
      return { kind: "failed", reason: "The saved sign-in could not be read from browser storage." };
    }
    return { kind: "found", credential };
  }

  save(credential: StoredCredentialV1): SaveCredentialResult {
    try {
      this.storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(credential));
      return { kind: "saved" };
    } catch {
      return { kind: "failed", reason: "The sign-in could not be saved to browser storage." };
    }
  }
}

function parseCredential(raw: string): StoredCredentialV1 | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Partial<Record<keyof StoredCredentialV1, unknown>>;

  if (
    candidate.schemaVersion === 1
    && typeof candidate.username === "string" && candidate.username.length > 0
    && typeof candidate.salt === "string" && candidate.salt.length > 0
    && typeof candidate.passwordHash === "string" && candidate.passwordHash.length > 0
    && candidate.hashAlgorithm === HASH_ALGORITHM
  ) {
    return {
      schemaVersion: 1,
      username: candidate.username,
      salt: candidate.salt,
      passwordHash: candidate.passwordHash,
      hashAlgorithm: HASH_ALGORITHM,
    };
  }
  return undefined;
}

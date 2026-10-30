export const HASH_ALGORITHM = "SHA-256" as const;

export type StoredCredentialV1 = {
  schemaVersion: 1;
  username: string;
  salt: string;
  passwordHash: string;
  hashAlgorithm: typeof HASH_ALGORITHM;
};

export type CredentialFieldErrors = Partial<Record<"username" | "passcode", string>>;

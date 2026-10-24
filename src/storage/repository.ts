import type { StoredContactsV1 } from "../contacts/types";
import { createRecoveredDocument, parseStoredDocument, validateStoredDocument } from "./schema";

export const CONTACTS_STORAGE_KEY = "contact-management:contacts:v1";
const BACKUP_KEY_PREFIX = `${CONTACTS_STORAGE_KEY}:recovery-backup:`;

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createBrowserStoragePort(): StoragePort {
  return {
    getItem(key) {
      return globalThis.localStorage.getItem(key);
    },
    setItem(key, value) {
      globalThis.localStorage.setItem(key, value);
    },
  };
}

export type LoadResult =
  | { kind: "empty" }
  | { kind: "loaded"; document: StoredContactsV1 }
  | { kind: "unreadable"; reason: string; recoveryId: string; salvageCount: number }
  | { kind: "failed"; stage: "read"; reason: string };

export type SaveResult =
  | { kind: "saved" }
  | { kind: "failed"; stage: "state" | "validation" | "write"; reason: string };

export type RecoveryResult =
  | { kind: "confirmation-required" }
  | { kind: "recovered"; document: StoredContactsV1; backupKey: string }
  | { kind: "blocked"; stage: "candidate" | "primary-read" | "backup-key" | "backup-write" | "backup-read" | "backup-mismatch"; reason: string; backupKey?: string }
  | { kind: "retryable-failure"; stage: "primary-write"; reason: string; backupKey: string };

type RecoveryCandidate = {
  originalRaw: string;
  document: StoredContactsV1;
};

export type RepositoryOptions = {
  createRecoveryId?: () => string;
  createBackupSuffix?: (attempt: number) => string;
};

export class ContactRepository {
  private readonly recoveryCandidates = new Map<string, RecoveryCandidate>();
  private readonly createRecoveryId: () => string;
  private readonly createBackupSuffix: (attempt: number) => string;
  private canSave = false;

  constructor(
    private readonly storage: StoragePort,
    options: RepositoryOptions = {},
  ) {
    this.createRecoveryId = options.createRecoveryId ?? (() => globalThis.crypto.randomUUID());
    this.createBackupSuffix = options.createBackupSuffix
      ?? ((attempt) => `${Date.now()}-${globalThis.crypto.randomUUID()}-${attempt}`);
  }

  async load(): Promise<LoadResult> {
    this.canSave = false;
    let raw: string | null;
    try {
      raw = this.storage.getItem(CONTACTS_STORAGE_KEY);
    } catch {
      return { kind: "failed", stage: "read", reason: "Contacts could not be read from browser storage." };
    }

    if (raw === null) {
      this.canSave = true;
      return { kind: "empty" };
    }

    const parsed = parseStoredDocument(raw);
    if (parsed.kind === "valid") {
      this.canSave = true;
      return { kind: "loaded", document: parsed.document };
    }

    let recoveryId: string;
    try {
      recoveryId = this.createRecoveryId();
    } catch {
      return { kind: "failed", stage: "read", reason: "A safe recovery session could not be created." };
    }
    if (!recoveryId || this.recoveryCandidates.has(recoveryId)) {
      return { kind: "failed", stage: "read", reason: "A safe recovery session could not be created." };
    }

    this.recoveryCandidates.set(recoveryId, {
      originalRaw: raw,
      document: createRecoveredDocument(parsed.salvagedContacts),
    });
    return {
      kind: "unreadable",
      reason: parsed.reason,
      recoveryId,
      salvageCount: parsed.salvagedContacts.length,
    };
  }

  async save(document: StoredContactsV1): Promise<SaveResult> {
    if (!this.canSave) {
      return { kind: "failed", stage: "state", reason: "Load or recover stored contacts before saving." };
    }

    const validation = validateStoredDocument(document);
    if (validation.kind !== "valid") {
      return { kind: "failed", stage: "validation", reason: validation.reason };
    }

    try {
      this.storage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(validation.document));
      return { kind: "saved" };
    } catch {
      return { kind: "failed", stage: "write", reason: "Contacts could not be saved to browser storage." };
    }
  }

  async recover(recoveryId: string, confirmed: boolean): Promise<RecoveryResult> {
    const candidate = this.recoveryCandidates.get(recoveryId);
    if (!candidate) {
      return { kind: "blocked", stage: "candidate", reason: "This recovery request is no longer available. Reload stored contacts to try again." };
    }
    if (!confirmed) return { kind: "confirmation-required" };

    let currentRaw: string | null;
    try {
      currentRaw = this.storage.getItem(CONTACTS_STORAGE_KEY);
    } catch {
      return { kind: "blocked", stage: "primary-read", reason: "The original contacts could not be verified; recovery is blocked." };
    }
    if (currentRaw !== candidate.originalRaw) {
      return { kind: "blocked", stage: "primary-read", reason: "Stored contacts changed since recovery was prepared; the original data was not replaced." };
    }

    const backup = this.findUnusedBackupKey();
    if (backup.kind === "blocked") return backup;

    try {
      this.storage.setItem(backup.key, candidate.originalRaw);
    } catch {
      return { kind: "blocked", stage: "backup-write", reason: "The original data could not be backed up; recovery is blocked.", backupKey: backup.key };
    }

    let backedUpRaw: string | null;
    try {
      backedUpRaw = this.storage.getItem(backup.key);
    } catch {
      return { kind: "blocked", stage: "backup-read", reason: "The backup could not be verified; the original data was not replaced.", backupKey: backup.key };
    }
    if (backedUpRaw !== candidate.originalRaw) {
      return { kind: "blocked", stage: "backup-mismatch", reason: "The backup did not match the original data; the original data was not replaced.", backupKey: backup.key };
    }

    try {
      this.storage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(candidate.document));
    } catch {
      return { kind: "retryable-failure", stage: "primary-write", reason: "The verified backup is preserved, but recovered contacts could not be written. Retry recovery.", backupKey: backup.key };
    }

    this.canSave = true;
    this.recoveryCandidates.delete(recoveryId);
    return { kind: "recovered", document: candidate.document, backupKey: backup.key };
  }

  private findUnusedBackupKey(): { kind: "key"; key: string } | Extract<RecoveryResult, { kind: "blocked" }> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      let suffix: string;
      try {
        suffix = this.createBackupSuffix(attempt);
      } catch {
        return { kind: "blocked", stage: "backup-key", reason: "A backup location could not be selected; recovery is blocked." };
      }
      if (!suffix) continue;

      const key = `${BACKUP_KEY_PREFIX}${suffix}`;
      try {
        if (this.storage.getItem(key) === null) return { kind: "key", key };
      } catch {
        return { kind: "blocked", stage: "backup-key", reason: "Backup storage could not be checked; recovery is blocked." };
      }
    }

    return { kind: "blocked", stage: "backup-key", reason: "No unused backup location is available; recovery is blocked." };
  }
}
import { beforeEach, describe, expect, it } from "vitest";
import {
  CONTACTS_STORAGE_KEY,
  ContactRepository,
  type StoragePort,
} from "../../src/storage/repository";
import type { StoredContactsV1 } from "../../src/contacts/types";

class MemoryStorage implements StoragePort {
  values = new Map<string, string>();
  failGet: (key: string) => boolean = () => false;
  failSet: (key: string) => boolean = () => false;
  overrideGet: (key: string, value: string | null) => string | null = (_key, value) => value;

  getItem(key: string): string | null {
    if (this.failGet(key)) throw new Error("simulated read failure");
    return this.overrideGet(key, this.values.get(key) ?? null);
  }

  setItem(key: string, value: string): void {
    if (this.failSet(key)) throw new Error("simulated write failure");
    this.values.set(key, value);
  }
}

const originalRaw = '{ "schemaVersion": 99, "contacts": [{"id":"kept","name":"Ada","phone":"1234567","createdOrder":4}], "opaque": true }';

describe("contact repository", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("loads empty and valid documents and refuses to load through read exceptions", async () => {
    const repository = new ContactRepository(storage);
    expect(await repository.load()).toEqual({ kind: "empty" });

    const document: StoredContactsV1 = { schemaVersion: 1, contacts: [], nextCreatedOrder: 1 };
    storage.values.set(CONTACTS_STORAGE_KEY, JSON.stringify(document));
    expect(await repository.load()).toEqual({ kind: "loaded", document });

    storage.failGet = (key) => key === CONTACTS_STORAGE_KEY;
    expect(await repository.load()).toMatchObject({ kind: "failed", stage: "read" });
  });

  it("reports ordinary save write exceptions without claiming success", async () => {
    const repository = new ContactRepository(storage);
    await repository.load();
    storage.failSet = (key) => key === CONTACTS_STORAGE_KEY;

    expect(await repository.save({ schemaVersion: 1, contacts: [], nextCreatedOrder: 1 })).toMatchObject({
      kind: "failed",
      stage: "write",
    });
    expect(storage.values.has(CONTACTS_STORAGE_KEY)).toBe(false);
  });

  it("returns actionable storage errors without exposing exception details", async () => {
    const privateDetails = "Private contact: Ada Example, +1 234 567 8901";
    const readFailure = new ContactRepository({
      getItem: () => { throw new Error(privateDetails); },
      setItem: () => undefined,
    });
    expect(await readFailure.load()).toEqual({
      kind: "failed",
      stage: "read",
      reason: "Contacts could not be read from browser storage.",
    });

    const writeFailure = new ContactRepository({
      getItem: () => null,
      setItem: () => { throw new Error(privateDetails); },
    });
    expect(await writeFailure.load()).toEqual({ kind: "empty" });
    const result = await writeFailure.save({ schemaVersion: 1, contacts: [], nextCreatedOrder: 1 });
    expect(result).toEqual({
      kind: "failed",
      stage: "write",
      reason: "Contacts could not be saved to browser storage.",
    });
    expect(JSON.stringify(result)).not.toContain(privateDetails);
  });

  it("keeps malformed and unsupported data untouched and salvages valid records only in memory", async () => {
    storage.values.set(CONTACTS_STORAGE_KEY, originalRaw);
    const repository = new ContactRepository(storage, { createRecoveryId: () => "recovery-1" });
    const loaded = await repository.load();
    expect(loaded).toMatchObject({ kind: "unreadable", salvageCount: 1, recoveryId: "recovery-1" });
    expect(storage.values.get(CONTACTS_STORAGE_KEY)).toBe(originalRaw);
    expect([...storage.values.keys()]).toEqual([CONTACTS_STORAGE_KEY]);
    expect(await repository.save({ schemaVersion: 1, contacts: [], nextCreatedOrder: 1 })).toMatchObject({ kind: "failed", stage: "state" });
  });

  it("does not replace the primary until explicit confirmation and preserves exact raw data in a verified backup", async () => {
    storage.values.set(CONTACTS_STORAGE_KEY, originalRaw);
    storage.values.set(`${CONTACTS_STORAGE_KEY}:recovery-backup:occupied`, "existing backup");
    const repository = new ContactRepository(storage, {
      createRecoveryId: () => "recovery-2",
      createBackupSuffix: (attempt) => attempt === 0 ? "occupied" : "free",
    });
    const loaded = await repository.load();
    if (loaded.kind !== "unreadable") throw new Error("expected unreadable data");

    expect(await repository.recover(loaded.recoveryId, false)).toEqual({ kind: "confirmation-required" });
    expect(storage.values.get(CONTACTS_STORAGE_KEY)).toBe(originalRaw);
    expect(storage.values.get(`${CONTACTS_STORAGE_KEY}:recovery-backup:occupied`)).toBe("existing backup");

    const recovered = await repository.recover(loaded.recoveryId, true);
    expect(recovered).toMatchObject({ kind: "recovered", backupKey: `${CONTACTS_STORAGE_KEY}:recovery-backup:free` });
    if (recovered.kind !== "recovered") return;
    expect(storage.values.get(recovered.backupKey)).toBe(originalRaw);
    expect(storage.values.get(CONTACTS_STORAGE_KEY)).toBe(JSON.stringify(recovered.document));
    expect(recovered.document.contacts).toEqual([{ id: "kept", name: "Ada", phone: "1234567", createdOrder: 4 }]);
    expect(recovered.document.nextCreatedOrder).toBe(5);
  });

  it("confirms empty recovery with the first-save counter and preserves the original", async () => {
    const emptyRecoveryRaw = '{"schemaVersion":99,"contacts":[{"id":"invalid","name":"Ada","phone":"letters","createdOrder":1}]}';
    storage.values.set(CONTACTS_STORAGE_KEY, emptyRecoveryRaw);
    const repository = new ContactRepository(storage, {
      createRecoveryId: () => "recovery-empty",
      createBackupSuffix: () => "empty",
    });
    const loaded = await repository.load();
    if (loaded.kind !== "unreadable") throw new Error("expected unreadable data");
    expect(loaded.salvageCount).toBe(0);

    const recovered = await repository.recover(loaded.recoveryId, true);

    expect(recovered).toMatchObject({
      kind: "recovered",
      document: { schemaVersion: 1, contacts: [], nextCreatedOrder: 0 },
      backupKey: `${CONTACTS_STORAGE_KEY}:recovery-backup:empty`,
    });
    if (recovered.kind !== "recovered") return;
    expect(storage.values.get(recovered.backupKey)).toBe(emptyRecoveryRaw);
    expect(storage.values.get(CONTACTS_STORAGE_KEY)).toBe(JSON.stringify(recovered.document));
  });

  it("blocks recovery without changing primary data when backup write, read, or verification fails", async () => {
    const scenarios = [
      { stage: "backup-write", configure: (store: MemoryStorage) => { store.failSet = (key) => key.includes(":recovery-backup:"); } },
      { stage: "backup-read", configure: (store: MemoryStorage) => { store.failGet = (key) => key.includes(":recovery-backup:") && store.values.has(key); } },
      { stage: "backup-mismatch", configure: (store: MemoryStorage) => { store.overrideGet = (key, value) => key.includes(":recovery-backup:") && store.values.has(key) ? "different" : value; } },
    ] as const;

    for (const scenario of scenarios) {
      const currentStorage = new MemoryStorage();
      currentStorage.values.set(CONTACTS_STORAGE_KEY, originalRaw);
      const repository = new ContactRepository(currentStorage, { createRecoveryId: () => scenario.stage });
      const loaded = await repository.load();
      if (loaded.kind !== "unreadable") throw new Error("expected unreadable data");
      scenario.configure(currentStorage);

      const result = await repository.recover(loaded.recoveryId, true);
      expect(result).toMatchObject({ kind: "blocked", stage: scenario.stage });
      expect(currentStorage.values.get(CONTACTS_STORAGE_KEY)).toBe(originalRaw);
    }
  });

  it("blocks when no unused backup key is available without overwriting a collision", async () => {
    storage.values.set(CONTACTS_STORAGE_KEY, originalRaw);
    const occupiedKey = `${CONTACTS_STORAGE_KEY}:recovery-backup:occupied`;
    storage.values.set(occupiedKey, "keep me");
    const repository = new ContactRepository(storage, {
      createRecoveryId: () => "recovery-collision",
      createBackupSuffix: () => "occupied",
    });
    const loaded = await repository.load();
    if (loaded.kind !== "unreadable") throw new Error("expected unreadable data");

    const result = await repository.recover(loaded.recoveryId, true);
    expect(result).toMatchObject({ kind: "blocked", stage: "backup-key" });
    expect(storage.values.get(occupiedKey)).toBe("keep me");
    expect(storage.values.get(CONTACTS_STORAGE_KEY)).toBe(originalRaw);
  });

  it("retains the verified original backup and returns retryable failure when primary replacement fails", async () => {
    storage.values.set(CONTACTS_STORAGE_KEY, originalRaw);
    const repository = new ContactRepository(storage, {
      createRecoveryId: () => "recovery-primary-failure",
      createBackupSuffix: () => "original",
    });
    const loaded = await repository.load();
    if (loaded.kind !== "unreadable") throw new Error("expected unreadable data");
    storage.failSet = (key) => key === CONTACTS_STORAGE_KEY;

    const result = await repository.recover(loaded.recoveryId, true);
    expect(result).toMatchObject({ kind: "retryable-failure", stage: "primary-write" });
    if (result.kind !== "retryable-failure") return;
    expect(storage.values.get(result.backupKey)).toBe(originalRaw);
    expect(storage.values.get(CONTACTS_STORAGE_KEY)).toBe(originalRaw);
  });

  it("does not overwrite a primary value that changed after the recovery candidate was loaded", async () => {
    storage.values.set(CONTACTS_STORAGE_KEY, originalRaw);
    const repository = new ContactRepository(storage, { createRecoveryId: () => "recovery-changed" });
    const loaded = await repository.load();
    if (loaded.kind !== "unreadable") throw new Error("expected unreadable data");
    storage.values.set(CONTACTS_STORAGE_KEY, "changed elsewhere");

    expect(await repository.recover(loaded.recoveryId, true)).toMatchObject({ kind: "blocked", stage: "primary-read" });
    expect(storage.values.get(CONTACTS_STORAGE_KEY)).toBe("changed elsewhere");
  });
});
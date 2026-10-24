import { beforeEach, describe, expect, it } from "vitest";
import {
  ContactState,
  installUnsavedChangesWarning,
} from "../../src/app/contact-state";
import {
  CONTACTS_STORAGE_KEY,
  ContactRepository,
  type StoragePort,
} from "../../src/storage/repository";
import type { Contact, StoredContactsV1 } from "../../src/contacts/types";

class MemoryStorage implements StoragePort {
  values = new Map<string, string>();
  failPrimaryWrites = false;
  writes = 0;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (key === CONTACTS_STORAGE_KEY) {
      this.writes += 1;
      if (this.failPrimaryWrites) throw new Error("simulated write failure");
    }
    this.values.set(key, value);
  }
}

const contact = (id: string, name: string, phone: string, createdOrder: number): Contact => ({
  id,
  name,
  phone,
  createdOrder,
});

function seed(storage: MemoryStorage, contacts: Contact[]): StoredContactsV1 {
  const document = {
    schemaVersion: 1 as const,
    contacts,
    nextCreatedOrder: Math.max(-1, ...contacts.map((item) => item.createdOrder)) + 1,
  };
  storage.values.set(CONTACTS_STORAGE_KEY, JSON.stringify(document));
  return document;
}

describe("contact application state", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  async function loadState(contacts: Contact[] = []) {
    seed(storage, contacts);
    const repository = new ContactRepository(storage);
    let nextId = 0;
    const state = new ContactState(repository, () => `new-${++nextId}`);
    await state.load();
    return state;
  }

  it("loads empty storage as ready and keeps unreadable storage blocked and untouched", async () => {
    const emptyState = new ContactState(new ContactRepository(storage));
    expect(await emptyState.load()).toEqual({ kind: "empty" });
    expect(emptyState.snapshot).toMatchObject({ loadStatus: "ready", document: { contacts: [] }, saveStatus: "saved" });

    const raw = "not a stored document";
    storage.values.set(CONTACTS_STORAGE_KEY, raw);
    const unreadableState = new ContactState(new ContactRepository(storage));
    expect(await unreadableState.load()).toMatchObject({ kind: "unreadable" });
    expect(unreadableState.snapshot.loadStatus).toBe("unreadable");
    expect(unreadableState.snapshot.document).toBeNull();
    expect(unreadableState.openCreate()).toEqual({ kind: "unavailable" });
    expect(storage.values.get(CONTACTS_STORAGE_KEY)).toBe(raw);
  });

  it("creates a contact and lists it before older contacts", async () => {
    const state = await loadState([contact("older", "Older", "1234567", 0)]);

    expect(state.openCreate()).toEqual({ kind: "ready" });
    expect(state.snapshot.form).toEqual({ mode: "create", draft: { name: "", phone: "" } });
    expect(await state.submitForm({ name: "Newer", phone: "+1 (234) 567-8901" })).toEqual({ kind: "saved" });
    expect(state.visibleContacts.map(({ id }) => id)).toEqual(["new-1", "older"]);
    expect(state.snapshot.persistedDocument?.contacts).toHaveLength(2);
  });

  it("prefills edits, cancels without mutation, rejects invalid input, and preserves position on save", async () => {
    const original = [contact("first", "First", "1234567", 0), contact("second", "Second", "7654321", 1)];
    const state = await loadState(original);

    expect(state.openEdit("first")).toEqual({ kind: "ready" });
    expect(state.snapshot.form).toEqual({ mode: "edit", contactId: "first", draft: { name: "First", phone: "1234567" } });
    state.cancelForm();
    expect(state.snapshot.document?.contacts).toEqual(original);

    state.openEdit("first");
    expect(await state.submitForm({ name: "Updated", phone: "123" })).toMatchObject({ kind: "invalid" });
    expect(state.snapshot.document?.contacts).toEqual(original);
    expect(storage.writes).toBe(0);

    state.openEdit("first");
    expect(await state.submitForm({ name: "Updated", phone: "1234567" })).toEqual({ kind: "saved" });
    expect(state.visibleContacts.map(({ id }) => id)).toEqual(["second", "first"]);
    expect(state.snapshot.document?.contacts.find(({ id }) => id === "first")).toEqual(contact("first", "Updated", "1234567", 0));
  });

  it("requires explicit delete confirmation, preserves cancelled deletion, and handles the last contact", async () => {
    const state = await loadState([contact("one", "One", "1234567", 0), contact("two", "Two", "7654321", 1)]);

    expect(state.requestDelete("one")).toEqual({ kind: "ready" });
    expect(state.snapshot.pendingDeleteId).toBe("one");
    state.cancelDelete();
    expect(state.snapshot.document?.contacts.map(({ id }) => id)).toEqual(["one", "two"]);
    expect(storage.writes).toBe(0);

    state.requestDelete("one");
    expect(await state.confirmDelete()).toEqual({ kind: "saved" });
    expect(state.snapshot.document?.contacts.map(({ id }) => id)).toEqual(["two"]);
    state.requestDelete("two");
    expect(await state.confirmDelete()).toEqual({ kind: "saved" });
    expect(state.visibleContacts).toEqual([]);
  });

  it("targets duplicate-phone contacts by ID for edits and deletion", async () => {
    const state = await loadState([
      contact("duplicate-a", "Ada", "+1 (234) 567-8901", 0),
      contact("duplicate-b", "Grace", "+1 (234) 567-8901", 1),
    ]);

    state.openEdit("duplicate-b");
    expect(await state.submitForm({ name: "Grace Hopper", phone: "+1 (234) 567-8901" })).toEqual({ kind: "saved" });
    state.requestDelete("duplicate-a");
    await state.confirmDelete();

    expect(state.snapshot.document?.contacts).toEqual([
      contact("duplicate-b", "Grace Hopper", "+1 (234) 567-8901", 1),
    ]);
  });

  it("derives live search, clear, and no-match results without storage writes", async () => {
    const state = await loadState([
      contact("ada", "Ada Lovelace", "+1 (234) 567-8901", 0),
      contact("grace", "Grace Hopper", "555-010-2020", 1),
    ]);
    const writesBeforeSearch = storage.writes;

    state.setQuery("aDa");
    expect(state.visibleContacts.map(({ id }) => id)).toEqual(["ada"]);
    state.setQuery("234 567");
    expect(state.visibleContacts.map(({ id }) => id)).toEqual(["ada"]);
    state.setQuery("no match");
    expect(state.visibleContacts).toEqual([]);
    state.setQuery("");
    expect(state.visibleContacts.map(({ id }) => id)).toEqual(["grace", "ada"]);
    expect(storage.writes).toBe(writesBeforeSearch);
  });

  it("keeps failed candidates visible, retries the full candidate, and discards to the last persisted document", async () => {
    const initial = [contact("saved", "Saved", "1234567", 0)];
    const state = await loadState(initial);
    storage.failPrimaryWrites = true;

    state.openCreate();
    expect(await state.submitForm({ name: "First pending", phone: "2345678" })).toMatchObject({ kind: "unsaved" });
    expect(state.snapshot.saveStatus).toBe("unsaved");
    expect(state.hasUnsavedChanges).toBe(true);
    expect(state.snapshot.document?.contacts.map(({ name }) => name)).toEqual(["Saved", "First pending"]);
    expect(state.snapshot.persistedDocument?.contacts).toEqual(initial);

    state.openCreate();
    await state.submitForm({ name: "Second pending", phone: "3456789" });
    storage.failPrimaryWrites = false;
    expect(await state.retrySave()).toEqual({ kind: "saved" });
    expect(JSON.parse(storage.values.get(CONTACTS_STORAGE_KEY)!).contacts.map((item: Contact) => item.name)).toEqual([
      "Saved",
      "First pending",
      "Second pending",
    ]);
    expect(state.hasUnsavedChanges).toBe(false);

    storage.failPrimaryWrites = true;
    state.openEdit("saved");
    await state.submitForm({ name: "Not persisted", phone: "1234567" });
    expect(state.snapshot.document?.contacts.find(({ id }) => id === "saved")?.name).toBe("Not persisted");
    expect(state.discardChanges()).toEqual({ kind: "saved" });
    expect(state.snapshot.document).toEqual(state.snapshot.persistedDocument);
    expect(state.snapshot.document?.contacts.find(({ id }) => id === "saved")?.name).toBe("Saved");
    expect(state.hasUnsavedChanges).toBe(false);
  });

  it("warns on page unload only while changes are unsaved", async () => {
    const state = await loadState();
    const target = new EventTarget();
    const uninstall = installUnsavedChangesWarning(state, target);
    const savedEvent = new Event("beforeunload", { cancelable: true });
    target.dispatchEvent(savedEvent);
    expect(savedEvent.defaultPrevented).toBe(false);

    storage.failPrimaryWrites = true;
    state.openCreate();
    await state.submitForm({ name: "Pending", phone: "1234567" });
    const unsavedEvent = new Event("beforeunload", { cancelable: true });
    target.dispatchEvent(unsavedEvent);
    expect(unsavedEvent.defaultPrevented).toBe(true);

    state.discardChanges();
    const discardedEvent = new Event("beforeunload", { cancelable: true });
    target.dispatchEvent(discardedEvent);
    expect(discardedEvent.defaultPrevented).toBe(false);
    uninstall();
  });
});
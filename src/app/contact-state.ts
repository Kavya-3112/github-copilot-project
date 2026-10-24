import {
  createContact,
  searchContacts,
  sortContactsNewestFirst,
  updateContact,
} from "../contacts/rules";
import type {
  Contact,
  ContactDraft,
  ContactFieldErrors,
  StoredContactsV1,
} from "../contacts/types";
import type {
  ContactRepository,
  LoadResult,
  SaveResult,
} from "../storage/repository";

export type ContactFormState =
  | { mode: "create"; draft: ContactDraft }
  | { mode: "edit"; contactId: string; draft: ContactDraft };

export type ContactStateSnapshot = {
  loadStatus: "loading" | "ready" | "unreadable" | "failed";
  document: StoredContactsV1 | null;
  persistedDocument: StoredContactsV1 | null;
  query: string;
  form: ContactFormState | null;
  pendingDeleteId: string | null;
  saveStatus: "idle" | "saved" | "saving" | "unsaved";
  error: string | null;
  recovery: Extract<LoadResult, { kind: "unreadable" }> | null;
};

export type ContactActionResult =
  | { kind: "ready" }
  | { kind: "saved" }
  | { kind: "unsaved"; reason: string }
  | { kind: "failed"; reason: string }
  | { kind: "invalid"; errors: ContactFieldErrors }
  | { kind: "not-found" }
  | { kind: "unavailable" }
  | { kind: "busy" }
  | { kind: "no-pending-delete" };

export type ContactStateRepository = Pick<ContactRepository, "load" | "save">;

function cloneDocument(document: StoredContactsV1 | null): StoredContactsV1 | null {
  if (!document) return null;
  return { ...document, contacts: document.contacts.map((contact) => ({ ...contact })) };
}

function emptyDocument(): StoredContactsV1 {
  return { schemaVersion: 1, contacts: [], nextCreatedOrder: 0 };
}

export class ContactState {
  private current: ContactStateSnapshot = {
    loadStatus: "loading",
    document: null,
    persistedDocument: null,
    query: "",
    form: null,
    pendingDeleteId: null,
    saveStatus: "idle",
    error: null,
    recovery: null,
  };
  private readonly listeners = new Set<(snapshot: ContactStateSnapshot) => void>();

  constructor(
    private readonly repository: ContactStateRepository,
    private readonly createId?: () => string,
  ) {}

  get snapshot(): ContactStateSnapshot {
    return {
      ...this.current,
      document: cloneDocument(this.current.document),
      persistedDocument: cloneDocument(this.current.persistedDocument),
      form: this.current.form
        ? { ...this.current.form, draft: { ...this.current.form.draft } }
        : null,
      recovery: this.current.recovery ? { ...this.current.recovery } : null,
    };
  }

  get hasUnsavedChanges(): boolean {
    return this.current.saveStatus === "unsaved" || this.current.saveStatus === "saving";
  }

  get visibleContacts(): Contact[] {
    const contacts = this.current.document?.contacts ?? [];
    return searchContacts(sortContactsNewestFirst(contacts), this.current.query);
  }

  subscribe(listener: (snapshot: ContactStateSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async load(): Promise<LoadResult> {
    if (this.current.saveStatus === "saving") return { kind: "failed", stage: "read", reason: "Contacts are currently being saved." };

    this.current = { ...this.current, loadStatus: "loading", error: null, recovery: null };
    this.notify();
    const result = await this.repository.load();
    if (result.kind === "empty" || result.kind === "loaded") {
      const document = result.kind === "empty" ? emptyDocument() : cloneDocument(result.document)!;
      this.current = {
        ...this.current,
        loadStatus: "ready",
        document,
        persistedDocument: cloneDocument(document),
        form: null,
        pendingDeleteId: null,
        saveStatus: "saved",
        error: null,
        recovery: null,
      };
    } else if (result.kind === "unreadable") {
      this.current = {
        ...this.current,
        loadStatus: "unreadable",
        document: null,
        persistedDocument: null,
        saveStatus: "idle",
        error: result.reason,
        recovery: result,
      };
    } else {
      this.current = {
        ...this.current,
        loadStatus: "failed",
        document: null,
        persistedDocument: null,
        saveStatus: "idle",
        error: result.reason,
      };
    }
    this.notify();
    return result;
  }

  openCreate(): ContactActionResult {
    if (!this.isReady()) return { kind: "unavailable" };
    if (this.current.saveStatus === "saving") return { kind: "busy" };
    this.current = {
      ...this.current,
      form: { mode: "create", draft: { name: "", phone: "" } },
    };
    this.notify();
    return { kind: "ready" };
  }

  openEdit(contactId: string): ContactActionResult {
    if (!this.isReady()) return { kind: "unavailable" };
    if (this.current.saveStatus === "saving") return { kind: "busy" };
    const contact = this.current.document!.contacts.find((item) => item.id === contactId);
    if (!contact) return { kind: "not-found" };
    this.current = {
      ...this.current,
      form: {
        mode: "edit",
        contactId,
        draft: { name: contact.name, phone: contact.phone },
      },
    };
    this.notify();
    return { kind: "ready" };
  }

  cancelForm(): void {
    this.current = { ...this.current, form: null };
    this.notify();
  }

  async submitForm(value: unknown): Promise<ContactActionResult> {
    if (!this.isReady() || !this.current.form) return { kind: "unavailable" };
    if (this.current.saveStatus === "saving") return { kind: "busy" };

    const form = this.current.form;
    const document = this.current.document!;
    if (form.mode === "create") {
      const result = createContact(document, value, this.createId);
      if (result.kind === "invalid") return result;
      if (result.kind === "failed") {
        const reason = result.reason;
        this.current = { ...this.current, error: reason };
        this.notify();
        return { kind: "failed", reason };
      }
      return this.saveCandidate(result.document, null);
    }

    const result = updateContact(document.contacts, form.contactId, value);
    if (result.kind !== "updated") return result;
    return this.saveCandidate({ ...document, contacts: result.contacts }, null);
  }

  setQuery(query: string): void {
    this.current = { ...this.current, query };
    this.notify();
  }

  requestDelete(contactId: string): ContactActionResult {
    if (!this.isReady()) return { kind: "unavailable" };
    if (this.current.saveStatus === "saving") return { kind: "busy" };
    if (!this.current.document!.contacts.some((contact) => contact.id === contactId)) return { kind: "not-found" };
    this.current = { ...this.current, pendingDeleteId: contactId };
    this.notify();
    return { kind: "ready" };
  }

  cancelDelete(): void {
    this.current = { ...this.current, pendingDeleteId: null };
    this.notify();
  }

  async confirmDelete(): Promise<ContactActionResult> {
    if (!this.isReady()) return { kind: "unavailable" };
    if (this.current.saveStatus === "saving") return { kind: "busy" };
    const contactId = this.current.pendingDeleteId;
    if (!contactId) return { kind: "no-pending-delete" };
    const document = this.current.document!;
    if (!document.contacts.some((contact) => contact.id === contactId)) return { kind: "not-found" };
    return this.saveCandidate({
      ...document,
      contacts: document.contacts.filter((contact) => contact.id !== contactId),
    }, null);
  }

  async retrySave(): Promise<ContactActionResult> {
    if (!this.isReady() || this.current.saveStatus !== "unsaved" || !this.current.document) {
      return { kind: "unavailable" };
    }
    return this.persistCandidate(this.current.document);
  }

  discardChanges(): ContactActionResult {
    if (!this.current.persistedDocument || this.current.saveStatus !== "unsaved") {
      return { kind: "unavailable" };
    }
    this.current = {
      ...this.current,
      document: cloneDocument(this.current.persistedDocument),
      form: null,
      pendingDeleteId: null,
      saveStatus: "saved",
      error: null,
    };
    this.notify();
    return { kind: "saved" };
  }

  private async saveCandidate(
    document: StoredContactsV1,
    form: ContactFormState | null,
  ): Promise<ContactActionResult> {
    this.current = {
      ...this.current,
      document: cloneDocument(document),
      form,
      pendingDeleteId: null,
      error: null,
    };
    this.notify();
    return this.persistCandidate(document);
  }

  private async persistCandidate(document: StoredContactsV1): Promise<ContactActionResult> {
    this.current = { ...this.current, saveStatus: "saving", error: null };
    this.notify();
    const result: SaveResult = await this.repository.save(cloneDocument(document)!);
    if (result.kind === "saved") {
      this.current = {
        ...this.current,
        document: cloneDocument(document),
        persistedDocument: cloneDocument(document),
        saveStatus: "saved",
        error: null,
      };
      this.notify();
      return { kind: "saved" };
    }

    this.current = {
      ...this.current,
      document: cloneDocument(document),
      saveStatus: "unsaved",
      error: result.reason,
    };
    this.notify();
    return { kind: "unsaved", reason: result.reason };
  }

  private isReady(): boolean {
    return this.current.loadStatus === "ready" && this.current.document !== null;
  }

  private notify(): void {
    const snapshot = this.snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }
}

export function installUnsavedChangesWarning(
  state: Pick<ContactState, "hasUnsavedChanges">,
  target: Pick<Window, "addEventListener" | "removeEventListener"> = window,
): () => void {
  const onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (!state.hasUnsavedChanges) return;
    event.preventDefault();
    event.returnValue = "";
  };

  target.addEventListener("beforeunload", onBeforeUnload);
  return () => target.removeEventListener("beforeunload", onBeforeUnload);
}
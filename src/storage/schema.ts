import { validateContactDraft } from "../contacts/rules";
import type { Contact, StoredContactsV1 } from "../contacts/types";

export type StoredDocumentValidation =
  | { kind: "valid"; document: StoredContactsV1 }
  | { kind: "invalid"; reason: string; salvagedContacts: Contact[] };

export function validateStoredDocument(value: unknown): StoredDocumentValidation {
  if (!isRecord(value)) return invalid("Stored contacts are not a valid document.", []);
  if (value.schemaVersion !== 1) return invalid("Stored contacts use an unsupported version.", salvageContacts(value.contacts));
  if (!Array.isArray(value.contacts)) return invalid("Stored contacts are not a valid document.", []);

  const contacts: Contact[] = [];
  const ids = new Set<string>();
  for (const candidate of value.contacts) {
    const contact = validateContact(candidate);
    if (!contact || ids.has(contact.id)) {
      return invalid("Stored contacts contain invalid or duplicate records.", salvageContacts(value.contacts));
    }
    ids.add(contact.id);
    contacts.push(contact);
  }

  const nextCreatedOrder = value.nextCreatedOrder;
  if (!isOrder(nextCreatedOrder) || contacts.some((contact) => contact.createdOrder >= nextCreatedOrder)) {
    return invalid("Stored contacts have invalid creation ordering.", contacts);
  }

  return {
    kind: "valid",
    document: { schemaVersion: 1, contacts, nextCreatedOrder },
  };
}

export function parseStoredDocument(raw: string): StoredDocumentValidation {
  try {
    return validateStoredDocument(JSON.parse(raw) as unknown);
  } catch {
    return invalid("Stored contacts could not be read.", []);
  }
}

export function createRecoveredDocument(contacts: readonly Contact[]): StoredContactsV1 {
  const maximumOrder = contacts.reduce((maximum, contact) => Math.max(maximum, contact.createdOrder), 0);
  return {
    schemaVersion: 1,
    contacts: [...contacts],
    nextCreatedOrder: contacts.length === 0 ? 0 : maximumOrder + 1,
  };
}

function validateContact(value: unknown): Contact | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0 || !isOrder(value.createdOrder) || value.createdOrder >= Number.MAX_SAFE_INTEGER) {
    return undefined;
  }

  const validation = validateContactDraft({ name: value.name, phone: value.phone });
  if (validation.kind !== "valid") return undefined;

  return {
    id: value.id,
    ...validation.draft,
    createdOrder: value.createdOrder,
  };
}

function salvageContacts(value: unknown): Contact[] {
  if (!Array.isArray(value)) return [];

  const contacts: Contact[] = [];
  const ids = new Set<string>();
  for (const candidate of value) {
    const contact = validateContact(candidate);
    if (!contact || ids.has(contact.id)) continue;
    contacts.push(contact);
    ids.add(contact.id);
  }
  return contacts;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOrder(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function invalid(reason: string, salvagedContacts: Contact[]): StoredDocumentValidation {
  return { kind: "invalid", reason, salvagedContacts };
}
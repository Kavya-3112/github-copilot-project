import type {
  Contact,
  ContactDraft,
  ContactDraftValidation,
  ContactFieldErrors,
  StoredContactsV1,
} from "./types";

export type CreateContactResult =
  | { kind: "created"; contact: Contact; document: StoredContactsV1 }
  | { kind: "invalid"; errors: ContactFieldErrors }
  | { kind: "failed"; reason: "duplicate-id" | "id-generation-failed" | "creation-order-exhausted" };

export type UpdateContactResult =
  | { kind: "updated"; contacts: Contact[] }
  | { kind: "invalid"; errors: ContactFieldErrors }
  | { kind: "not-found" };

export function validateContactDraft(value: unknown): ContactDraftValidation {
  if (typeof value !== "object" || value === null) {
    return { kind: "invalid", errors: { name: "Enter a name.", phone: "Enter a valid phone number." } };
  }

  const candidate = value as Partial<Record<keyof ContactDraft, unknown>>;
  const errors: ContactFieldErrors = {};

  if (typeof candidate.name !== "string" || candidate.name.length === 0) {
    errors.name = "Enter a name.";
  }

  if (typeof candidate.phone !== "string" || !isValidPhone(candidate.phone)) {
    errors.phone = "Enter a phone number with 7 to 15 digits and permitted formatting.";
  }

  if (Object.keys(errors).length > 0) {
    return { kind: "invalid", errors };
  }

  return {
    kind: "valid",
    draft: { name: candidate.name as string, phone: candidate.phone as string },
  };
}

export function isValidPhone(phone: string): boolean {
  if (!/^\+?[0-9 ()-]+$/.test(phone)) return false;

  let parenthesisDepth = 0;
  for (const character of phone) {
    if (character === "(") parenthesisDepth += 1;
    if (character === ")") {
      parenthesisDepth -= 1;
      if (parenthesisDepth < 0) return false;
    }
  }
  if (parenthesisDepth !== 0) return false;

  const digits = phone.replace(/[ +()-]/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function phoneSearchKey(value: string): string {
  return value.replace(/[ ()-]/g, "");
}

export function searchContacts(contacts: readonly Contact[], query: string): Contact[] {
  const nameQuery = query.toLowerCase();
  const phoneQuery = phoneSearchKey(query);

  return contacts.filter((contact) =>
    contact.name.toLowerCase().includes(nameQuery)
    || phoneSearchKey(contact.phone).includes(phoneQuery),
  );
}

export function sortContactsNewestFirst(contacts: readonly Contact[]): Contact[] {
  return contacts
    .map((contact, index) => ({ contact, index }))
    .sort((left, right) =>
      right.contact.createdOrder - left.contact.createdOrder || left.index - right.index,
    )
    .map(({ contact }) => contact);
}

export function createContact(
  document: StoredContactsV1,
  value: unknown,
  createId: () => string = () => globalThis.crypto.randomUUID(),
): CreateContactResult {
  const validation = validateContactDraft(value);
  if (validation.kind === "invalid") return validation;
  if (!Number.isSafeInteger(document.nextCreatedOrder) || document.nextCreatedOrder < 0 || document.nextCreatedOrder >= Number.MAX_SAFE_INTEGER) {
    return { kind: "failed", reason: "creation-order-exhausted" };
  }

  let id: string;
  try {
    id = createId();
  } catch {
    return { kind: "failed", reason: "id-generation-failed" };
  }

  if (typeof id !== "string" || id.length === 0 || document.contacts.some((contact) => contact.id === id)) {
    return { kind: "failed", reason: "duplicate-id" };
  }

  const contact: Contact = {
    id,
    ...validation.draft,
    createdOrder: document.nextCreatedOrder,
  };
  const nextDocument: StoredContactsV1 = {
    ...document,
    contacts: [...document.contacts, contact],
    nextCreatedOrder: document.nextCreatedOrder + 1,
  };

  return { kind: "created", contact, document: nextDocument };
}

export function updateContact(
  contacts: readonly Contact[],
  contactId: string,
  value: unknown,
): UpdateContactResult {
  const validation = validateContactDraft(value);
  if (validation.kind === "invalid") return validation;
  if (!contacts.some((contact) => contact.id === contactId)) return { kind: "not-found" };

  return {
    kind: "updated",
    contacts: contacts.map((contact) =>
      contact.id === contactId ? { ...contact, ...validation.draft } : contact,
    ),
  };
}
export type Contact = {
  id: string;
  name: string;
  phone: string;
  createdOrder: number;
};

export type ContactDraft = {
  name: string;
  phone: string;
};

export type StoredContactsV1 = {
  schemaVersion: 1;
  contacts: Contact[];
  nextCreatedOrder: number;
};

export type ContactFieldErrors = Partial<Record<keyof ContactDraft, string>>;

export type ContactDraftValidation =
  | { kind: "valid"; draft: ContactDraft }
  | { kind: "invalid"; errors: ContactFieldErrors };
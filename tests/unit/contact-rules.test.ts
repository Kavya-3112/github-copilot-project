import { describe, expect, it } from "vitest";
import {
  createContact,
  isValidPhone,
  phoneSearchKey,
  searchContacts,
  sortContactsNewestFirst,
  updateContact,
  validateContactDraft,
} from "../../src/contacts/rules";
import type { Contact, StoredContactsV1 } from "../../src/contacts/types";

const blankDocument: StoredContactsV1 = {
  schemaVersion: 1,
  contacts: [],
  nextCreatedOrder: 1,
};

describe("contact rules", () => {
  it("accepts 7-15 digits with only permitted formatting", () => {
    expect(isValidPhone("1234567")).toBe(true);
    expect(isValidPhone("+1 (234) 567-8901")).toBe(true);
    expect(isValidPhone("123456789012345")).toBe(true);
    expect(isValidPhone("123456")).toBe(false);
    expect(isValidPhone("1234567890123456")).toBe(false);
    expect(isValidPhone("123-ABC-7890")).toBe(false);
    expect(isValidPhone("1234567 ext 2")).toBe(false);
  });

  it("requires a leading plus and properly balanced parentheses", () => {
    expect(isValidPhone("+44 (20) 1234-5678")).toBe(true);
    expect(isValidPhone("44 (20) 1234-5678")).toBe(true);
    expect(isValidPhone("44) (20 1234-5678")).toBe(false);
    expect(isValidPhone("44 (20 1234-5678")).toBe(false);
    expect(isValidPhone("44) 20 (1234-5678")).toBe(false);
    expect(isValidPhone("44 +20 1234-5678")).toBe(false);
    expect(isValidPhone(" +44 20 1234 5678")).toBe(false);
  });

  it("preserves display values and rejects missing required fields", () => {
    expect(validateContactDraft({ name: "  Ada  ", phone: "+44 (20) 1234-5678" })).toEqual({
      kind: "valid",
      draft: { name: "  Ada  ", phone: "+44 (20) 1234-5678" },
    });
    expect(validateContactDraft({ name: "  ", phone: "1234567" })).toEqual({
      kind: "valid",
      draft: { name: "  ", phone: "1234567" },
    });
    expect(validateContactDraft({ name: "", phone: "1234567" })).toMatchObject({
      kind: "invalid",
      errors: { name: "Enter a name." },
    });
    expect(validateContactDraft({ name: "Ada", phone: "" })).toMatchObject({
      kind: "invalid",
      errors: { phone: expect.any(String) },
    });
  });

  it("compares formatted phone values without changing displayed values", () => {
    const contact: Contact = { id: "a", name: "Ada Lovelace", phone: "+1 (234) 567-8901", createdOrder: 1 };
    expect(phoneSearchKey(contact.phone)).toBe("+12345678901");
    expect(searchContacts([contact], "234-567")).toEqual([contact]);
    expect(searchContacts([contact], "ADA")).toEqual([contact]);
    expect(searchContacts([contact], "not present")).toEqual([]);
    expect(contact.phone).toBe("+1 (234) 567-8901");
  });

  it("assigns unique IDs and increasing creation order while allowing duplicate phones", () => {
    const first = createContact(blankDocument, { name: "Ada", phone: "1234567" }, () => "id-1");
    expect(first.kind).toBe("created");
    if (first.kind !== "created") return;

    const second = createContact(first.document, { name: "Grace", phone: "1234567" }, () => "id-2");
    expect(second.kind).toBe("created");
    if (second.kind !== "created") return;
    expect(second.document.contacts.map(({ id, createdOrder }) => [id, createdOrder])).toEqual([
      ["id-1", 1],
      ["id-2", 2],
    ]);
    expect(createContact(second.document, { name: "Lin", phone: "7654321" }, () => "id-2")).toEqual({
      kind: "failed",
      reason: "duplicate-id",
    });
  });

  it("sorts newest first and keeps equal-order contacts stable", () => {
    const contacts: Contact[] = [
      { id: "old", name: "Old", phone: "1234567", createdOrder: 1 },
      { id: "tie-a", name: "Tie A", phone: "1234567", createdOrder: 2 },
      { id: "new", name: "New", phone: "1234567", createdOrder: 3 },
      { id: "tie-b", name: "Tie B", phone: "1234567", createdOrder: 2 },
    ];
    expect(sortContactsNewestFirst(contacts).map(({ id }) => id)).toEqual(["new", "tie-a", "tie-b", "old"]);
  });

  it("edits by ID without changing identity or list position", () => {
    const contacts: Contact[] = [
      { id: "older", name: "Older", phone: "1234567", createdOrder: 1 },
      { id: "target", name: "Before", phone: "2345678", createdOrder: 2 },
      { id: "newer", name: "Newer", phone: "3456789", createdOrder: 3 },
    ];
    const result = updateContact(contacts, "target", { name: "After", phone: "9876543" });
    expect(result.kind).toBe("updated");
    if (result.kind !== "updated") return;
    expect(result.contacts.map(({ id }) => id)).toEqual(["older", "target", "newer"]);
    expect(result.contacts[1]).toEqual({ id: "target", name: "After", phone: "9876543", createdOrder: 2 });
    expect(contacts[1].name).toBe("Before");
  });
});
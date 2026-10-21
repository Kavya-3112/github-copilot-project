import { describe, expect, it } from "vitest";
import { createRecoveredDocument, parseStoredDocument, validateStoredDocument } from "../../src/storage/schema";

const validContact = { id: "contact-1", name: "Ada", phone: "+1 (234) 567-8901", createdOrder: 1 };

describe("stored contacts schema", () => {
  it("accepts a valid versioned document and an empty document", () => {
    expect(validateStoredDocument({ schemaVersion: 1, contacts: [validContact], nextCreatedOrder: 2 })).toMatchObject({
      kind: "valid",
      document: { schemaVersion: 1, contacts: [validContact], nextCreatedOrder: 2 },
    });
    expect(validateStoredDocument({ schemaVersion: 1, contacts: [], nextCreatedOrder: 1 }).kind).toBe("valid");
  });

  it("rejects malformed, unknown-version, invalid-contact, and duplicate-ID documents", () => {
    expect(parseStoredDocument("not json").kind).toBe("invalid");
    expect(validateStoredDocument({ schemaVersion: 2, contacts: [validContact], nextCreatedOrder: 2 })).toMatchObject({
      kind: "invalid",
      salvagedContacts: [validContact],
    });
    expect(validateStoredDocument({ schemaVersion: 1, contacts: [{ ...validContact, phone: "letters" }], nextCreatedOrder: 2 }).kind).toBe("invalid");
    expect(validateStoredDocument({ schemaVersion: 1, contacts: [validContact, validContact], nextCreatedOrder: 2 })).toMatchObject({
      kind: "invalid",
      salvagedContacts: [validContact],
    });
  });

  it("rejects invalid order counters and duplicate creation IDs before loading", () => {
    expect(validateStoredDocument({ schemaVersion: 1, contacts: [validContact], nextCreatedOrder: 1 }).kind).toBe("invalid");
    expect(validateStoredDocument({ schemaVersion: 1, contacts: [validContact], nextCreatedOrder: -1 }).kind).toBe("invalid");
  });

  it("keeps empty recovery in the first-save state without changing non-empty ordering", () => {
    expect(createRecoveredDocument([])).toEqual({ schemaVersion: 1, contacts: [], nextCreatedOrder: 0 });
    expect(createRecoveredDocument([validContact])).toEqual({
      schemaVersion: 1,
      contacts: [validContact],
      nextCreatedOrder: 2,
    });
  });
});
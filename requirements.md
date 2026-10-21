# Contact Management System Requirements Proposal

**Revision:** 2
**Status:** Approved by the user on 2026-10-21.
**Source:** `.github/input/userstory.md` (US-01 through US-08).

## 1. Purpose and Users

The system enables a user to keep, find, and manage contact names and phone numbers in one place. The supplied stories define the user as “a user”; they do not define account types, multiple-user access, or synchronization between users or devices.

## 2. Scope

### In scope

- Add, view, edit, and delete contacts.
- Search contacts by name or phone number.
- Permit distinct contacts to share a phone number.
- Persist contact data in browser local storage and handle storage/read failures as specified below.
- Provide keyboard-operable, accessible controls and responsive presentation.

### Out of scope

No supplied story requires accounts, server-side storage, cross-device synchronization, importing/exporting contacts, contact groups, or duplicate detection/removal. These are not requirements of this proposal.

## 3. Stated Requirements

Each requirement has a stable ID and a source trace. The acceptance criteria are the expected, testable outcomes supported by the supplied stories.

### Functional requirements

| ID | Requirement and acceptance criteria | Source |
|---|---|---|
| FR-01 | The system shall allow a user to create a contact with a name and phone number. It shall reject missing required fields and show a clear validation message for invalid input. A successful contact shall appear in the list ahead of older contacts. | US-01 |
| FR-02 | The system shall accept phone numbers containing 7–15 digits after permitted formatting characters are removed. Permitted formatting characters are a leading `+`, spaces, hyphens, and parentheses. It shall reject letters and extensions. | US-01 |
| FR-03 | The system shall display saved contacts with each contact’s name and phone number, newest first, and shall display an appropriate empty state when there are no contacts. Contact information shall remain available after a browser refresh, subject to retained browser storage. | US-02 |
| FR-04 | The system shall allow a user to select and edit an existing contact, prefill its saved details, validate updated information before saving, and reject invalid changes with a clear error. Cancelling an edit shall leave saved details unchanged. A successful edit shall not change the contact’s list position. | US-03 |
| FR-05 | The system shall require confirmation before permanently deleting a selected contact. Confirming shall remove only that contact; cancelling shall preserve it. Deleting the last contact shall display an appropriate empty state. | US-04 |
| FR-06 | The system shall search contacts by name and by full or partial phone number. Name matching shall be case-insensitive. Phone matching shall ignore differences in spaces, hyphens, and parentheses. Results shall update as the query changes; no matches shall produce a helpful message; clearing the query shall restore the full list. | US-05 |
| FR-07 | The system shall allow multiple contacts to have the same phone number. Every contact shall have a unique internal identifier. Editing or deleting a selected contact shall affect only that contact, and identical-phone contacts shall remain individually accessible and searchable. A phone number shall not serve as the contact’s unique identifier. | US-06 |
| FR-08 | The system shall store contacts in browser local storage and make them available after refresh or reopening the browser while the same browser storage remains available. | US-07 |
| FR-09 | Before using stored contact data, the system shall validate it. When stored data is unreadable, the system shall attempt recovery without immediately overwriting the original data. Replacing unreadable data shall require explicit user confirmation. | US-07 |
| FR-10 | If saving changes fails, the system shall retain the current visible changes in the interface, clearly indicate that they are not saved, and shall not indicate that the save succeeded. | US-07 |
| FR-11 | The system shall support responsive presentation at viewport widths down to 320 CSS pixels without unintended horizontal scrolling, and clearly present contact information in desktop and mobile viewport layouts. Testing at 320 CSS pixels is viewport-responsive layout testing; it does not certify compatibility with mobile browsers. | US-02, US-08 |

### Accessibility and quality requirements

| ID | Requirement and acceptance criteria | Source |
|---|---|---|
| NFR-01 | All interactive features shall be operable using a keyboard. Focus shall be visible and follow a logical order. | US-08 |
| NFR-02 | Form fields shall have accessible labels; validation messages, dynamic updates, and errors shall be communicated appropriately to assistive technologies. | US-08 |
| NFR-03 | Text and interactive controls shall meet applicable WCAG 2.2 AA requirements. Conformance shall be reported only after appropriate automated accessibility checks and manual keyboard and screen-reader testing have been completed. | US-08 |

## 4. Assumptions and Constraints

### Assumptions

No additional business assumptions are adopted. Requirements above are limited to the behavior explicitly stated in US-01 through US-08.

### Stated constraints

- Contact persistence uses browser local storage, not a server or cross-device service (US-07).
- Persistence depends on the same browser storage being retained (US-02, US-07).
- Responsive presentation supports viewport widths down to 320 CSS pixels; this viewport/layout requirement does not certify mobile-browser compatibility (US-08).
- Duplicate phone numbers are valid; contacts are distinguished by unique internal identifiers (US-06).
- Accessibility conformance claims depend on completing both automated and manual assessment (US-08).

### User-selected compatibility constraint

| ID | Constraint and acceptance criteria | Trace |
|---|---|---|
| CS-01 | The system shall be supported and tested on the current stable versions of Chrome and Edge on Windows 11 desktop, as of the time of verification. Compatibility with previous major versions, Firefox, Safari, and mobile browsers is out of scope; no compatibility claim shall be made for them. | User's explicit scope decision, 2026-10-21. This browser and operating-system scope was not specified in US-01 through US-08. |

## 5. Error Cases and Edge Cases

The system’s required responses are captured in the functional requirements. At minimum, verification should include:

- Missing name or phone number, phone number with fewer than 7 or more than 15 digits, letters, or an extension (FR-01, FR-02).
- A phone number with permitted formatting and a leading `+` (FR-02), including searches with formatting that differs from the saved number (FR-06).
- No contacts, deletion of the last contact, and a search with no matches (FR-03, FR-05, FR-06).
- Cancelling an edit or deletion, and invalid edits (FR-04, FR-05).
- Two or more contacts sharing a phone number; editing or deleting one must leave the others unchanged (FR-07).
- Unreadable or invalid stored data, recovery without immediate overwrite, and a failed save (FR-09, FR-10).
- Use at 320 CSS pixels, keyboard-only operation, and assistive-technology announcement of dynamic validation or error feedback (FR-11, NFR-01, NFR-02).

These cases do not prescribe behavior beyond the supplied acceptance criteria.

Browser compatibility verification shall cover the current stable versions of Chrome and Edge on Windows 11 desktop; a 320 CSS-pixel viewport check verifies responsive layout only and is not mobile-browser certification (CS-01, FR-11).

## 6. Security and Privacy Considerations

The stories place contact data in browser local storage. This makes browser storage retention and access relevant to data availability and privacy; the stories do not specify encryption, authentication, access control, backup, retention, or secure deletion. This proposal therefore makes no claims about those protections and does not add them as requirements. The system must not imply that locally stored contacts are synchronized or backed up, since no such capability is stated.

## 7. Unspecified Details and Limitations

The source stories do not define name format or normalization, whether surrounding whitespace counts as a provided name, the exact grammar and placement rules for `+` and punctuation, case/whitespace handling beyond case-insensitive name search, or precise phone-number normalization beyond ignoring the listed formatting differences. They also do not define ordering for contacts created at the same time, the recovery method for unreadable storage, or how a user retries or discards visible-but-unsaved changes. These details remain unspecified; this proposal does not invent rules for them.

The requirements are based on the supplied user-story document and the separately traced user-selected browser compatibility scope. No product architecture, implementation, legal or regulatory requirements, or additional source documents were provided or assessed.

## 8. Revision History

- **Revision 1 (2026-10-21):** Approved by the user; baseline for this revision. Its requirements and supporting sections are retained, with FR-11 clarified in revision 2.
- **Revision 2 (2026-10-21):** Approved by the user; clarifies FR-11 as a viewport/layout requirement and adds CS-01 from the user's explicit browser compatibility scope decision.
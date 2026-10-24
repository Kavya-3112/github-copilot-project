# Contact Management System Implementation Plan

**Revision:** 3  
**Status:** Approved by the user on 2026-10-21  
**Basis:** Approved `requirements.md` revision 2, approved `architecture.md` revision 4, and resolved/approved `design-review.md` revision 4. `.github/sdlc-status.md` records all three approvals on 2026-10-21.  
**Scope:** Reconciliation of implementation evidence and remaining work to CS-01, plus downstream verification gates. This plan does not implement code, approve itself, authorize deployment, or authorize remote actions.

## Revision History

- **Revision 1:** Approved by the user on 2026-10-21 under the prior requirements and architecture scope.
- **Revision 2:** Approved by the user on 2026-10-21 for requirements revision 1 and architecture revision 3. It separated integrated automated verification from mandatory manual accessibility gate G-01. That approval is preserved for its prior scope; revision 2 is superseded for the newly approved requirements revision 2 / architecture revision 4 scope.
- **Revision 3:** Approved by the user on 2026-10-21 to reconcile task evidence and next work to CS-01 in requirements revision 2 and the resolved design review revision 4.

## Execution Rules

- Revision 3 records the evidenced status of prior tasks; do not treat completed historical work as authorization for new work. Any new implementation or verification work must follow the applicable approval and authorization gates.
- Use TypeScript, Vite, native HTML/CSS/TypeScript, and browser `localStorage`; do not add a backend, account system, analytics, synchronization, or unapproved product scope.
- CS-01 covers current stable Chrome and Edge on Windows 11 desktop only. The recorded 2026-10-21 builds are Chrome 155.0.8059.85 and Edge 155.0.4283.62 on Windows 11 Enterprise build 26200. Do not claim prior majors, Firefox, Safari, mobile-browser support/compatibility, or verification of future stable releases.
- FR-11's 320 CSS-pixel assertion is responsive-layout evidence only; it is not mobile-browser testing or certification.
- Keep contact values out of URLs, logs, telemetry, and diagnostics; render user-provided values as text.
- Do not claim WCAG 2.2 AA conformance until automated checks and manual keyboard and screen-reader assessments are complete and evidenced. Completing T-06 alone does not satisfy the manual assessments or this claim restriction.
- Do not replace unreadable stored data except after the approved recovery and explicit-confirmation flow. Do not report persistence success when a write fails.
- DR-06 is explicitly accepted by the user: a same-origin writer can race between the localStorage backup-key absence check and write. The race is not eliminated; never make an absolute non-overwrite claim.
- No deployment or remote action is authorized by this plan revision. Any needed remote verification requires separate explicit authorization.

Revision 3 reconciliation: T-01 through T-06 remain complete only to the extent supported by their recorded evidence below. T-07 is blocked because deployed-origin evidence is recorded for Chrome but not Edge. G-01 remains a distinct mandatory human gate after code review and applicable verification.

## Tasks

### T-01: Establish the static TypeScript application and test toolchain

- **ID:** T-01.
- **Scope:** Create the minimum Vite/TypeScript project foundation and select exact, supported package versions and test tools. Keep runtime dependencies minimal and avoid a UI framework.
- **Related requirement IDs:** FR-01 through FR-11; NFR-01 through NFR-03.
- **Affected files/components:** `package.json`, lockfile, `tsconfig.json`, `vite.config.ts`, `index.html`, test-runner and browser-test configuration, initial `src/` and `tests/` structure.
- **Dependencies/blockers:** None. The workspace currently contains no product scaffold. Package and test-tool versions are not specified by the approved artifacts and must be selected and recorded as part of this task.
- **Implementation approach:** Set up reproducible install, development, typecheck, test, and production-build commands. Configure Vite for static output and make the asset base path configurable for the selected deployment path. Do not add product behavior in this task.
- **Acceptance criteria:** A clean install succeeds; development and production builds work; typecheck and test commands are documented and runnable; generated output is static and contains no secrets or contact data.
- **Required tests:** Clean-install check; TypeScript check; test-runner smoke test; production build and output inspection.
- **Status:** `COMPLETE`
- **Evidence:** `npm ci` succeeded with 0 vulnerabilities; `npm run typecheck` passed; `npm test` passed (1 test); Vite dev server started; root and `/contacts/` production builds passed; inspected output contains only static HTML and JavaScript with correctly based asset paths and no contact data or secrets.
- **Follow-up:** At T-01, Playwright's managed browser download was blocked by DNS. T-04 later ran the full browser suite successfully using installed Chrome 155.0.8059.85 via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; the managed browser runtime remains unavailable.

### T-02: Implement contact rules, types, and validated storage/recovery

- **ID:** T-02.
- **Scope:** Build the contact model, input and search rules, stored-document validation, and `localStorage` adapter, including preservation-first recovery.
- **Related requirement IDs:** FR-01, FR-02, FR-06, FR-07, FR-08, FR-09, FR-10.
- **Affected files/components:** `src/contacts/` types, validation, ordering and search rules; `src/storage/` schema validation, repository, backup and recovery; `tests/unit/`; `tests/integration/` repository tests.
- **Dependencies/blockers:** T-01. Name whitespace/casing details and same-time creation ordering are unspecified; preserve entered display values and do not introduce additional normalization or present an invented rule as a requirement. Record any implementation-level deterministic tie handling and its rationale before encoding it.
- **Implementation approach:** Validate 7–15 digits after removing only permitted formatting; accept a leading `+`, spaces, hyphens, and balanced parentheses; reject letters and extensions. Keep display values separate from search comparison values. Use unique IDs and creation order, never phone as identity. Validate the versioned document before loading. For unreadable data, salvage only in memory, preserve the exact original raw value, use an unused namespaced backup key, verify backup byte-for-byte, and require explicit confirmation before replacement. Convert storage failures into explicit outcomes without success claims.
- **Acceptance criteria:** Rules and repository behavior meet their traced requirements; duplicate phone numbers remain independent; handled recovery failures preserve the original raw value; unknown schema versions are not silently rewritten. The accepted same-origin backup-key race is not eliminated, so no absolute non-overwrite guarantee is made.
- **Required tests:** Phone boundaries and permitted formatting; duplicate phones and unique IDs; search normalization; order-preserving edits; valid/empty/malformed/unsupported storage; duplicate IDs; read and write exceptions; backup-key collision, failed write, failed read-back and mismatch; salvage; confirmation gating; primary replacement failure; assertions that original data remains recoverable and failures never report success.
- **Status:** `COMPLETE`
- **Review finding:** CR-02 resolved: empty recovery retains `nextCreatedOrder: 0`, so the first-save privacy notice stays visible until a contact is successfully saved. Non-empty recovery ordering and the explicitly accepted DR-06 same-origin backup-key race are unchanged.
- **Evidence:** Existing T-02 checks remain recorded above. `npm.cmd test -- tests/unit/storage-schema.test.ts tests/integration/contact-repository.test.ts` passed (14 tests across 2 files), including empty recovery at the schema and confirmed repository-recovery levels, exact raw backup preservation, and non-empty recovery retaining `nextCreatedOrder: 5` for a contact at order 4. `npm.cmd run test:browser -- -g "keeps the first-save privacy notice visible after empty recovery until a contact is saved"` passed (1 browser test); it verified successful empty recovery leaves the notice visible and the first saved contact hides it. `npm.cmd run typecheck` passed. Equal `createdOrder` values retain their original array order as a deterministic stable tie rule; this preserves the existing sequence without making creation timestamps or a new product ordering rule.

### T-03: Implement application state and contact workflows

- **ID:** T-03.
- **Scope:** Implement the state transitions for loading, creating, editing, deleting, searching, and persistence outcomes, including retry/discard behavior for unsaved changes.
- **Related requirement IDs:** FR-01 through FR-10.
- **Affected files/components:** `src/app/` application state and transitions; integration tests for contact workflows and persistence status.
- **Dependencies/blockers:** T-02. Use ID-targeted mutations. Any policy for unspecified same-time ordering must be documented consistently with T-02 before implementation.
- **Implementation approach:** Keep in-memory candidate changes visible when saving fails and distinguish them from persisted data. Save only validated candidates; preserve edit position; require delete confirmation; derive search results without writing to storage. On failed save, offer Retry and Discard, with Discard restoring the last persisted document, and warn before navigation or refresh while unsaved changes remain.
- **Acceptance criteria:** Create/edit/delete/cancel and search behavior matches the acceptance criteria; persistence success is shown only after a successful write; retry and discard act on the correct state; cancellation does not mutate saved data.
- **Required tests:** Create and newest-first list behavior; edit prefill/save/cancel/invalid update and stable position; confirm/cancel deletion including last contact; duplicate-phone contact isolation; live search and clear/no-match states; failed-write visible unsaved state, retry, discard, and navigation/refresh warning.
- **Status:** `COMPLETE`
- **Evidence:** `npm.cmd test -- tests/integration/contact-state.test.ts` passed (8 tests), covering empty/unreadable load transitions, create/newest-first ordering, edit prefill/cancel/invalid/save/stable position, confirmed and cancelled deletion including the last contact, duplicate-phone ID isolation, live search/clear/no-match without writes, failed-write visible candidate versus persisted document, full-candidate retry, discard to the last persisted document, and beforeunload warning behavior. `npm.cmd test` passed (27 tests across 5 files). `npm.cmd run typecheck` passed.

### T-04: Build the accessible responsive interface and recovery/privacy interactions

- **ID:** T-04.
- **Scope:** Implement the native semantic UI for contact workflows, storage recovery, validation, persistence status, and privacy disclosure.
- **Related requirement IDs:** FR-01 through FR-11; NFR-01 through NFR-03.
- **Affected files/components:** `src/ui/` views, forms, delete confirmation and recovery states; `src/styles/` responsive/focus styles; `index.html`; browser tests.
- **Dependencies/blockers:** T-03. Recovery actions must call the confirmation-gated repository/state flow from T-02/T-03; do not add an automatic reset path.
- **Implementation approach:** Use labeled native controls, visible focus, logical keyboard order, and accessible announcements for validation, search, storage, recovery, and save status. Render contact data as text, not interpreted HTML. Provide distinct empty-list and no-match states. Support 320 CSS pixels without unintended horizontal scrolling. Show the approved privacy notice before the first contact is saved and keep an accessible privacy link afterward.
- **Acceptance criteria:** All specified workflows are operable and understandable by keyboard; form and dynamic feedback is accessible; contact information remains clear at the minimum viewport; recovery and privacy content follow approved wording and timing.
- **Required tests:** Browser workflows for CRUD, dialogs, search, empty states, recovery confirmation and errors, save failures, refresh persistence, accessible labels/announcements and keyboard operation; responsive checks at 320 CSS pixels and desktop; automated accessibility checks. Human keyboard and screen-reader assessments are tracked in downstream gate G-01; no conformance claim is permitted until G-01 passes.
- **Status:** `COMPLETE`
- **Review finding:** CR-07 resolved; browser regressions cover reload failure and unreadable reload, asserting the failure announcement, no false completion, and accessible retry/recovery focus.
- **Review findings:** CR-01 and CR-03 resolved; browser regressions verify focus restoration after middle/last deletion and recovery completion announcements/focus for salvaged and empty recovery.
- **Evidence:** The current full browser suite passed 15 tests each in Chrome 155.0.8059.85 and Edge 155.0.4283.62, including axe checks and CR-01/CR-03/CR-07 regressions. `npm.cmd test` passed 31 tests across 6 files; `npm.cmd run typecheck` and `npm.cmd run build` passed. Responsive layout was checked at 320 and 1280 CSS pixels. Human keyboard and screen-reader assessment remains at G-01; no WCAG conformance claim is made.

### T-05: Apply application security and privacy safeguards

- **ID:** T-05.
- **Scope:** Implement and verify the approved architecture's data-minimization and privacy safeguards across application code and user-facing disclosure.
- **Related requirement IDs:** FR-08, FR-09, FR-10; NFR-01 through NFR-03. The requirements' Section 6 provides privacy considerations; safeguards here are architecture recommendations, not new product requirements.
- **Affected files/components:** `src/` rendering, storage and error handling; privacy notice/link in `src/ui/`; dependency/configuration review; security tests.
- **Dependencies/blockers:** T-01 through T-04. Host-specific response headers and CSP are verified in T-07 because the host is selected as a planning/release decision.
- **Implementation approach:** Ensure contact data is absent from URLs, logs, telemetry and error payloads; safely render contact-provided values as text; avoid third-party scripts and unnecessary runtime dependencies; show safe, actionable storage errors; use the exact approved disclosure and make no claims of encryption, backup, sync, secure deletion or compliance.
- **Acceptance criteria:** Contact data does not enter diagnostics or navigation; hostile-looking contact text is displayed literally; privacy copy and placement match approved architecture revision 4; dependency and security decisions are documented; no unsupported protection or compliance claims are made.
- **Required tests:** Tests for text-only rendering of contact values and safe errors; source/configuration review for contact-data logging, URL use and third-party scripts; dependency audit using the selected package tooling.
- **Status:** `COMPLETE`
- **Evidence:** `npm.cmd test` passed 28 tests across 5 files; `npm.cmd run test:browser` passed all 9 browser tests, including hostile-looking contact text rendered literally without creating an element or changing the URL, the approved privacy notice, and delete-confirmation wording; automated axe checks passed in tested states. `npm.cmd run typecheck` passed and `npm.cmd audit` reported 0 vulnerabilities. Repository/browser regression coverage confirms storage exception details are not exposed and users receive fixed actionable error text. Reviewed `src/` and app configuration: contact values are not used in navigation/URLs, logs, telemetry, outbound requests, or diagnostics; UI links are fixed same-page fragments, and `index.html` loads only the local application module. `package.json` has no runtime dependencies; test/build tooling is development-only. The notice text and placement match the approved architecture; no unsupported encryption, backup, sync, secure-deletion, or compliance claim is made. Manual keyboard and screen-reader assessment is assigned to downstream gate G-01; no WCAG conformance claim is made.

### T-06: Complete integrated verification and developer/user documentation

- **ID:** T-06.
- **Scope:** Run integrated automated verification and document setup, supported behavior, storage limitations, recovery, privacy, and verification procedures accurately. Manual keyboard and screen-reader assessment is explicitly outside T-06 and remains subject to the separate downstream gate below.
- **Related requirement IDs:** FR-01 through FR-11; NFR-01 through NFR-03.
- **Affected files/components:** `tests/` unit, integration and browser suites; root `README.md` or equivalent project documentation; automated verification evidence records.
- **Dependencies/blockers:** T-01 through T-05. Exact test commands and tools come from T-01. G-01 remains a separate downstream gate requiring a human tester and an available supported browser and screen-reader setup.
- **Implementation approach:** Run the integrated automated checks for the full acceptance criteria and document how to install, run, build, test, use, and recover the application. Explain that data resides only in the current browser profile and is not encrypted, backed up, or synced. Record automated accessibility results accurately. State that no WCAG 2.2 AA claim is made and that T-06 does not perform, satisfy, or waive manual keyboard and screen-reader assessment; record those assessments only at the downstream gate.
- **Acceptance criteria:** Documentation agrees with actual behavior and command output and makes no unsupported conformance/security claims; all required automated tests pass; the documentation clearly identifies the separate human assessment gate and does not imply that it has passed.
- **Required tests:** Full unit, integration, browser and automated accessibility suites; check at 320 CSS pixels; refresh/reopen persistence where browser storage is retained; document command accuracy against actual command output. Human keyboard-only and screen-reader assessments are not T-06 tests and remain mandatory at the downstream gate.
- **Status:** `COMPLETE`
- **Review finding:** CR-06 resolved; README has one complete environment entry and records the dependency audit result.
- **Review finding:** CR-05 resolved; the README verification record now uses actual rerun totals. G-01 remains pending and no WCAG claim is made.
- **Automated evidence:** `npm.cmd test` passed 31 tests across 6 files; `npm.cmd run test:browser` passed 15 tests each in Chrome 155.0.8059.85 and Edge 155.0.4283.62 on Windows 11 Enterprise build 26200, including four axe audit states, 320/1280 CSS-pixel checks, and CR-01/CR-03/CR-07 regressions; `npm.cmd run typecheck`, `npm.cmd run build`, and `npm.cmd audit` passed; `npm.cmd audit` reported 0 vulnerabilities. README records setup, workflows, recovery, privacy, the CS-01-only browser matrix, commands, and actual results. Full human keyboard and screen-reader assessment remains at G-01; no WCAG claim is made. Tests used installed supported browser executables because the managed Playwright download was unavailable.
- **Partial user-reported evidence:** On 2026-10-21, the user reported checking basic keyboard navigation in Chrome 155. Full keyboard assessment is pending; screen-reader testing was not performed.
- **Downstream gate:** G-01 remains pending. The user reported basic keyboard navigation in Chrome 155, but full keyboard assessment is incomplete and screen-reader testing was not performed. The scripted keyboard walkthrough and partial user report do not establish usability conformance. Do not claim WCAG 2.2 AA conformance unless automated checks and both required manual assessments have evidence.

### T-07: Reconcile CS-01 deployed-origin evidence and release documentation

- **ID:** T-07.
- **Scope:** Reconcile the existing deployment and browser evidence to the approved CS-01 target set, record truthful release documentation, and close the remaining selected-target host/origin evidence gap. This task does not deploy, alter a remote service, or authorize any remote action.
- **Related requirements:** CS-01, FR-08, FR-11, NFR-01, NFR-02, NFR-03.
- **Affected files/components:** `README.md`, `public/_headers`, `vite.config.ts` only if a locally demonstrated configuration defect requires correction after approval; dated browser and deployed-origin evidence record.
- **Dependencies/blockers:** T-01 through T-06 have recorded completion evidence. The existing Cloudflare Pages deployment is live. The Edge 155 deployed-origin check was separately authorized and completed on 2026-10-21; no deployment or configuration changes were made.
- **Approach:** Keep compatibility claims limited to current stable Chrome and Edge on Windows 11 desktop, evidenced for Chrome 155.0.8059.85 and Edge 155.0.4283.62 on Windows 11 Enterprise build 26200 on 2026-10-21. Preserve separate local browser-suite and deployed-origin evidence. Record the user-authorized Edge root/fallback, headers, and isolated synthetic-storage check. The README release matrix contains only CS-01 targets; the 320 CSS-pixel assertion is layout evidence only. Do not claim excluded browsers or future stable releases are verified.
- **Acceptance criteria:** Exact tested browser builds, OS build, date, and scope boundaries are recorded; the Chrome hosted evidence is accurately described; corresponding Edge hosted-origin evidence is recorded before T-07 is complete; no untested target is claimed; the 320 CSS-pixel assertion is labeled layout-only; no contact data is transferred or retained by the synthetic check; documentation does not imply deployment or remote authorization from this plan.
- **Required tests:** Check the existing deployed root and unknown-route on Edge 155.0.4283.62 for HTTPS 200 and configured CSP, HSTS, `nosniff`, frame, permissions, and referrer headers; in an isolated Edge context, save synthetic data, verify persistence after reload, delete it, and confirm cleanup. This check was separately authorized by the user on 2026-10-21; no deployment/configuration changes are in scope.
- **Status:** `COMPLETE`
- **Review findings:** CR-01 resolved: after confirmed deletion, focus moves to the next visible contact's Edit action, the previous contact action when deleting the final visible row, the list heading when no filtered rows remain, or the empty-state heading when the final contact is removed. Cancellation handling is unchanged. CR-03 resolved: a persistent polite live-status region outside the recovery dialog announces completion only after successful state reload; focus moves to the restored contacts heading or empty-state heading. Reload failure is reported without claiming recovery completion.
- **Evidence:** `npm.cmd test` passed 31 tests across 6 files; `npm.cmd run test:browser` passed 15 tests each in Chrome 155.0.8059.85 and Edge 155.0.4283.62 on Windows 11 Enterprise build 26200. `npm.cmd run typecheck` and `npm.cmd run build` passed. Chrome and Edge deployed root/unknown-route requests returned HTTPS 200 with configured headers. Isolated synthetic contact storage persisted across reload and was deleted in each browser context. The README release matrix now names only CS-01 targets, with 320 CSS pixels labeled as layout-only. No excluded browser or mobile-browser claim is made.
- **Review finding:** CR-04 resolved; the release matrix and instructions now restrict supported/tested browser claims to current stable Chrome and Edge on Windows 11 desktop, excluding previous majors, Firefox, Safari, and mobile browsers.
- **Remaining scope boundary:** G-01 human keyboard and screen-reader assessment remains pending; no WCAG 2.2 AA claim is made.

## Downstream Verification/Release Gate

### G-01: Human keyboard and screen-reader assessment

- **ID:** G-01.
- **Scope:** Separate mandatory human assessment of keyboard-only operation and screen-reader announcements on the release candidate. Automated accessibility checks do not replace it.
- **Related requirements:** NFR-01, NFR-02, NFR-03.
- **Affected files/components:** Release candidate UI; human assessment and verification evidence record.
- **Dependencies/blockers:** T-06 automated verification; T-07 complete; code review and applicable verification completed; a human tester with the supported Chrome/Edge Windows 11 desktop setup and screen-reader access. This gate follows code review and applicable verification; it is not part of T-06 or T-07.
- **Approach:** Perform and record human keyboard-only and screen-reader assessments against the release candidate. Record tester, date, exact browser/version and OS, screen-reader name/version, results, issues, and retests. Automated axe or browser results cannot satisfy this gate.
- **Acceptance criteria:** Both manual assessments are completed with findings and any required retest evidence recorded. No WCAG 2.2 AA conformance claim is made until automated accessibility evidence and both manual assessments are complete and support that claim.
- **Required tests:** Human keyboard-only workflow assessment and human screen-reader assessment on the release candidate; retest any fixes. Use only the CS-01 supported browser scope and make no claims for excluded browsers or mobile browsers.
- **Status:** `PENDING`.

## Unresolved Dependencies and Decisions

- Exact package versions, unit-test runner and browser-test tooling are intentionally left to T-01; the approved architecture does not select them.
- Cloudflare Pages is the existing deployed host. This plan revision authorizes no deployment or remote action. T-07 remains blocked until separately authorized Edge deployed-origin evidence is collected and reconciled.
- CS-01 is limited to current stable Chrome and Edge on Windows 11 desktop. The recorded 2026-10-21 builds are Chrome 155.0.8059.85 and Edge 155.0.4283.62 on Windows 11 Enterprise build 26200. Previous majors, Firefox, Safari, and mobile browsers are explicitly excluded; no future stable release is claimed verified.
- The 320 CSS-pixel assertion is responsive layout evidence under FR-11 only, not mobile-browser testing or certification.
- Name whitespace/casing behavior and deterministic ordering for contacts created at the same time remain unspecified by the approved requirements and architecture. Do not present a chosen implementation detail as an approved product rule; document any necessary deterministic behavior and seek clarification if it changes user-visible acceptance behavior.
- Manual screen-reader verification depends on access to a suitable browser/screen-reader setup; completion must be evidenced before claiming NFR-03 conformance.

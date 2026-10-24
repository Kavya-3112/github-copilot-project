# Contact Management System

## Requirements

Development requires Node.js 24 or 26+ and npm 11.19.1.

## Run Locally

```sh
npm.cmd ci
npm.cmd run dev
```

Open the local URL printed by Vite. To create a contact, choose **Add contact**,
enter a name and phone number, and save. Phone numbers accept 7–15 digits with
spaces, hyphens, parentheses, and a leading `+`; letters and extensions are not
accepted. Use the search field to match names or phone numbers. Edit preserves a
contact's list position, and delete requires confirmation. Different contacts
may share a phone number.

If a save fails, the changed list remains visible and is marked unsaved. Choose
**Retry save** to try again or **Discard changes** to return to the last saved
list. Leaving or refreshing while changes are unsaved triggers the browser's
before-unload warning; continuing can lose those changes.

## Data And Recovery

Contacts are stored only in `localStorage` for the current browser profile. They
may remain available after refresh or reopening the browser while that storage
is retained. They are not encrypted, backed up, or synced. Other people using
the same browser profile and scripts running on this site may be able to access
them. Clearing browser site data or losing the profile can remove the contacts.

The app displays this privacy notice before the first contact is saved and
keeps a **Privacy notice** link afterward:

> Contacts are stored in this browser profile only. They are not encrypted, backed up, or synced. People sharing this browser profile and scripts running on this site may be able to access them.

If stored contacts cannot be read, the app does not immediately replace them.
It offers to salvage individually valid contacts in memory. Recovery proceeds
only after confirmation: the app selects an unused namespaced backup key, writes
the exact original stored value, and verifies that value by reading it back
before replacing the primary data. If backup selection, writing, or verification
fails, recovery is blocked and the original is not replaced. If primary
replacement fails after backup verification, the backup remains and the app
reports failure so recovery can be retried. When no valid contacts can be
salvaged, a confirmed recovery creates an empty list only after the original is
backed up. Browser localStorage does not provide an atomic create-if-absent
operation, so an external concurrent storage change could race the unused-key
check.

## Build And Verify

Run from the project root:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:browser
npm.cmd run build
```

The build runs the TypeScript check and writes static files to `dist/`. Set
`VITE_BASE_PATH` to the deployment path, with leading and trailing slashes, for
a subpath build; for example, `/contacts/`. The default is `/`.

Playwright uses its managed Chromium by default. If it is unavailable, point
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an installed Chromium-compatible
browser. In PowerShell:

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm.cmd run test:browser
```

The browser suite covers create/edit/delete, search, persistence after refresh,
validation, recovery, failed-save handling, and an axe audit of the empty, form,
delete-dialog, and recovery-dialog states. Responsive layout is checked at 320
and 1280 CSS pixels; the 320px check is viewport-layout evidence only and does
not certify mobile browsers. The keyboard-only browser walkthrough exercises
contact creation, search, edit, and deletion using keyboard events without
pointer actions. Automated checks do not establish WCAG conformance. No WCAG
2.2 AA conformance claim is made; manual screen-reader assessment is still
required.

## Static Hosting And Release Verification

The selected static host is Cloudflare Pages. It serves the Vite `dist/`
directory over HTTPS, supports response headers from `public/_headers`, and
requires no application server, runtime secret, or contact-data upload. The
deployed project is `contact-management-system`, with production branch `main`.
Deployment `38d0ce37-bdb9-4e53-a568-3efb22a58838` was recorded by Wrangler on
2026-10-21 at
<https://38d0ce37.contact-management-system.pages.dev>.
The deployed root and an unknown route returned HTTPS `200` on 2026-10-21. A
headless Chrome 155 run loaded the app, observed no page errors, saved a
synthetic contact to origin-scoped `localStorage`, verified it after reload,
and deleted it before closing its isolated browser context. The deployment is
at the project root with `VITE_BASE_PATH=/`. The app has
no client-side routes; Pages' SPA fallback serves `index.html` for unknown
paths when no top-level `404.html` is present. Such paths do not represent
separate app views. A subpath deployment needs provider routing that maps the
configured base path to the emitted files and is not the selected deployment.

The `_headers` file configures a same-origin CSP without inline scripts/styles
or `eval`, denies framing, restricts browser capabilities, disables referrers,
prevents MIME sniffing, and sets HSTS. The deployed responses included the
configured CSP, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Permissions-Policy`, and `Referrer-Policy` headers.
`localStorage` is scoped to the exact scheme, host, and port, so
the Pages hostname and any later custom domain have separate contact stores.
Synthetic origin-storage persistence has been verified in Chrome 155. For a
new domain, verify its separate localStorage origin with synthetic data; do not
copy production contact data during deployment or verification.

### Release Browser Matrix

Target selection date: 2026-10-21. Targets below pin the browser and OS major
versions for this release candidate; record the exact patch/build and device
model when testing. Reconfirm stable versions before any later release. A
target is not verified merely because it is listed here.

| Supported browser target | Verification evidence |
|---|---|
| Current stable Chrome on Windows 11 Enterprise build 26200 | Chrome 155.0.8059.85; 15 browser tests, deployed root/fallback, headers, and synthetic storage persistence verified on 2026-10-21. |
| Current stable Edge on Windows 11 Enterprise build 26200 | Edge 155.0.4283.62; 15 browser tests, deployed root/fallback, headers, and synthetic storage persistence verified on 2026-10-21. |

For each CS-01 browser target, retain the exact browser build, OS build, test
date, results, and relevant test report. Verify HTTPS and the
effective CSP/security headers on the deployed origin; app load and asset
requests; create, edit, cancel, delete, search, and duplicate-phone behavior;
refresh persistence and storage-error/recovery using synthetic data; keyboard
operation and visible focus; and responsive layout at a 320 CSS-pixel viewport
(layout-only, not mobile-browser certification) and desktop width. Run
automated accessibility checks on each supported browser. These checks do not
replace G-01's human keyboard and screen-reader assessment and do not support a
WCAG conformance claim.

The Cloudflare Pages deployment and Chrome 155/Edge 155 root/fallback, header,
and synthetic-storage checks are complete for CS-01. Only current stable Chrome
and Edge on Windows 11 desktop are included in the supported/tested browser
scope. Code review, applicable verification, and G-01 remain required before a
final release or any WCAG 2.2 AA claim.

## Manual Accessibility Assessment

Record the tester, date, browser/version, viewport, input method, screen reader,
and results. Do not report conformance from the automated checks alone.

### Keyboard

- At a 320 CSS-pixel viewport (layout-only) and desktop width, use Tab,
  Shift+Tab, Enter, Space, and Escape without a pointer. Confirm visible focus
  and that focus returns to an appropriate control after dialogs close.
- Create a contact; submit missing and invalid fields; verify focus moves to the
  first error and the error is associated with its field.
- Search by name and formatted phone, clear the query, edit and cancel, then
  cancel and confirm deletion. Verify list, empty, and no-match states.
- With failed-save or unreadable-storage fixtures, verify retry/discard,
  recovery confirmation, and error handling by keyboard.

### Screen Reader

- With a supported screen reader active, navigate landmarks, headings, form
	labels, the privacy notice/link, contact rows, and action names.
- Trigger validation, search updates, save errors, recovery feedback, and
	dialogs. Confirm announcements are understandable, timely, and do not expose
	browser exception details or contact data beyond the intended interface.
- Record the exact screen-reader/browser versions, issues, and retest results.

## Verification Record

**Run date:** 2026-10-21  
**Environment:** Node.js 26.10.0, npm 11.19.1, Windows 11 Enterprise build
26200, Chrome 155.0.8059.85, and Edge 155.0.4283.62.

| Command | Result |
|---|---|
| `npm.cmd test` | Passed: 31 tests across 6 files. |
| `$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'; npm.cmd run test:browser` | Passed: 15 browser tests in Chrome 155.0.8059.85. Includes four axe audit states with no reported violations, focus/recovery regressions, and 320/1280 CSS-pixel checks. |
| `$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'; npm.cmd run test:browser` | Passed: 15 browser tests in Edge 155.0.4283.62. Includes four axe audit states with no reported violations, focus/recovery regressions, and 320/1280 CSS-pixel checks. |
| `npm.cmd run typecheck` | Passed: `tsc --noEmit`. |
| `npm.cmd run build` | Passed: typecheck and Vite production build; static output generated in `dist/`. |
| `npm.cmd audit` | Passed: 0 vulnerabilities found. |

**Keyboard-only walkthrough:** The Playwright test “completes create, search,
edit, and delete using keyboard input only” passed using Tab, Enter, and text
entry keys without pointer actions. It exercised creating a contact, searching
and clearing the query, editing, canceling deletion, and confirming deletion.
This is scripted keyboard-path evidence, not a human assessment of keyboard
usability or all focus behavior.

**Screen reader:** `C:\Windows\System32\Narrator.exe` is installed, but Narrator
was not running. This automation environment does not provide an interactive
screen-reader/audio session, so a manual screen-reader assessment was not
performed. User-reported partial check (2026-10-21): basic keyboard navigation was
checked in Chrome 155. Full human keyboard assessment remains pending;
screen-reader testing was not performed.
Automated axe and scripted keyboard results do not establish WCAG conformance;
no WCAG 2.2 AA conformance claim is made.
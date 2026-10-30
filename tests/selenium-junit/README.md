# Selenium + JUnit Login Gate Tests (FR-12, PR #5)

This suite is deliberately kept separate from the Node/Playwright tests.
 It is an additional end-to-end sanity suite that can be run on a more traditional JVM-based test pipeline.

> *Requirements traceability gap*: FR-12 is implemented in PR #5 but it is not listed in `requirements.md` or `architecture.md` as a formally approved requirement. These tests trace to PR #5 and repository docs introduced in that PR (e.g. `PR-description.md`, `code-review.md`, `verification-report.md`).


## Prerequisites

- Java 17 (or compatible)
- Maven 3.x
- Google Chrome
- ChromeDriver on `PHATH` or configured via Selenium Manager (Selenium 4.10+ has built-in driver management on many platforms).

## App URL, defaults

The tests default to `baseUrl=http://localhost:5173`.

You can override it via a system property:

```bash
mvn -qDbaseUrl=http://localhost:5173 test
```


## Running the App (This suite does not start it)

In one terminal from the repo root:

```bash
npm ci
npm run dev -- --host 127.0.0.1
# App available at http://localhost:5173
```

## Running the Selenium/JUnit suite

In a second terminal:

```bash
cd tests/selenium-junit
mvn -q test
```

Reports are written by Maven Surefire to:

```
tests/selenium-junit/target/surefire-reports/
```

## Notes
- Tests use locators based on `data-testid` attributes where possible to reduce flakiness.
- The app is a client-only Vite SPA. There is no server-side database configuration.

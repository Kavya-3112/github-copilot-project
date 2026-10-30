import { expect, test } from "@playwright/test";
import { signInForTest } from "./support/auth";

const storageKey = "contact-management:contacts:v1";
const privacyNotice = "Contacts are stored in this browser profile only. They are not encrypted, backed up, or synced. People sharing this browser profile and scripts running on this site may be able to access them.";

test("serves the app with accessible controls, privacy notice, and responsive layout", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/");
  await expect(page).toHaveTitle("Contact Management System");
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.locator("#app")).toHaveCount(1);
  await expect(page.getByRole("searchbox", { name: "Search by name or phone" })).toBeVisible();
  await expect(page.locator("#first-save-notice")).toContainText(privacyNotice);

  const controlNames = await page.evaluate(() => ({
    unlabeledInputs: [...document.querySelectorAll("input")].filter((input) => !input.labels?.length).length,
    unnamedButtons: [...document.querySelectorAll("button")].filter((button) => !(button.textContent?.trim() || button.getAttribute("aria-label"))).length,
  }));
  expect(controlNames.unlabeledInputs).toBe(0);
  expect(controlNames.unnamedButtons).toBe(0);

  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).toBe("solid");
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  }
});

test("completes create, search, edit, and delete using keyboard input only", async ({ page }) => {
  const focusDeleteButton = async (): Promise<void> => {
    const deleteButton = page.getByRole("button", { name: "Delete Ada Byron" });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (await deleteButton.evaluate((element) => document.activeElement === element)) return;
      await page.keyboard.press("Tab");
    }
  };

  await signInForTest(page);
  await page.goto("/");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Add contact" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await page.keyboard.type("Ada Lovelace");
  await page.keyboard.press("Tab");
  await page.keyboard.type("1234567");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Ada Lovelace", level: 3 })).toBeVisible();

  await page.keyboard.press("Tab");
  await page.keyboard.type("1234567");
  await expect(page.getByRole("heading", { name: "Ada Lovelace", level: 3 })).toBeVisible();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Edit Ada Lovelace" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Ada Byron");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Ada Byron", level: 3 })).toBeVisible();

  await focusDeleteButton();
  await expect(page.getByRole("button", { name: "Delete Ada Byron" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Delete this contact?" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Delete this contact?" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Ada Byron", level: 3 })).toBeVisible();

  await focusDeleteButton();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Delete contact" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "No contacts yet" })).toBeVisible();
});

test("creates, searches, edits, cancels deletion, deletes, and persists contacts", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Add contact" }).click();
  const formDialog = page.getByRole("dialog", { name: "Add contact" });
  await expect(formDialog).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Phone number", { exact: true })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Ada Lovelace");
  await page.getByLabel("Phone number", { exact: true }).fill("+1 (234) 567-8901");
  await page.getByRole("button", { name: "Save contact" }).click();
  await expect(page.getByRole("heading", { name: "Ada Lovelace", level: 3 })).toBeVisible();
  await expect(page.locator("#first-save-notice")).toBeHidden();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Ada Lovelace", level: 3 })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search by name or phone" });
  await search.fill("234-567");
  await expect(page.getByRole("heading", { name: "Ada Lovelace", level: 3 })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "1 match" })).toBeVisible();
  await search.fill("no match");
  await expect(page.getByRole("heading", { name: "No matches found" })).toBeVisible();
  await search.fill("");

  await page.getByRole("button", { name: "Edit Ada Lovelace" }).click();
  await expect(page.getByRole("dialog", { name: "Edit contact" })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Ada Lovelace");
  await page.getByLabel("Name", { exact: true }).fill("Ada Byron");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Ada Byron", level: 3 })).toBeVisible();

  await page.getByRole("button", { name: "Delete Ada Byron" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "Delete this contact?" });
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog).toContainText("This contact will be removed from the contact list stored in this browser profile.");
  await page.getByRole("button", { name: "Keep contact" }).click();
  await expect(deleteDialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Ada Byron", level: 3 })).toBeVisible();

  await page.getByRole("button", { name: "Delete Ada Byron" }).click();
  await page.getByRole("button", { name: "Delete contact" }).click();
  await expect(page.getByRole("heading", { name: "No contacts yet" })).toBeVisible();
});

test("returns focus to the next contact action after deleting a middle contact", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1,
    contacts: [
      { id: "ada", name: "Ada", phone: "1234567", createdOrder: 0 },
      { id: "grace", name: "Grace", phone: "2345678", createdOrder: 1 },
      { id: "linus", name: "Linus", phone: "3456789", createdOrder: 2 },
    ],
    nextCreatedOrder: 3,
  })), storageKey);
  await signInForTest(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Delete Grace" }).click();
  await page.getByRole("button", { name: "Delete contact" }).click();

  await expect(page.getByRole("heading", { name: "Grace", level: 3 })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit Ada" })).toBeFocused();
});

test("moves focus to the empty-state heading after deleting the last contact", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1,
    contacts: [{ id: "ada", name: "Ada", phone: "1234567", createdOrder: 0 }],
    nextCreatedOrder: 1,
  })), storageKey);
  await signInForTest(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Delete Ada" }).click();
  await page.getByRole("button", { name: "Delete contact" }).click();

  await expect(page.getByRole("heading", { name: "No contacts yet" })).toBeFocused();
});

test("renders hostile-looking contact text literally without putting it in the URL", async ({ page }) => {
  const hostileName = '<img src=x onerror="alert(1)">';
  await signInForTest(page);
  await page.goto("/");
  const initialUrl = page.url();
  await page.getByRole("button", { name: "Add contact" }).click();
  await page.getByLabel("Name", { exact: true }).fill(hostileName);
  await page.getByLabel("Phone number", { exact: true }).fill("1234567");
  await page.getByRole("button", { name: "Save contact" }).click();

  await expect(page.getByRole("heading", { name: hostileName, level: 3 })).toBeVisible();
  await expect(page.locator("#contact-list img")).toHaveCount(0);
  expect(page.url()).toBe(initialUrl);
  await expect(page.locator("#contact-list")).toContainText(hostileName);
});

test("announces missing and invalid fields and directs focus to the first error", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Add contact" }).click();
  await page.getByRole("button", { name: "Save contact" }).click();
  await expect(page.getByText("Enter a name.")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Review the highlighted fields.");
  await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();

  await page.getByLabel("Name", { exact: true }).fill("Grace Hopper");
  await page.getByLabel("Phone number", { exact: true }).fill("123 ext 4");
  await page.getByRole("button", { name: "Save contact" }).click();
  await expect(page.getByText("Enter a phone number with 7 to 15 digits and permitted formatting.")).toBeVisible();
  await expect(page.getByLabel("Phone number", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Phone number", { exact: true })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Add contact" })).toBeHidden();
});

test("salvages valid records only after confirmation and preserves the exact original", async ({ page }) => {
  const raw = '{ "schemaVersion": 99, "contacts": [{"id":"saved","name":"Ada","phone":"1234567","createdOrder":4}], "opaque": true }';
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: storageKey, value: raw });
  await signInForTest(page);
  await page.goto("/");

  const recoveryDialog = page.getByRole("dialog", { name: "Stored contacts need attention" });
  await expect(recoveryDialog).toBeVisible();
  await expect(recoveryDialog).toContainText("1 valid contact is available to recover.");
  await expect(page.getByRole("heading", { name: "Ada", level: 3 })).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(raw);
  await page.getByRole("button", { name: "Back up original and recover" }).click();

  await expect(page.getByRole("heading", { name: "Ada", level: 3 })).toBeVisible();
  await expect(page.locator("#recovery-announcement")).toHaveText("Recovery completed. The original data is preserved in a verified backup.");
  await expect(page.locator("#recovery-announcement")).toHaveAttribute("aria-live", "polite");
  await expect(page.locator("#recovery-announcement").evaluate((element) => element.closest("dialog"))).resolves.toBeNull();
  await expect(page.getByRole("heading", { name: "All contacts" })).toBeFocused();
  const values = await page.evaluate((key) => {
    const backupKey = Object.keys(localStorage).find((item) => item.startsWith(`${key}:recovery-backup:`));
    return { primary: localStorage.getItem(key), backup: backupKey ? localStorage.getItem(backupKey) : null };
  }, storageKey);
  expect(values.backup).toBe(raw);
  expect(values.primary).not.toBe(raw);
});

test("announces reload failure and focuses Retry after recovery was saved", async ({ page }) => {
  const raw = '{"schemaVersion":99,"contacts":[{"id":"saved","name":"Ada","phone":"1234567","createdOrder":4}]}';
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, value);
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    let failReloadAfterReplacement = false;

    Storage.prototype.setItem = function (itemKey: string, nextValue: string): void {
      originalSetItem.call(this, itemKey, nextValue);
      if (itemKey === key && nextValue !== value) failReloadAfterReplacement = true;
    };
    Storage.prototype.getItem = function (itemKey: string): string | null {
      if (itemKey === key && failReloadAfterReplacement) {
        failReloadAfterReplacement = false;
        throw new DOMException("Synthetic reload failure", "SecurityError");
      }
      return originalGetItem.call(this, itemKey);
    };
  }, { key: storageKey, value: raw });
  await signInForTest(page);
  await page.goto("/");

  await page.getByRole("dialog", { name: "Stored contacts need attention" }).waitFor();
  await page.getByRole("button", { name: "Back up original and recover" }).click();

  const announcement = page.locator("#recovery-announcement");
  await expect(announcement).toHaveText("Recovery was saved, but contacts could not be reloaded. Select Try again to reload contacts.");
  await expect(announcement).toHaveAttribute("aria-live", "polite");
  await expect(announcement).not.toContainText("Recovery completed.");
  await expect(page.getByRole("dialog", { name: "Stored contacts need attention" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeFocused();

  const values = await page.evaluate((key) => {
    const backupKey = Object.keys(localStorage).find((item) => item.startsWith(`${key}:recovery-backup:`));
    return { primary: localStorage.getItem(key), backup: backupKey ? localStorage.getItem(backupKey) : null };
  }, storageKey);
  expect(values.backup).toBe(raw);
  expect(JSON.parse(values.primary!).schemaVersion).toBe(1);
});

test("reopens accessible recovery when the post-replacement reload is unreadable", async ({ page }) => {
  const raw = '{"schemaVersion":99,"contacts":[{"id":"saved","name":"Ada","phone":"1234567","createdOrder":4}]}';
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, value);
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    let returnUnreadableAfterReplacement = false;

    Storage.prototype.setItem = function (itemKey: string, nextValue: string): void {
      originalSetItem.call(this, itemKey, nextValue);
      if (itemKey === key && nextValue !== value) returnUnreadableAfterReplacement = true;
    };
    Storage.prototype.getItem = function (itemKey: string): string | null {
      if (itemKey === key && returnUnreadableAfterReplacement) {
        returnUnreadableAfterReplacement = false;
        return '{"schemaVersion":99,"contacts":[{"id":"reloaded","name":"Grace","phone":"2345678","createdOrder":7}]}';
      }
      return originalGetItem.call(this, itemKey);
    };
  }, { key: storageKey, value: raw });
  await signInForTest(page);
  await page.goto("/");

  await page.getByRole("dialog", { name: "Stored contacts need attention" }).waitFor();
  await page.getByRole("button", { name: "Back up original and recover" }).click();

  const recoveryDialog = page.getByRole("dialog", { name: "Stored contacts need attention" });
  await expect(recoveryDialog).toBeVisible();
  await expect(recoveryDialog).toHaveAttribute("aria-describedby", "recovery-description");
  await expect(recoveryDialog).toContainText("Stored contacts use an unsupported version.");
  await expect(recoveryDialog).toContainText("1 valid contact is available to recover.");
  await expect(recoveryDialog.getByRole("alert")).toContainText("Recovery data was saved, but contacts are still unreadable.");
  await expect(page.getByRole("button", { name: "Retry recovery" })).toBeFocused();
  await expect(page.locator("#recovery-announcement")).not.toContainText("Recovery completed.");

  const values = await page.evaluate((key) => {
    const backupKey = Object.keys(localStorage).find((item) => item.startsWith(`${key}:recovery-backup:`));
    return { primary: localStorage.getItem(key), backup: backupKey ? localStorage.getItem(backupKey) : null };
  }, storageKey);
  expect(values.backup).toBe(raw);
  expect(JSON.parse(values.primary!).schemaVersion).toBe(1);
});

test("keeps the first-save privacy notice visible after empty recovery until a contact is saved", async ({ page }) => {
  const raw = '{"schemaVersion":99,"contacts":[{"id":"invalid","name":"Ada","phone":"letters","createdOrder":1}]}';
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: storageKey, value: raw });
  await signInForTest(page);
  await page.goto("/");

  const recoveryDialog = page.getByRole("dialog", { name: "Stored contacts need attention" });
  await expect(recoveryDialog).toContainText("No valid contacts could be recovered.");
  await page.getByRole("button", { name: "Back up original and recover" }).click();
  await expect(recoveryDialog).toBeHidden();
  await expect(page.locator("#recovery-announcement")).toHaveText("Recovery completed. The original data is preserved in a verified backup.");
  await expect(page.getByRole("heading", { name: "No contacts yet" })).toBeFocused();
  await expect(page.locator("#first-save-notice")).toBeVisible();
  await expect(page.locator("#first-save-notice")).toContainText(privacyNotice);
  await expect(page.getByRole("heading", { name: "No contacts yet" })).toBeVisible();
  await expect(page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).nextCreatedOrder, storageKey)).resolves.toBe(0);

  await page.getByRole("button", { name: "Add contact" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Ada Lovelace");
  await page.getByLabel("Phone number", { exact: true }).fill("1234567");
  await page.getByRole("button", { name: "Save contact" }).click();

  await expect(page.getByRole("heading", { name: "Ada Lovelace", level: 3 })).toBeVisible();
  await expect(page.locator("#first-save-notice")).toBeHidden();
});

test("blocks recovery accessibly if the original cannot be backed up", async ({ page }) => {
  const raw = '{"schemaVersion":99,"contacts":[]}';
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, value);
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (itemKey: string, nextValue: string): void {
      if (itemKey.startsWith(`${key}:recovery-backup:`)) throw new DOMException("Storage full", "QuotaExceededError");
      originalSetItem.call(this, itemKey, nextValue);
    };
  }, { key: storageKey, value: raw });
  await signInForTest(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Back up original and recover" }).click();

  await expect(page.getByRole("alert")).toContainText("original data could not be backed up");
  await expect(page.getByRole("button", { name: "Retry recovery" })).toBeVisible();
  await expect(page.evaluate((key) => localStorage.getItem(key), storageKey)).resolves.toBe(raw);
});

test("keeps failed changes visible, warns before unload, retries, and discards correctly", async ({ page }) => {
  await page.addInitScript((key) => {
    const originalSetItem = Storage.prototype.setItem;
    let failNextWrite = true;
    Storage.prototype.setItem = function (itemKey: string, value: string): void {
      if (itemKey === key && localStorage.getItem("test-fail-contact-save") === "true") {
        if (!failNextWrite) failNextWrite = true;
        else {
          failNextWrite = false;
          throw new DOMException("Storage full", "QuotaExceededError");
        }
      }
      originalSetItem.call(this, itemKey, value);
    };
    localStorage.setItem("test-fail-contact-save", "true");
  }, storageKey);
  await signInForTest(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Add contact" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Katherine Johnson");
  await page.getByLabel("Phone number", { exact: true }).fill("1234567");
  await page.getByRole("button", { name: "Save contact" }).click();

  await expect(page.getByRole("heading", { name: "Katherine Johnson", level: 3 })).toBeVisible();
  await expect(page.getByText(/Changes are not saved\./)).toBeVisible();
  const unloadPrevented = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(unloadPrevented).toBe(true);

  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(page.getByRole("button", { name: "Retry save" })).toBeHidden();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Katherine Johnson", level: 3 })).toBeVisible();

  await page.evaluate(() => localStorage.setItem("test-fail-contact-save", "true"));
  await page.getByRole("button", { name: "Edit Katherine Johnson" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Unsaved Contact");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Changes are not saved\./)).toBeVisible();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByRole("heading", { name: "Katherine Johnson", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unsaved Contact", level: 3 })).toHaveCount(0);
  const discardUnloadPrevented = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(discardUnloadPrevented).toBe(false);
});

test("reports storage read errors clearly", async ({ page }) => {
  const privateDetails = "Private contact: Ada Example, +1 234 567 8901";
  await page.addInitScript((key) => {
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (itemKey: string): string | null {
      if (itemKey === key) throw new DOMException("Private contact: Ada Example, +1 234 567 8901", "SecurityError");
      return originalGetItem.call(this, itemKey);
    };
  }, storageKey);
  await signInForTest(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Contacts are unavailable" })).toBeVisible();
  await expect(page.getByText("Contacts could not be read from browser storage.")).toBeVisible();
  await expect(page.getByText(privateDetails)).toHaveCount(0);
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInForTest } from "./support/auth";

const storageKey = "contact-management:contacts:v1";

async function expectNoAccessibilityViolations(page: import("@playwright/test").Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    elements: nodes.map(({ target }) => target),
  }))).toEqual([]);
}

test("has no automated WCAG A/AA violations in the main interactive states", async ({ page }) => {
  await signInForTest(page);
  await page.goto("/");
  await expectNoAccessibilityViolations(page);

  await page.getByRole("button", { name: "Add contact" }).click();
  await expectNoAccessibilityViolations(page);
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Add contact" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Ada");
  await page.getByLabel("Phone number", { exact: true }).fill("1234567");
  await page.getByRole("button", { name: "Save contact" }).click();
  await page.getByRole("button", { name: "Delete Ada" }).click();
  await expectNoAccessibilityViolations(page);
  await page.getByRole("button", { name: "Keep contact" }).click();

  await page.addInitScript((key) => localStorage.setItem(key, "not a valid document"), storageKey);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Stored contacts need attention" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

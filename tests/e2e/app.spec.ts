import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const hasData = fs.existsSync("data/data/patient-0000-0001/patient.json");
test.skip(!hasData, "Hackathon data folder missing (./data)");

async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("User name").fill(username);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/patients$/);
}

async function expectNoSeriousA11yIssues(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
}

async function chooseSituation(page: Page, label: RegExp) {
  await page.getByRole("combobox", { name: "Situation" }).click();
  await page.getByRole("option", { name: label }).click();
}

test("login page is accessible and rejects unknown users", async ({ page }) => {
  await page.goto("/login");
  await expectNoSeriousA11yIssues(page);
  await page.getByLabel("User name").fill("nobody");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Unknown user name.").first()).toBeVisible();
  // One-click demo users
  await page.getByRole("button", { name: /Breast surgeon/ }).click();
  await expect(page).toHaveURL(/\/patients$/);
});

test("unauthenticated pages redirect to login", async ({ page }) => {
  await page.goto("/patients/0000-0001");
  await expect(page).toHaveURL(/\/login$/);
});

test("anaesthetist: preset situation shows a sourced briefing", async ({ page }) => {
  await login(page, "anaesthesia");
  await expect(page.getByText("Dr. Alex Berger")).toBeVisible();
  await expectNoSeriousA11yIssues(page);
  await page.getByRole("link", { name: /Anna Musterfrau/ }).click();

  // Patient banner with age at the latest document and the CAVE alert
  await expect(page.getByRole("region", { name: "Patient" }).getByText(/57 years/)).toBeVisible();
  await expect(page.getByRole("button", { name: /KM-Allergie/ })).toBeVisible();

  await chooseSituation(page, /Pre-operative anaesthesia check/);
  await expect(page).toHaveURL(/situation=\d+/);

  // Sections fill in; every documented row has at least one source button
  const safety = page.locator('[data-section="safety"]');
  await expect(safety.getByRole("heading", { name: "Allergies and intolerances" })).toBeVisible();
  await expect(page.getByText(/Ready in/)).toBeVisible({ timeout: 15_000 });
  const rows = page.locator(".item-row--documented");
  expect(await rows.count()).toBeGreaterThan(3);
  for (const row of await rows.all()) await expect(row.getByRole("button", { name: /^Open source/ }).first()).toBeVisible();

  // "Not documented" is shown explicitly
  await expect(page.locator('[data-item="renal_function"]').getByText("Not documented")).toBeVisible();

  // The source opens beside the briefing with the passage highlighted
  const antithrombotic = page.locator('[data-item="antithrombotics"]');
  await antithrombotic.getByRole("button", { name: /^Open source/ }).first().click();
  const panel = page.getByRole("region", { name: "Source document" });
  await expect(panel.locator("mark.source-highlight").first()).toContainText("ASS");
  await expectNoSeriousA11yIssues(page);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  // Contradictions are not listed persistently, only as red boxes next to the affected facts
  await expect(page.locator(".contradiction")).toHaveCount(0);
  expect(await page.locator(".fact--contradiction").count()).toBeGreaterThan(0);
});

test("a fact's contradiction box opens the contradiction details", async ({ page }) => {
  await login(page, "ed");
  await page.goto("/patients/0000-0001");
  await chooseSituation(page, /Fall with a head injury/);
  await expect(page.getByText(/Ready in/)).toBeVisible({ timeout: 15_000 });
  const box = page.locator(".fact--contradiction").first();
  // A source tag inside the red box still opens the document, not the contradiction
  await box.getByRole("button", { name: /^Open source/ }).first().click();
  await expect(page.getByRole("region", { name: "Source document" })).toBeVisible();
  await expect(page.getByRole("dialog").locator(".contradiction")).toBeHidden();
  await page.keyboard.press("Escape");
  // Clicking the fact text in the red box opens the contradiction details
  await box.locator(".fact__statement").click();
  await expect(page.getByRole("dialog").locator(".contradiction")).toBeVisible();
  await page.keyboard.press("Escape");
  // The keyboard-reachable button does the same
  await page.getByRole("button", { name: /^Contradiction:/ }).first().click();
  await expect(page.getByRole("dialog").locator(".contradiction")).toBeVisible();
});

test("a new situation can be created and is selected", async ({ page }) => {
  await login(page, "pharmacist");
  await page.goto("/patients/0000-0001");
  await chooseSituation(page, /New situation/);
  const dialog = page.getByRole("dialog", { name: "New situation" });
  await dialog.getByLabel("Title").fill("Medication reconciliation");
  await dialog.getByLabel("Description").fill("Reconcile her medication before surgery in May 2016.");
  await dialog.getByRole("button", { name: "Save and open briefing" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/Clinical pharmacist/).first()).toBeVisible();
  await expect(page.locator('[data-section="meds"]')).toBeVisible();
  await expect(page.getByText(/Ready in/)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-item="current_medication"] .fact').first()).toBeVisible();
});

test("the screen changes with the role", async ({ page }) => {
  await login(page, "surgeon");
  await page.goto("/patients/0000-0001");
  await chooseSituation(page, /Explaining the biopsy result/);
  await expect(page.locator('[data-section="tumour"]')).toBeVisible();
  await expect(page.locator('[data-item="tumour_receptors"]')).toBeVisible();
  await expect(page.locator('[data-item="glucose_lowering"]')).toHaveCount(0);
});

test("logout returns to the login page", async ({ page }) => {
  await login(page, "gp");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("without a situation there is no briefing and no situation list, only the question bar", async ({ page }) => {
  await login(page, "nurse");
  await page.goto("/patients/0000-0001");
  await expect(page.getByRole("combobox", { name: "Situation" })).toHaveValue(/None/);
  await expect(page.locator(".briefing")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Nursing admission assessment/ })).toHaveCount(0);
  await expect(page.getByRole("search", { name: "Ask about this patient" })).toBeInViewport();
});

test("the question bar stays in the window while scrolling the briefing", async ({ page }) => {
  await login(page, "anaesthesia");
  await page.goto("/patients/0000-0001");
  await chooseSituation(page, /High blood pressure in the recovery room/);
  await expect(page.getByText(/Ready in/)).toBeVisible({ timeout: 15_000 });
  const bar = page.getByRole("search", { name: "Ask about this patient" });
  await expect(bar.getByRole("button", { name: /Which blood pressure drugs/ })).toBeVisible();
  await page.mouse.wheel(0, 1500);
  await expect(bar).toBeInViewport();
  await expectNoSeriousA11yIssues(page);
});

test("the briefing flows with the page and the question bar stays pinned to the bottom", async ({ page }) => {
  await login(page, "anaesthesia");
  await page.goto("/patients/0000-0001");
  await chooseSituation(page, /Pre-operative anaesthesia check/);
  await expect(page.getByText(/Ready in/)).toBeVisible({ timeout: 15_000 });
  const body = page.locator(".briefing__body");
  expect(await body.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  const bar = page.getByRole("search", { name: "Ask about this patient" });
  await expect(bar).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(bar).toBeInViewport();
});

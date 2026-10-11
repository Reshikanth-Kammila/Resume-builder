import { test, expect } from "@playwright/test";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("import, edit, persist, analyze, approve, tailor, ATS, export and restore", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A new space for your next chapter." }),
  ).toBeVisible();
  await page
    .locator('input[name="docx"]')
    .setInputFiles(path.resolve("tmp/e2e/import.docx"));
  await page
    .locator('input[name="pdf"]')
    .setInputFiles(path.resolve("tmp/e2e/reference.pdf"));
  await page.getByRole("button", { name: "Import my resume" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Mark import reviewed" }).click();
  await expect(page.getByRole("heading", { name: "My resume." })).toBeVisible();
  const summary = page.getByRole("textbox", {
    name: "Professional summary",
    exact: true,
  });
  const original = await summary.inputValue();
  const changed = original + " Built confirmed local tooling.";
  await summary.fill(changed);
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(summary).toHaveValue(changed);
  await page
    .getByRole("button", { name: "Undo edit" })
    .isDisabled()
    .then((disabled) => expect(disabled).toBe(true));
  await summary.fill(changed + " Another confirmed sentence.");
  await page.getByRole("button", { name: "Undo edit" }).click();
  await expect(summary).toHaveValue(changed);
  await page.getByRole("button", { name: "Redo edit" }).click();
  await expect(summary).toHaveValue(changed + " Another confirmed sentence.");
  await page.getByRole("button", { name: "Undo edit" }).click();
  await page.getByRole("button", { name: "Job Match", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Job title", exact: true })
    .fill("Python SDET");
  await page
    .getByRole("textbox", { name: "Company", exact: true })
    .fill("Test Opportunity");
  await page
    .getByRole("textbox", { name: "Job description", exact: true })
    .fill(
      "Required: Python and Selenium. Develop Python automation and regression testing pipelines. Preferred: Kubernetes and AWS.",
    );
  await page.getByRole("button", { name: "Analyze job" }).click();
  await expect(
    page.getByRole("heading", { name: "Python SDET", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No evidence", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Recommendations/ }).click();
  await page
    .getByRole("button", { name: "Approve change", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Approved · Undo", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create tailored version" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download this version" }).click();
  const download = await downloadPromise;
  const exportPath = path.resolve("tmp/e2e/tailored.pdf");
  await download.saveAs(exportPath);
  const python = path.resolve(
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  const inspection = execFileSync(
    python,
    [
      "-c",
      "import fitz,sys,json; p=fitz.open(sys.argv[1]); print(json.dumps({'text':' '.join(page.get_text() for page in p),'width':p[0].rect.width,'height':p[0].rect.height}))",
      exportPath,
    ],
    { encoding: "utf8" },
  );
  const pdf = JSON.parse(inspection);
  expect(pdf.text).toContain("Test Candidate");
  expect(pdf.text).toContain("100+");
  expect(pdf.width).toBeCloseTo(595.28, 0);
  expect(pdf.height).toBeCloseTo(841.89, 0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "My Resume", exact: true }).click();
  await expect(summary).toHaveValue(changed);
  await page.getByRole("button", { name: "ATS Analysis", exact: true }).click();
  await expect(
    page.getByText("Every finding, explained", { exact: true }),
  ).toBeVisible();
  const versions = await (await request.get("/api/versions")).json();
  await page.getByLabel("Analyzing").selectOption(versions[0].id);
  await expect(page.getByText("PDF verified", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Export History", exact: true })
    .click();
  await expect(
    page.getByText("Test_Candidate_Tailored.pdf", { exact: true }),
  ).toBeVisible();
  const backup = await request.get("/api/backup");
  expect(backup.status()).toBe(200);
  const restored = await request.post("/api/backup/restore", {
    multipart: {
      file: {
        name: "studio.zip",
        mimeType: "application/zip",
        buffer: await backup.body(),
      },
    },
  });
  expect(restored.status()).toBe(200);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "My Resume", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My resume." })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});

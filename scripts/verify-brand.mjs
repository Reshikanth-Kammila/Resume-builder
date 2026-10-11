import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

const base = process.env.STUDIO_TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "My resume." }).waitFor();
  const brand = page.getByRole("button", { name: "Reshi Resume Studio home" });
  assert.equal(await brand.locator('[data-brand="exact-fit"] path').count(), 2);
  assert.equal(
    await brand.locator('[data-brand="exact-fit"]').getAttribute("aria-hidden"),
    "true",
  );
  await mkdir("output/ui", { recursive: true });
  await page.screenshot({
    path: "output/ui/brand-desktop.png",
    animations: "disabled",
  });
  await brand.screenshot({
    path: "output/ui/brand-closeup.png",
    animations: "disabled",
  });

  const iconUrl = await page
    .locator('link[rel="icon"][type="image/svg+xml"]')
    .getAttribute("href");
  const iconResponse = await page.request.get(new URL(iconUrl, base).href);
  assert.equal(iconResponse.status(), 200);
  assert.match(await iconResponse.text(), /A48 48/);
  for (const variant of ["indigo", "black", "white"]) {
    const response = await page.request.get(
      `${base}/brand/reshi-symbol-${variant}.svg`,
    );
    assert.equal(response.status(), 200);
    assert.match(await response.text(), /A48 48/);
  }
  const source = await readFile("public/brand/reshi-symbol-indigo.svg", "utf8");
  const paths = [...source.matchAll(/ d="([^"]+)"/g)].map((match) => match[1]);
  const uiPaths = await brand
    .locator("svg path")
    .evaluateAll((elements) => elements.map((el) => el.getAttribute("d")));
  assert.deepEqual(uiPaths, paths);
  await page.getByRole("button", { name: "Hide sidebar" }).click();
  await page.locator(".breadcrumb-brand").waitFor({ state: "visible" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await brand.waitFor({ state: "visible" });
  await page.screenshot({
    path: "output/ui/brand-mobile-menu.png",
    animations: "disabled",
  });
  await brand.click();
  await page.locator(".breadcrumb-brand").waitFor({ state: "visible" });
  await page.screenshot({
    path: "output/ui/brand-mobile.png",
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      brand: "Exact Fit",
      variants: 3,
      favicon: "passed",
      desktop: "passed",
      mobile: "passed",
      geometry: "matches master",
      errors,
    }),
  );
} finally {
  await browser.close();
}

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "My resume." }).waitFor();
await page.locator("iframe").waitFor();
await page.waitForTimeout(700);
await mkdir("output/ui", { recursive: true });
await page.screenshot({
  path: "output/ui/resume-desktop.png",
  fullPage: true,
  animations: "disabled",
});
console.log(
  JSON.stringify({
    errors,
    heading: await page.locator("h1").innerText(),
    font: await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily),
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  }),
);
await page.getByRole("button", { name: "Job Match", exact: true }).click();
await page
  .getByRole("heading", { name: "Find where your story fits." })
  .waitFor();
await page.screenshot({
  path: "output/ui/job-match-desktop.png",
  fullPage: true,
  animations: "disabled",
});
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page.getByRole("heading", { name: "A little peace of mind." }).waitFor();
await page.screenshot({
  path: "output/ui/settings-desktop.png",
  fullPage: true,
  animations: "disabled",
});
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Open navigation" }).click();
await page.getByRole("button", { name: "My Resume", exact: true }).click();
await page.getByRole("heading", { name: "My resume." }).waitFor();
await page.waitForTimeout(700);
await page.screenshot({
  path: "output/ui/resume-mobile.png",
  fullPage: true,
  animations: "disabled",
});
console.log(
  JSON.stringify({
    mobileOverflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    errors,
  }),
);
await browser.close();

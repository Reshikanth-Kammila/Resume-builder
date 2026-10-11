import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
await page.goto(pathToFileURL(resolve("output/brand/preview-v2.html")).href, {
  waitUntil: "domcontentloaded",
});
await page.screenshot({
  path: "output/brand/preview-v2.png",
  fullPage: true,
});
const headings = await page.locator("h2, h3").allTextContents();
console.log(JSON.stringify({ headings, title: await page.title() }));
// Separate captures keep the size/background/rotation tests readable in review.
const height = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0, index = 1; y < height; y += 1000, index++) {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await page.screenshot({
    path: `output/brand/test-detail-${index}.png`,
  });
}
await browser.close();

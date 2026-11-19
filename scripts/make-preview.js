// Draws website/preview-800x600.png, the still shown to phone visitors, from a seeded game in mid-play.
// Run: serve the game (see AGENTS.md), then `NODE_PATH=<folder holding playwright> node scripts/make-preview.js`.
// Set CHROME to a Chromium binary if Playwright's own is not installed.
const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME });
  // 1280 x 960 at a scale of 0.625 gives 800 x 600 pixels with the desktop layout.
  const page = await browser.newPage({
    viewport: { width: 1280, height: 960 },
    deviceScaleFactor: 0.625,
  });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(`${process.env.GAME_URL || "http://localhost:8000/"}?seed=7`);
  await page.getByLabel("Show the walkthrough").uncheck({ force: true });
  await page.getByRole("button", { name: "Open the workshop" }).click();
  await page.click('[data-ai="0,1"]');
  await page.click('[data-checking="1"]');
  await page.waitForTimeout(15000);
  await page.screenshot({
    path: path.join(__dirname, "..", "website", "preview-800x600.png"),
  });
  await browser.close();
})();

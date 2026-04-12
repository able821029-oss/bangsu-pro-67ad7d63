import { test, expect } from "@playwright/test";

test("diagnose page error", async ({ page }) => {
  const errors: string[] = [];
  const consoleMessages: string[] = [];

  page.on("pageerror", (err) => {
    errors.push(`PAGE_ERROR: ${err.message}\nSTACK: ${err.stack}`);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleMessages.push(`CONSOLE_ERROR: ${msg.text()}`);
    }
  });

  await page.addInitScript(() => {
    localStorage.setItem("sms_onboarded", "true");
  });

  await page.goto("http://localhost:5173");
  await page.waitForTimeout(3000);

  const bodyText = await page.textContent("body").catch(() => "empty");
  const title = await page.title().catch(() => "no title");

  console.log("Title:", title);
  console.log("Body length:", bodyText?.length);
  console.log("Body preview:", bodyText?.slice(0, 200));

  if (errors.length > 0) {
    console.log("\n=== PAGE ERRORS ===");
    errors.forEach(e => console.log(e));
  }
  if (consoleMessages.length > 0) {
    console.log("\n=== CONSOLE ERRORS ===");
    consoleMessages.forEach(e => console.log(e));
  }

  // Capture screenshot regardless
  await page.screenshot({ path: "e2e/screenshots/diagnose.png" });

  console.log("All errors count:", errors.length + consoleMessages.length);
});

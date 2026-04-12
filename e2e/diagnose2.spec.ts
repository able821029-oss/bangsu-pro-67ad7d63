import { test } from "@playwright/test";

test("diagnose sms-app at 5174", async ({ page }) => {
  const errors: string[] = [];

  page.on("pageerror", (err) => {
    errors.push(`PAGE_ERROR: ${err.message}\nSTACK: ${err.stack}`);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`CONSOLE_ERROR: ${msg.text()}`);
    }
  });

  await page.addInitScript(() => {
    localStorage.setItem("sms_onboarded", "true");
  });

  await page.goto("http://localhost:5174");
  await page.waitForTimeout(4000);

  const bodyText = await page.textContent("body").catch(() => "empty");
  const title = await page.title().catch(() => "no title");

  console.log("Title:", title);
  console.log("Body length:", bodyText?.length);
  console.log("Body preview:", bodyText?.slice(0, 300));

  if (errors.length > 0) {
    console.log("\n=== ERRORS ===");
    errors.forEach(e => console.log(e));
  } else {
    console.log("No errors!");
  }

  await page.screenshot({ path: "e2e/screenshots/diagnose2.png" });
});

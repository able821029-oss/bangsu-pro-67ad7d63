const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await ctx.addInitScript(() => {
    localStorage.setItem('sms_onboarded', 'true');
    localStorage.setItem('sms_dev_test_mode', '1');
  });
  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);  // splash passes
  console.log('BEFORE CALENDAR CLICK:');
  console.log((await page.locator('body').innerText()).slice(0, 200));
  // Click Calendar tab
  await page.getByLabel('일정').first().click();
  await page.waitForTimeout(1500);
  console.log('\nAFTER CALENDAR CLICK:');
  console.log((await page.locator('body').innerText()).slice(0, 400));
  console.log('\nERRORS:', errors.length ? errors.slice(0,6) : 'none');
  await page.screenshot({ path: 'cal-click.png', fullPage: true });
  await browser.close();
})();

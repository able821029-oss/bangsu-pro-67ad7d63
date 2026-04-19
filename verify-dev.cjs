const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('ERR:', e.message));
  // Skip onboarding via localStorage before navigating
  await page.goto('http://localhost:8080/', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('sms_onboarding_shown', 'true'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'dev-1-login.png', fullPage: true });
  const bodyText = (await page.locator('body').innerText()).slice(0, 800);
  console.log('BODY:', bodyText);
  const count = await page.getByText('개발 테스트').count();
  console.log('Dev button count:', count);
  if (count > 0) {
    await page.getByText('개발 테스트').first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'dev-2-home.png', fullPage: true });
    const home = (await page.locator('body').innerText()).slice(0, 400);
    console.log('HOME:', home);
  }
  await browser.close();
})();

const { chromium } = require('playwright');
const path = require('path');

const svg = (size) => `
<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent}</style>
</head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#060D1F"/>
      <stop offset="60%" stop-color="#0E0720"/>
      <stop offset="100%" stop-color="#150822"/>
    </linearGradient>
    <linearGradient id="sGrad" x1="80" y1="80" x2="432" y2="432" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#237FFF"/>
      <stop offset="52%" stop-color="#6C5CE7"/>
      <stop offset="100%" stop-color="#AB5EBE"/>
    </linearGradient>
    <radialGradient id="glow" cx="256" cy="256" r="220" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#237FFF" stop-opacity="0.18"/>
      <stop offset="60%" stop-color="#AB5EBE" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#AB5EBE" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)"/>
  <circle cx="256" cy="256" r="220" fill="url(#glow)"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="Arial Black, Helvetica Neue, sans-serif" font-weight="900"
        font-size="380" fill="url(#sGrad)">S</text>
</svg>
</body></html>`;

(async () => {
  const browser = await chromium.launch();
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(svg(size), { waitUntil: 'networkidle' });
    const out = path.resolve(__dirname, `../public/icon-${size}.png`);
    await page.locator('svg').screenshot({ path: out, omitBackground: true });
    console.log('Wrote', out);
    await page.close();
  }
  await browser.close();
})();

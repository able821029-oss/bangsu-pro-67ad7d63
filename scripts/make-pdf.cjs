const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const src = process.argv[2] || 'client-checklist.html';
  const dst = process.argv[3] || '클라이언트_출시준비_체크리스트.pdf';
  const html = fs.readFileSync(path.resolve(__dirname, '../docs/' + src), 'utf8');
  await page.setContent(html, { waitUntil: 'networkidle' });
  const out = path.resolve(__dirname, '../docs/' + dst);
  await page.pdf({
    path: out,
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
  });
  await browser.close();
  console.log('PDF:', out);
})();

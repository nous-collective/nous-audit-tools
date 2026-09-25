// Eklenti ikonlarını üretir: node tools/make-icons.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  const data = await page.evaluate((s) => {
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const k = s / 128;
    g.scale(k, k);
    g.fillStyle = '#c8102e';
    g.beginPath();
    g.roundRect(0, 0, 128, 128, 26);
    g.fill();
    // araba gövdesi
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(18, 84);
    g.lineTo(18, 66);
    g.quadraticCurveTo(20, 58, 30, 56);
    g.lineTo(40, 38);
    g.quadraticCurveTo(44, 32, 52, 32);
    g.lineTo(80, 32);
    g.quadraticCurveTo(88, 32, 92, 38);
    g.lineTo(102, 56);
    g.quadraticCurveTo(110, 58, 110, 66);
    g.lineTo(110, 84);
    g.closePath();
    g.fill();
    // camlar
    g.fillStyle = '#c8102e';
    g.beginPath();
    g.moveTo(46, 54);
    g.lineTo(53, 40);
    g.lineTo(62, 40);
    g.lineTo(62, 54);
    g.closePath();
    g.moveTo(68, 54);
    g.lineTo(68, 40);
    g.lineTo(79, 40);
    g.lineTo(86, 54);
    g.closePath();
    g.fill();
    // tekerlekler
    for (const x of [38, 90]) {
      g.fillStyle = '#1c1f24';
      g.beginPath();
      g.arc(x, 86, 13, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(x, 86, 5, 0, Math.PI * 2);
      g.fill();
    }
    return c.toDataURL('image/png');
  }, size);
  writeFileSync(`extension/icons/icon${size}.png`, Buffer.from(data.split(',')[1], 'base64'));
}
await browser.close();

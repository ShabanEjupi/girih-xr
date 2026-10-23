// The endless dive in a browser: it draws three strap layers, the wheel and the Dive button go down level after
// level without the layers emptying or the page erroring, zooming out climbs back, the phone fits. Screenshots → <out>.
//   node zoom.mjs <base-url> <out-dir>
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let fail = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail = 1; };
for (const [label, vp] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp, locale: label === 'phone' ? 'sq-AL' : 'en-US' });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await p.goto(`${base}/zoom.html`); await p.waitForFunction(() => window.zoom);
  await p.waitForTimeout(600);
  const l0 = await p.evaluate(() => zoom.layers);
  ok(l0[0] > 50 && l0[1] > l0[0] && l0[2] > l0[1], `${label}: three strap layers at the start (${l0.join(", ")})`);
  await p.screenshot({ path: `${out}/zoom-${label}-0.png` });
  await p.mouse.move(vp.width / 2, vp.height / 2);
  for (let i = 0; i < 40; i++) await p.mouse.wheel(0, -120);
  await p.waitForTimeout(300);
  const lv = await p.evaluate(() => [zoom.level, zoom.layers]);
  ok(lv[0] >= 5 && lv[1].every(n => n > 20), `${label}: the wheel dives to level ${lv[0]}, every layer still drawn (${lv[1].join(', ')})`);
  await p.screenshot({ path: `${out}/zoom-${label}-1.png` });
  await p.evaluate(() => { for (let i = 0; i < 400; i++) zoom.zoomAt(1.6); });
  const deep = await p.evaluate(() => [zoom.level, zoom.layers]);
  ok(deep[0] > 300 && deep[1][0] > 20, `${label}: ${deep[0]} levels down (×10^${Math.floor(deep[0] * Math.log10((1 + Math.sqrt(5)) / 2))}), the girih is still there (${deep[1].join(', ')})`);
  await p.screenshot({ path: `${out}/zoom-${label}-deep.png` });
  await p.evaluate(() => { for (let i = 0; i < 30; i++) zoom.zoomAt(1 / 1.6); });
  const back = await p.evaluate(() => zoom.level);
  ok(back < deep[0] - 20, `${label}: zooming out climbs back up (${deep[0]} → ${back})`);
  await p.click('#dive'); await p.waitForTimeout(3000); await p.click('#dive');
  ok((await p.evaluate(() => zoom.level)) >= back, `${label}: the Dive button keeps going down`);
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(w <= vp.width, `${label}: no sideways scroll (${w})`);
  ok(!errors.length, `${label}: no errors ${errors.join(' | ')}`);
}
await b.close();
process.exit(fail);

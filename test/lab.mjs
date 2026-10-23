// Quasicrystal Lab end-to-end with a mouse: the tiling draws, dragging it flips rhombs, every mission is solved by
// moving the sliders to the hidden answer, the free lab opens, nothing errors. Screenshots go to <out>.
//   node lab.mjs <base-url> <out-dir>
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let fail = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail = 1; };
for (const [label, vp] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await p.goto(`${base}/lab.html`); await p.waitForFunction(() => window.lab);
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/lab-${label}-0.png` });
  ok((await p.evaluate(() => lab.mission)) === 0, `${label}: opens at mission 1`);
  await p.mouse.move(vp.width * 0.3, vp.height * 0.4); await p.mouse.down();
  for (let i = 1; i <= 12; i++) await p.mouse.move(vp.width * 0.3 + i * 6, vp.height * 0.4 + i * 3);
  await p.mouse.up(); await p.waitForTimeout(100);
  const fl = await p.evaluate(() => lab.flipping);
  ok(fl > 0, `${label}: dragging the tiling slides the 5D cut and flips ${fl} rhombs`);
  await p.screenshot({ path: `${out}/lab-${label}-flip.png` });
  for (let k = 0; k < 3; k++) {
    const a = await p.evaluate(() => lab.answer()), s0 = await p.evaluate(() => lab.score);
    // Move only the free sliders, through the UI, to just next to the answer.
    if (await p.isVisible('#theta')) await p.fill('#theta', String(Math.round((a.theta + 0.5) * 2) / 2));
    if (await p.isVisible('#phi')) await p.fill('#phi', String(a.phi + 0.25));
    await p.waitForTimeout(300);
    const s1 = await p.evaluate(() => lab.score);
    ok(s1 > s0 && (await p.locator('.msg').textContent()).includes('θ ='), `${label}: mission ${k + 1} solved (match ${s0.toFixed(2)} → ${s1.toFixed(3)})`);
    if (k === 2) await p.screenshot({ path: `${out}/lab-${label}-solved.png` });
    await p.waitForFunction(n => lab.mission === n, k + 1, { timeout: 6000 });
  }
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/lab-${label}-free.png` });
  ok(await p.isVisible('#theta') && await p.isVisible('#phi'), `${label}: free lab opens with both controls`);
  ok(!errors.length, `${label}: no errors ${errors.join(' | ')}`);
  await p.close();
}
await b.close(); process.exit(fail);

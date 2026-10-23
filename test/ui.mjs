// End-to-end with a mouse: solve every level by dragging each tile onto its slot (rotating with Q), checking that
// tiles snap, decoys stay loose, levels advance, and nothing errors. Screenshots go to <out>.
//   node ui.mjs <base-url> <out-dir>
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let fail = 0;
for (const [label, vp] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp });
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await p.goto(base); await p.waitForFunction(() => window.girih);
  await p.screenshot({ path: `${out}/${label}-0.png` });
  for (let lv = 0; lv < 3; lv++) {
    await p.waitForFunction(n => window.girih.level === n, lv, { timeout: 15000 });
    const slots = await p.evaluate(() => window.girih.slots());
    for (const [si, s] of slots.entries()) {
      const pcs = await p.evaluate(() => window.girih.pieces());
      const pi = pcs.findIndex(q => q.kind === s.kind && q.placed < 0);
      const q = pcs[pi];
      const [x0, y0] = await p.evaluate(([x, y]) => window.girih.toScreen(x, y), [q.x, q.y]);
      const [x1, y1] = await p.evaluate(([x, y]) => window.girih.toScreen(x, y), [s.x, s.y]);
      const sym = { decagon: 36, pentagon: 72 }[s.kind] || 180;
      const k = Math.round((((s.r - q.r) % sym) + sym) % sym / 36);
      await p.mouse.move(x0, y0); await p.mouse.down();
      await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 });
      for (let i = 0; i < k; i++) await p.keyboard.press('q');
      await p.mouse.move(x1, y1, { steps: 4 }); await p.mouse.up();
      const now = await p.evaluate(i => window.girih.pieces()[i].placed, pi);
      if (now < 0) { console.log(`✗ ${label} level ${lv + 1}: ${s.kind} did not snap`); fail = 1; }
    }
    await p.screenshot({ path: `${out}/${label}-level${lv + 1}.png` });
    const loose = await p.evaluate(() => window.girih.pieces().filter(q => q.placed < 0).map(q => q.kind));
    console.log(`${label} level ${lv + 1}: all ${slots.length} slots filled; loose decoys: ${loose.join(', ')}`);
  }
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log(label, 'errors', errors.length, errors.slice(0, 3), 'h-overflow', overflow);
  if (errors.length || overflow) fail = 1;
  await p.close();
}
await b.close();
process.exit(fail);

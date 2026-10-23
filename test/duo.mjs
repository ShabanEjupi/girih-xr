// Lab for two, two real browsers through the deployed relay: both see "2 here", a slide at one end arrives at the
// other, a newcomer takes the room's crystal instead of overwriting it, simultaneous turns of θ end in the same value
// at both ends, and one person's mouse shows as a fingertip on the other's crystal.
//   node duo.mjs <base-url> <out-dir>
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let fail = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail = 1; };
const room = 'duo' + Math.random().toString(36).slice(2, 9).replace(/[^a-z0-9]/g, '0');
const errors = [];
const open = async () => {
  const p = await b.newPage({ viewport: { width: 1100, height: 760 } });
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(`${base}/lab.html?room=${room}`); await p.waitForFunction(() => window.lab);
  return p;
};
const until = async (p, fn, arg, ms = 5000) => { try { await p.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; } };

const A = await open();
await A.waitForTimeout(800);
await A.click('#next');                                            // A goes to the free lab and moves the cut
await A.evaluate(() => lab.slide(0.21, -0.13));
await A.waitForTimeout(500);
const B = await open();                                            // B arrives later, from mission 1 on its own device
const pa = await A.evaluate(() => lab.p);
ok(await until(B, pa => Math.abs(lab.p[0] - pa[0]) < 1e-9 && Math.abs(lab.p[1] - pa[1]) < 1e-9, pa), `the newcomer takes the room's crystal (p = ${pa.map(x => x.toFixed(2))}), not its own start`);
ok(await until(A, () => lab.peers === 2) && await until(B, () => lab.peers === 2), 'both see "2 here"');
ok(/2/.test(await B.textContent('#duo')), `the button says so: "${await B.textContent('#duo')}"`);
await B.evaluate(() => lab.slide(-0.4, 0.3));
const pb = await B.evaluate(() => lab.p);
ok(await until(A, pb => Math.abs(lab.p[0] - pb[0]) < 1e-9, pb), 'a slide at one end arrives at the other');
// Both turn θ at the same moment, to different values: they must agree afterwards.
const agreed = [];
for (const [x, y] of [[33, 61], [70, 25], [44, 52], [28, 77], [60, 36]]) {
  await Promise.all([A.evaluate(v => lab.set(v), x), B.evaluate(v => lab.set(v), y)]);
  await A.waitForTimeout(1500);
  const [ta, tb] = await Promise.all([A.evaluate(() => lab.theta), B.evaluate(() => lab.theta)]);
  if (Math.abs(ta - tb) < 1e-9 && [x, y].some(v => Math.abs(ta - v) < 0.6)) agreed.push(ta.toFixed(1));
}
ok(agreed.length === 5, `simultaneous turns of θ, five rounds: both ends agree every time (${agreed.join('°, ')}°)`);
// Sweep the mouse over A's crystal (wherever the layout put it) and watch B.
const box = await A.evaluate(() => lab.discBox());
for (let i = 0; i <= 6; i++) { await A.mouse.move(box[0] + (box[2] - box[0]) * (0.3 + i * 0.07), box[1] + (box[3] - box[1]) * 0.5); await A.waitForTimeout(90); }
ok(await until(B, () => lab.ghosts > 0), "one person's mouse shows as a fingertip on the other's crystal");
await B.screenshot({ path: `${out}/duo-b.png` });
await A.goto('about:blank');                                     // leaving the page: pagehide sends the goodbye
ok(await until(B, () => lab.peers === 1), 'when one leaves, the other sees "1 here"');
ok(!errors.length, `no errors ${errors.join(' | ')}`);
await b.close(); process.exit(fail);

// The endless dive with hands only, in Meta's emulator (IWER, Quest 3): in VR, pinching with both hands and pulling
// apart zooms in; in mixed reality, a gaze ring finds the wall (a stand-in room from zoom-xr.html?wall=1), a pinch pins
// the girih flat on it facing the room, and the two-hand zoom still works there. Without a room it falls back to floating.
//   node zoom-hands.mjs <base-url> <out-dir>
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let fail = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail = 1; };

async function open(query) {
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(`${base}/test/zoom-xr.html${query}`);
  await p.waitForFunction(() => window.zoom && window.xrDevice);
  await p.waitForTimeout(500);
  const step = (hand, src) => p.evaluate(([h, s]) => new Function('H', s)(window.xrDevice.hands[h]), [hand, src]);
  return { p, errors, step };
}
const mag = p => p.evaluate(() => zoom.level + Math.log(zoom.s) / Math.log((1 + Math.sqrt(5)) / 2));
async function pullApart({ p, step }) {
  await step('left', 'H.position.set(-0.05, 1.3, -0.45)'); await step('right', 'H.position.set(0.05, 1.3, -0.45)');
  await p.waitForTimeout(300);
  await step('left', 'H.updatePinchValue(1)'); await step('right', 'H.updatePinchValue(1)'); await p.waitForTimeout(300);
  const m0 = await mag(p);
  for (let i = 0; i < 10; i++) {
    await step('left', 'H.position.set(H.position.x - 0.015, H.position.y, H.position.z)');
    await step('right', 'H.position.set(H.position.x + 0.015, H.position.y, H.position.z)');
    await p.waitForTimeout(80);
  }
  const m1 = await mag(p);
  await step('left', 'H.updatePinchValue(0)'); await step('right', 'H.updatePinchValue(0)'); await p.waitForTimeout(300);
  return [m0, m1];
}

{ // VR
  const t = await open('');
  await t.p.click('#enter'); await t.p.waitForTimeout(1500);
  const [m0, m1] = await pullApart(t);
  ok(m1 - m0 > 1, `VR: both hands pinch and pull apart → ${(m1 - m0).toFixed(2)} levels deeper`);
  ok(!t.errors.length, `VR: no errors ${t.errors.join(' | ')}`);
  await t.p.close();
}
{ // MR with a wall
  const t = await open('?wall=1');
  ok(await t.p.isVisible('#mr'), 'MR: the "Pin to a wall" button shows on a headset that has passthrough');
  await t.p.click('#mr'); await t.p.waitForTimeout(1500);
  ok(await t.p.evaluate(() => zoom.mr && !zoom.pinned), 'MR: the session starts unpinned, the ring looks for a surface');
  ok(/wall/.test(await t.p.textContent('#tip')), 'MR: the tip asks to look at a wall or table and pinch');
  await t.step('right', 'H.position.set(0.15, 1.3, -0.4)'); await t.p.waitForTimeout(300);
  await t.step('right', 'H.updatePinchValue(1)'); await t.p.waitForTimeout(250);
  await t.step('right', 'H.updatePinchValue(0)'); await t.p.waitForTimeout(500);
  const f = await t.p.evaluate(() => zoom.pinned && zoom.facing);
  ok(f && Math.abs(f.at[2] + 1.2) < 0.02, `MR: a pinch pins the girih on the wall (z = ${f && f.at[2].toFixed(3)})`);
  ok(f && f.normal[2] > 0.99, `MR: it lies flat on the wall, facing the room (normal ${f && f.normal.map(x => x.toFixed(2))})`);
  await t.step('left', 'H.position.set(-0.05, 1.6, -0.9)'); await t.step('right', 'H.position.set(0.05, 1.6, -0.9)');
  const [m0, m1] = await pullApart({ ...t, step: async (h, s) => t.step(h, s.replace('1.3, -0.45', '1.6, -0.9')) });
  ok(m1 - m0 > 1, `MR: the two-hand zoom works on the wall → ${(m1 - m0).toFixed(2)} levels deeper`);
  await t.p.screenshot({ path: `${out}/zoom-mr.png` });
  ok(!t.errors.length, `MR: no errors ${t.errors.join(' | ')}`);
  await t.p.close();
}
{ // MR without any room data: no ring to wait for, it floats in front instead
  const t = await open('');
  if (await t.p.isVisible('#mr')) {
    await t.p.click('#mr'); await t.p.waitForTimeout(1500);
    ok(await t.p.evaluate(() => zoom.mr && zoom.pinned), 'MR without hit-test: falls back to floating in front, nothing to wait for');
  }
  ok(!t.errors.length, `MR fallback: no errors ${t.errors.join(' | ')}`);
  await t.p.close();
}
await b.close();
process.exit(fail);

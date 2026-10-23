// Hands-only end-to-end in Meta's emulator (IWER): for every slot of level 1, pinch a loose tile with the right
// hand, carry it over, turn the wrist until the tile faces the right way, release, and check that it snapped.
//   node hands.mjs <base-url> <out-dir>      (base serves the repo; test/iwer.module.js must exist)
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto(`${base}/test/xr.html`);
await p.waitForFunction(() => window.girih && window.xrDevice);
await p.click('#enter');
await p.waitForFunction(() => window.girih.tips().some(Boolean), null, { timeout: 20000 });

// Helpers that run in the page: move the right hand so its pinch point lands on a world target, pinch, turn.
await p.evaluate(() => {
  const d = window.xrDevice, R = d.hands.right, L = d.hands.left;
  L.position.set(-0.6, 0.6, 0.4);                                   // keep the left hand out of the way
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const mid = () => {                                               // the tracked hand nearest the right hand
    const t = window.girih.tips(), hs = [[t[0], t[1]], [t[2], t[3]]].filter(([a, b]) => a && b)
      .map(([a, b]) => a.map((v, i) => (v + b[i]) / 2));
    const rp = [R.position.x, R.position.y, R.position.z];
    return hs.sort((a, b) => Math.hypot(...a.map((v, i) => v - rp[i])) - Math.hypot(...b.map((v, i) => v - rp[i])))[0];
  };
  window.hand = {
    async to(target) {
      for (let k = 0; k < 6; k++) {
        await wait(120);
        const m = mid(); if (!m) continue;
        R.position.set(R.position.x + target[0] - m[0], R.position.y + target[1] - m[1], R.position.z + target[2] - m[2]);
      }
      await wait(150);
      const m = mid(); return Math.hypot(...m.map((v, i) => v - target[i]));
    },
    async grabAt(target) {                                         // the PINCHED point lands on target, then pinch
      R.updatePinchValue(1); await wait(300);
      const m = mid(), d = [m[0] - R.position.x, m[1] - R.position.y, m[2] - R.position.z];
      R.updatePinchValue(0); R.position.set(R.position.x, R.position.y + 0.25, R.position.z); await wait(300);
      R.position.set(target[0] - d[0], target[1] - d[1], target[2] - d[2]); await wait(300);
      R.updatePinchValue(1); await wait(300);
    },
    async carry(i, x, y) {                                         // move the hand until the HELD tile sits on (x, y)
      for (let k = 0; k < 6; k++) {
        await wait(120);
        const q = window.girih.pieces()[i], S = window.girih.S;
        const [wx, wy, wz] = window.girih.toWorld(q.x, q.y, 0), [tx, ty, tz] = window.girih.toWorld(x, y, 0);
        R.position.set(R.position.x + tx - wx, R.position.y + ty - wy, R.position.z + tz - wz);
      }
      await wait(150);
    },
    async pinch(v) { R.updatePinchValue(v); await wait(300); },
    async turn(deg) {                                               // rotate the hand about the board's normal
      const [nx, ny, nz] = window.girih.normal(), h = deg * Math.PI / 360, s = Math.sin(h);
      const a = { x: nx * s, y: ny * s, z: nz * s, w: Math.cos(h) }, q = R.quaternion;
      const r = { w: a.w * q.w - a.x * q.x - a.y * q.y - a.z * q.z, x: a.w * q.x + a.x * q.w + a.y * q.z - a.z * q.y,
                  y: a.w * q.y - a.x * q.z + a.y * q.w + a.z * q.x, z: a.w * q.z + a.x * q.y - a.y * q.x + a.z * q.w };
      R.quaternion.set(r.x, r.y, r.z, r.w); await wait(250);
    },
  };
});

let fail = 0;
const slots = await p.evaluate(() => window.girih.slots());
for (const s of slots) {
  const pcs = await p.evaluate(() => window.girih.pieces());
  const i = pcs.findIndex(q => q.kind === s.kind && q.placed < 0), q = pcs[i];
  const at = await p.evaluate(([x, y]) => window.girih.toWorld(x, y, 0.5), [q.x, q.y]);
  const err = await p.evaluate(t => window.hand.to(t), at);
  await p.evaluate(t => window.hand.grabAt(t), at);
  await p.evaluate(([i, x, y]) => window.hand.carry(i, x, y), [i, s.x, s.y]);
  // Turn the wrist 36° at a time until the tile faces the slot (any symmetric orientation counts).
  const sym = { decagon: 36, pentagon: 72 }[s.kind] || 180;
  let turns = 0;
  for (; turns < 10; turns++) {
    const r = await p.evaluate(i => window.girih.pieces()[i].r, i);
    const off = (((r - s.r) % sym) + sym) % sym; if (Math.min(off, sym - off) < 5) break;
    await p.evaluate(() => window.hand.turn(36));
  }
  await p.evaluate(([i, x, y]) => window.hand.carry(i, x, y), [i, s.x, s.y]);
  const before = await p.evaluate(i => window.girih.pieces()[i], i);
  await p.evaluate(() => window.hand.pinch(0));
  const after = await p.evaluate(i => window.girih.pieces()[i], i);
  if (process.env.DEBUG) console.log('  slot', s.x.toFixed(2), s.y.toFixed(2), s.r.toFixed(0), 'held', before.x.toFixed(2), before.y.toFixed(2), before.r.toFixed(0), 'after', after.x.toFixed(2), after.y.toFixed(2), after.r.toFixed(0), JSON.stringify(await p.evaluate(() => window.girih.tips())));
  const placed = await p.evaluate(i => window.girih.pieces()[i].placed, i);
  console.log(`${placed >= 0 ? '✓' : '✗'} ${s.kind}: reach error ${(err * 1000).toFixed(1)} mm, wrist turns ${turns}, snapped ${placed >= 0}`);
  if (placed < 0) fail = 1;
}
await p.screenshot({ path: `${out}/hands-level1.png` });
await p.waitForFunction(() => window.girih.level === 1, null, { timeout: 10000 }).then(() => console.log('✓ level 2 opened after the pattern was completed'), () => { console.log('✗ level did not advance'); fail = 1; });
console.log('errors', errors.length, errors.slice(0, 3));
await b.close();
process.exit(fail || errors.length ? 1 : 0);

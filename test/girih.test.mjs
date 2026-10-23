// node test/girih.test.mjs — geometry invariants the game relies on.
import { TILES, outline, placed, LEVELS, overlap, fits, attach, angleOff } from '../girih.js';
let fail = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail = 1; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

for (const k of Object.keys(TILES)) {
  const p = outline(k), n = p.length;
  const edges = p.map((v, i) => Math.hypot(p[(i + 1) % n][0] - v[0], p[(i + 1) % n][1] - v[1]));
  ok(edges.every(e => near(e, 1, 1e-9)), `${k}: ${n} unit edges, closes`);
  const area = p.reduce((s, v, i) => s + v[0] * p[(i + 1) % n][1] - p[(i + 1) % n][0] * v[1], 0) / 2;
  ok(area > 0, `${k}: counter-clockwise (area ${area.toFixed(3)})`);
}
for (const [i, L] of LEVELS.entries()) {
  const polys = L.slots.map(placed);
  let clash = 0;
  for (let a = 0; a < polys.length; a++) for (let b = a + 1; b < polys.length; b++) if (overlap(polys[a], polys[b], 1e-6)) clash++;
  ok(clash === 0, `level ${i + 1}: ${L.slots.length} slots, no overlaps`);
  ok(L.decoys.every(d => !L.slots.some(s => s.kind === d)), `level ${i + 1}: decoys fit no slot`);
}
// The full ring closes: pentagon i and i+1 share an edge, so every decagon vertex is 144+108+108 = 360.
const ring = LEVELS[2].slots.slice(1).map(placed);
const shared = (A, B) => A.filter(a => B.some(b => near(a[0], b[0], 1e-6) && near(a[1], b[1], 1e-6))).length;
ok(ring.every((A, i) => shared(A, ring[(i + 1) % 10]) === 2), 'level 3: neighbouring pentagons share an edge');
const s = LEVELS[0].slots[1];
ok(fits('pentagon', s.x + 0.1, s.y, s.r + 72 * 3 + 5, s), 'fits: pentagon turned by its symmetry still fits');
ok(!fits('pentagon', s.x, s.y, s.r + 36, s), 'fits: pentagon off by 36° does not');
ok(!fits('rhombus', s.x, s.y, s.r, s), 'fits: wrong shape does not');
ok(near(angleOff(350, 10, 360), 20), 'angleOff wraps');
const dec = LEVELS[0].slots[0];
ok(overlap(placed(dec), placed({ ...dec, x: 0.5 })), 'overlap: detects a real overlap');
process.exit(fail);

// node test/quasi.test.mjs — the physics and geometry the Quasicrystal Lab claims.
import { pentagrid, gammas, flips, hankin, samples, diffraction, intensity, similarity, MISSIONS, SOLVED } from '../quasi.js';
let fail = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail = 1; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const DEG = Math.PI / 180;

const T = pentagrid(7);
ok(T.length > 150, `pentagrid(7): ${T.length} rhombs`);
const edgeOk = T.every(({ v }) => v.every((a, i) => near(Math.hypot(v[(i + 1) % 4][0] - a[0], v[(i + 1) % 4][1] - a[1]), 1)));
ok(edgeOk, 'every rhomb has four unit edges');
const angle = ({ v }) => Math.acos((v[1][0] - v[0][0]) * (v[3][0] - v[0][0]) + (v[1][1] - v[0][1]) * (v[3][1] - v[0][1])) / DEG;
ok(T.every(t => { const a = angle(t), m = Math.min(a, 180 - a); return t.thick ? near(m, 72, 1e-6) : near(m, 36, 1e-6); }), 'thick rhombs 72°/108°, thin 36°/144°');

// No gaps, no overlaps: points in a disc well inside the patch are covered by exactly one rhomb.
const inside = ({ v }, [x, y]) => v.every((a, i) => { const b = v[(i + 1) % 4]; return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) >= -1e-9; });
let cover = true;
for (let i = 0; i < 400; i++) { const r = 4 * Math.sqrt((i * 0.618) % 1), a = i * 2.399; const p = [r * Math.cos(a), r * Math.sin(a)]; if (T.filter(t => inside(t, p)).length !== 1) cover = false; }
ok(cover, '400 sample points inside r=4: each covered by exactly one rhomb (no gaps, no overlaps)');

const big = pentagrid(14), thick = big.filter(t => t.thick).length, ratio = thick / (big.length - thick);
ok(Math.abs(ratio - 1.618) < 0.05, `thick : thin = ${ratio.toFixed(3)} (golden ratio 1.618, the signature of aperiodicity)`);

const moved = pentagrid(7, gammas([0.06, -0.03]));
const f = flips(T, moved);
ok(f.length > 0 && f.length < moved.length / 2, `phason shift: ${f.length} of ${moved.length} rhombs flip, the rest stay`);
ok(moved.every(({ v }) => v.every((a, i) => near(Math.hypot(v[(i + 1) % 4][0] - a[0], v[(i + 1) % 4][1] - a[1]), 1))), 'after the shift it is still a unit-edge rhomb tiling');

const seg = hankin(T, 54 * DEG);
ok(seg.length > 4 * T.length, `Hankin at 54°: ${seg.length} strapwork segments`);
ok(seg.every(([a, b]) => T.some(t => inside(t, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]))), 'every strap lies inside a tile');

// Diffraction: a sharp Bragg peak repeats every 36° round the centre (tenfold symmetry, which no periodic crystal
// can have); 18° off it there is almost nothing.
const pts = samples(hankin(pentagrid(9), 54 * DEG));
let best = [0, 0, 0];
for (let r = 0.4; r < 2.2; r += 0.01) for (let a = 0; a < 36; a += 0.5) {
  const I = intensity(pts, r * Math.cos(a * DEG), r * Math.sin(a * DEG), 5); if (I > best[2]) best = [r, a, I];
}
const ring = n => intensity(pts, best[0] * Math.cos((best[1] + n) * DEG), best[0] * Math.sin((best[1] + n) * DEG), 5);
const peaks = [...Array(10).keys()].map(i => ring(36 * i)), lo = Math.min(...peaks), hi = Math.max(...peaks);
ok(lo / hi > 0.9, `Bragg peak at |k| = ${best[0].toFixed(2)}: its 10 copies 36° apart agree within ${((1 - lo / hi) * 100).toFixed(1)}%`);
ok(ring(18) < hi / 10, `18° off the peak: ${(ring(18) / hi * 100).toFixed(1)}% of it`);
const d0 = diffraction(pts, 41, 2.2, 0, 5);
ok(d0.length === 41 * 41 && d0.every(x => x >= 0 && x <= 1), 'diffraction image is normalised to 0..1');

// Missions: the target scores 1 against itself, the start is far enough away to be a puzzle.
for (const [i, m] of MISSIONS.entries()) {
  const P = samples(hankin(pentagrid(9), m.theta)), Q = samples(hankin(pentagrid(9), m.start.theta));
  const tgt = diffraction(P, 33, 2.2, m.phi, 5), st = diffraction(Q, 33, 2.2, m.start.phi, 5);
  const s = similarity(tgt, st);
  ok(s < SOLVED - 0.05, `mission ${i + 1}: start similarity ${s.toFixed(3)} < ${SOLVED}`);
}
process.exit(fail);

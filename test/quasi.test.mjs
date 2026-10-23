// node test/quasi.test.mjs — the physics and geometry the Quasicrystal Lab claims.
import { pentagrid, gammas, flips, hankin, samples, diffraction, intensity, similarity, MISSIONS, SOLVED, fingerprint, PHI, sun, deflate, dive, rhombs } from '../quasi.js';
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

const seg = hankin(T, 45 * DEG);
ok(seg.length > 4 * T.length, `Hankin at 45°: ${seg.length} strapwork segments`);
ok(seg.every(([a, b]) => T.some(t => inside(t, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]))), 'every strap lies inside a tile');

// Diffraction: a sharp Bragg peak repeats every 36° round the centre (tenfold symmetry, which no periodic crystal
// can have); 18° off it there is almost nothing.
const pts = samples(hankin(pentagrid(9), 45 * DEG));
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
  const tgt = fingerprint(m.theta, m.phi);
  ok(similarity(tgt, fingerprint(m.theta, m.phi)) > 0.9999, `mission ${i + 1}: the answer scores 1`);
  const s = similarity(tgt, fingerprint(m.start.theta, m.start.phi));
  ok(s < (m.need ?? SOLVED) - 0.03, `mission ${i + 1}: start scores ${s.toFixed(3)}, well under ${m.need ?? SOLVED}`);
  const nearby = similarity(tgt, fingerprint(m.theta + 1.5 * DEG, m.phi + 0.25 * DEG));
  ok(nearby >= (m.need ?? SOLVED), `mission ${i + 1}: 1.5° and 0.25° off still counts (${nearby.toFixed(3)}), so hands can solve it`);
}

// Infinite zoom: deflation is exact, and diving never lets coordinates or tile counts grow.
{
  let tr = sun(1);
  for (let i = 0; i < 7; i++) tr = deflate(tr);
  const R = rhombs(tr), thick = R.filter(r => r.thick).length, thin = R.length - thick;
  ok(Math.abs(thick / thin - PHI) < 0.03, `7 deflations: ${thick} thick / ${thin} thin rhombs = ${(thick / thin).toFixed(4)} → φ = ${PHI.toFixed(4)}`);
  const edge = ({ v }) => Math.hypot(v[1][0] - v[0][0], v[1][1] - v[0][1]), L = edge(R[0]);
  ok(near(L, Math.pow(PHI, -7)) && R.every(({ v }) => v.every((a, i) => near(Math.hypot(v[(i + 1) % 4][0] - a[0], v[(i + 1) % 4][1] - a[1]), L))), `all ${R.length} rhombs share one edge, ${L.toFixed(6)} = φ^-7`);
  const ang = ({ v }) => { const a = [v[1][0] - v[0][0], v[1][1] - v[0][1]], b = [v[3][0] - v[0][0], v[3][1] - v[0][1]];
    return Math.acos((a[0] * b[0] + a[1] * b[1]) / Math.hypot(...a) / Math.hypot(...b)) / DEG; };
  ok(R.every(r => (r.thick ? [72, 108] : [36, 144]).some(x => Math.abs(ang(r) - x) < 1e-6)), 'thin rhombs 36°/144°, thick 72°/108°');
  // Dive 300 levels (φ^300 ≈ 10^62 times closer): a bounded number of tiles at bounded coordinates.
  let d = sun(40); for (let i = 0; i < 6; i++) d = deflate(d);
  let maxN = 0, maxC = 0;
  for (let i = 0; i < 300; i++) { d = dive(d, 4); maxN = Math.max(maxN, d.length); for (const [, ...v] of d) for (const p of v) maxC = Math.max(maxC, Math.abs(p[0]), Math.abs(p[1])); }
  const R2 = rhombs(d), R3 = rhombs(dive(d, 4));
  ok(d.length > 50 && maxN < 4000 && maxC < 30, `300 levels deep: ${d.length} triangles in view (max ${maxN}), coordinates stay under ${maxC.toFixed(1)}`);
  ok(R2.length > 20 && near(edge(R2[0]), edge(R3[0]), 1e-6), `each level is drawn at the same size (edge ${edge(R2[0]).toFixed(4)}): self-similar all the way down`);
  ok(hankin(R2, 54 * DEG).length > R2.length * 4, 'girih strapwork on every level');
}
process.exit(fail);

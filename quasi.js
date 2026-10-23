// Quasicrystal engine: a Penrose rhomb tiling cut from a 5-dimensional lattice (de Bruijn's pentagrid, 1981),
// girih strapwork drawn on it with Hankin's polygons-in-contact method, and the tiling's diffraction pattern.
// Pure functions, no three.js, so node can test them.
const TAU = Math.PI * 2;
export const E = [0, 1, 2, 3, 4].map(j => [Math.cos(TAU * j / 5), Math.sin(TAU * j / 5)]);      // physical space
export const EP = [0, 1, 2, 3, 4].map(j => [Math.cos(2 * TAU * j / 5), Math.sin(2 * TAU * j / 5)]); // internal (phason) space
// Generic offsets (no three grid lines meet in a point) that sum to zero: a true Penrose tiling.
export const GAMMA0 = [0.1931, -0.2817, 0.3602, -0.1128, -0.1588];

// The five offsets after shifting the cut by p in internal space. The sum stays zero, so every p gives another
// Penrose tiling of the same local kind: what changes is which rhombs flip (phason flips), not the rules.
export const gammas = (p = [0, 0]) => GAMMA0.map((g, j) => g + p[0] * EP[j][0] + p[1] * EP[j][1]);

// All rhombs whose centre lies within radius R. Each pair of grid families (r, s) and each crossing of a line of r
// with a line of s gives one rhomb; its corners are the 5D lattice points round that crossing, projected to the plane.
export function pentagrid(R, gamma = GAMMA0) {
  const N = Math.ceil(R) + 2, tiles = [];
  for (let r = 0; r < 5; r++) for (let s = r + 1; s < 5; s++) {
    const [a, b] = E[r], [c, d] = E[s], det = a * d - b * c;
    for (let kr = -N; kr <= N; kr++) for (let ks = -N; ks <= N; ks++) {
      const u = kr - gamma[r], w = ks - gamma[s];
      const z = [(u * d - b * w) / det, (a * w - u * c) / det];          // where the two grid lines cross
      const K = E.map(([ex, ey], j) => Math.ceil(z[0] * ex + z[1] * ey + gamma[j]));
      const corner = (dr, ds) => {
        let x = 0, y = 0;
        for (let j = 0; j < 5; j++) { const k = j === r ? kr + dr : j === s ? ks + ds : K[j]; x += k * E[j][0]; y += k * E[j][1]; }
        return [x, y];
      };
      const v = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)];
      const cx = (v[0][0] + v[2][0]) / 2, cy = (v[0][1] + v[2][1]) / 2;
      if (Math.hypot(cx, cy) > R) continue;
      const area = (v[1][0] - v[0][0]) * (v[3][1] - v[0][1]) - (v[1][1] - v[0][1]) * (v[3][0] - v[0][0]);
      if (area < 0) v.reverse();                                          // counter-clockwise, always
      tiles.push({ v, thick: s - r === 1 || s - r === 4, key: `${r}${s}:${kr},${ks}`, c: [cx, cy] });
    }
  }
  return tiles;
}

// Rhombs present after a phason shift that were not there before. Corners are 5D lattice points, so an unchanged
// rhomb keeps exactly the same centre; a flipped one appears somewhere new.
export function flips(before, after) {
  const id = t => `${t.c[0].toFixed(4)},${t.c[1].toFixed(4)},${t.thick}`, had = new Set(before.map(id));
  return after.filter(t => !had.has(id(t)));
}

// Hankin's method: from the midpoint of every edge two rays leave at the contact angle theta, one leaning towards each
// neighbouring corner; the ray towards corner i+1 meets the ray coming back from the next edge. Their meeting points
// trace the star pattern. Returns line segments [[x, y], [x, y]].
export function hankin(tiles, theta) {
  const seg = [], rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  for (const { v } of tiles) {
    const n = v.length, mid = [], dir = [];
    for (let i = 0; i < n; i++) {
      const a = v[i], b = v[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      mid.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); dir.push([(b[0] - a[0]) / L, (b[1] - a[1]) / L]);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, p = mid[i], q = mid[j];
      const d1 = rot(dir[i], theta), d2 = rot([-dir[j][0], -dir[j][1]], -theta);
      const den = d1[0] * d2[1] - d1[1] * d2[0];
      if (Math.abs(den) < 1e-9) continue;
      const t = ((q[0] - p[0]) * d2[1] - (q[1] - p[1]) * d2[0]) / den;
      const u = ((q[0] - p[0]) * d1[1] - (q[1] - p[1]) * d1[0]) / den;
      if (t <= 0 || u <= 0 || t > 1.5 || u > 1.5) continue;              // rays that miss inside the tile draw nothing
      const x = [p[0] + t * d1[0], p[1] + t * d1[1]];
      seg.push([p, x], [q, x]);
    }
  }
  return seg;
}

// Scatterers for diffraction: n points evenly along every strap (what an X-ray would see if the lines were rows of
// atoms). A fixed count, not a fixed spacing, so the picture changes smoothly as the contact angle turns.
export function samples(seg, n = 3) {
  const pts = [];
  for (const [a, b] of seg) {
    for (let i = 0; i < n; i++) pts.push([a[0] + (b[0] - a[0]) * (i + 0.5) / n, a[1] + (b[1] - a[1]) * (i + 0.5) / n]);
  }
  return pts;
}

// Diffraction intensity |sum exp(-2 pi i k.r)|^2 / N on a size x size grid of k in [-kmax, kmax]^2, the k-grid
// turned by phi. A Gaussian window softens the patch's round edge so the peaks are clean. Scaled to 0..1, log scale
// for the eye (weak peaks show), linear for scoring (peak heights count).
export function diffraction(pts, size, kmax, phi = 0, window = 0, log = true) {
  const out = new Float32Array(size * size), cs = Math.cos(phi), sn = Math.sin(phi);
  const w = pts.map(([x, y]) => window ? Math.exp(-(x * x + y * y) / (2 * window * window)) : 1);
  const W = w.reduce((s, x) => s + x * x, 0) || 1;
  for (let iy = 0; iy < size; iy++) for (let ix = 0; ix < size; ix++) {
    const gx = (ix / (size - 1) * 2 - 1) * kmax, gy = (iy / (size - 1) * 2 - 1) * kmax;
    if (gx * gx + gy * gy < 0.0625) continue;                           // the beam stop: k = 0 carries no structure
    const kx = TAU * (gx * cs - gy * sn), ky = TAU * (gx * sn + gy * cs);
    let re = 0, im = 0;
    for (let n = 0; n < pts.length; n++) { const a = kx * pts[n][0] + ky * pts[n][1]; re += w[n] * Math.cos(a); im -= w[n] * Math.sin(a); }
    out[iy * size + ix] = (re * re + im * im) / W;
  }
  let max = 0;
  for (let i = 0; i < out.length; i++) { if (log) out[i] = Math.log1p(out[i]); if (out[i] > max) max = out[i]; }
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, out[i] / (max || 1));
  return out;
}

// Intensity at one wave vector (cycles per edge length), with the same window and normalisation as diffraction().
export function intensity(pts, gx, gy, window = 0) {
  let re = 0, im = 0, W = 0;
  for (const [x, y] of pts) {
    const w = window ? Math.exp(-(x * x + y * y) / (2 * window * window)) : 1, a = TAU * (gx * x + gy * y);
    re += w * Math.cos(a); im -= w * Math.sin(a); W += w * w;
  }
  return (re * re + im * im) / (W || 1);
}

// Normalised cross-correlation of two images: 1 = the same pattern, 0 = unrelated.
export function similarity(a, b) {
  let ma = 0, mb = 0; for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; } ma /= a.length; mb /= b.length;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; ab += x * y; aa += x * x; bb += y * y; }
  return ab / Math.sqrt(aa * bb || 1);
}

// The crystallographer's missions: a hidden contact angle and orientation; the player sees only their diffraction.
const DEG = Math.PI / 180;
export const MISSIONS = [
  { theta: 45 * DEG, phi: 0, free: ['phi'], start: { theta: 45 * DEG, phi: 17 * DEG } },
  { theta: 63 * DEG, phi: 0, free: ['theta'], start: { theta: 28 * DEG, phi: 0 }, need: 0.99 },
  { theta: 30 * DEG, phi: 11 * DEG, free: ['theta', 'phi'], start: { theta: 66 * DEG, phi: 27 * DEG } },
];
// How the lab scores a guess: linear intensities (peak heights matter), 32 x 32, the same ideal patch for both.
export const fingerprint = (theta, phi) => diffraction(samples(hankin(pentagrid(5), theta)), 32, 1.6, phi, 2.5, false);
export const SOLVED = 0.97;

// ---------- Infinite zoom: girih inside girih ----------
// A Penrose tiling is self-similar: cut every rhomb into Robinson triangles, cut each triangle into smaller ones by
// the golden ratio, and the pieces pair up into a Penrose tiling again, φ times finer (deflation). Drawing Hankin
// strapwork on two consecutive levels at once gives large girih with small girih inside it, the two-level design
// Lu & Steinhardt (Science 315, 2007) found on the Darb-i Imam shrine in Isfahan (1453).
// A triangle is [kind, A, B, C]: kind 0 = acute (36° at A), kind 1 = obtuse (108° at A); partners share side BC.
export const PHI = (1 + Math.sqrt(5)) / 2;
export function sun(r = 1) {
  const out = [];
  for (let i = 0; i < 10; i++) {
    let B = [r * Math.cos((2 * i - 1) * Math.PI / 10), r * Math.sin((2 * i - 1) * Math.PI / 10)];
    let C = [r * Math.cos((2 * i + 1) * Math.PI / 10), r * Math.sin((2 * i + 1) * Math.PI / 10)];
    if (i % 2) [B, C] = [C, B];                                          // mirror every other one
    out.push([0, [0, 0], B, C]);
  }
  return out;
}
const lerp = (P, Q, s) => [P[0] + (Q[0] - P[0]) * s, P[1] + (Q[1] - P[1]) * s];
export function deflate(tris) {
  const out = [];
  for (const [k, A, B, C] of tris) {
    if (k === 0) { const P = lerp(A, B, 1 / PHI); out.push([0, C, P, B], [1, P, C, A]); }
    else { const Q = lerp(B, A, 1 / PHI), R = lerp(B, C, 1 / PHI); out.push([1, R, C, A], [1, Q, R, B], [0, R, Q, A]); }
  }
  return out;
}
// One zoom step: deflate, blow everything up by φ about the origin and keep only what can still be seen (with a
// margin). Coordinates never grow, so the dive has no floor: level 1000 costs what level 10 does.
export function dive(tris, half, margin = 1.5) {
  const lim = half * margin;
  return deflate(tris).map(([k, ...v]) => [k, ...v.map(([x, y]) => [x * PHI, y * PHI])])
    .filter(([, ...v]) => !(v.every(p => p[0] < -lim) || v.every(p => p[0] > lim) || v.every(p => p[1] < -lim) || v.every(p => p[1] > lim)));
}
// Partners → rhombs ({ v, thick } like pentagrid's, counter-clockwise). A triangle whose partner was culled is dropped.
export function rhombs(tris) {
  const key = ([k, , B, C]) => { const [p, q] = [B, C].map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`).sort(); return `${k}|${p}|${q}`; };
  const open = new Map(), out = [];
  for (const t of tris) {
    const id = key(t), o = open.get(id);
    if (!o) { open.set(id, t); continue; }
    open.delete(id);
    const v = [t[1], t[2], o[1], t[3]];
    const area = (v[1][0] - v[0][0]) * (v[3][1] - v[0][1]) - (v[1][1] - v[0][1]) * (v[3][0] - v[0][0]);
    out.push({ v: area < 0 ? v.reverse() : v, thick: t[0] === 1, c: [(t[1][0] + o[1][0]) / 2, (t[1][1] + o[1][1]) / 2] });
  }
  return out;
}

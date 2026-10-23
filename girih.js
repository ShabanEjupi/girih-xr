// Girih geometry and levels. Pure functions, no three.js, so node can test them.
// Every girih tile has unit edges and angles in multiples of 36°, which is why pieces snap in 36° steps.

const D = Math.PI / 180;

// Interior angles, walked counter-clockwise. `sym` is the rotation (degrees) that maps the tile onto itself.
export const TILES = {
  decagon:  { angles: Array(10).fill(144), sym: 36,  colour: 0x2f6f5e },
  pentagon: { angles: Array(5).fill(108),  sym: 72,  colour: 0xc9a227 },
  rhombus:  { angles: [72, 108, 72, 108],  sym: 180, colour: 0x3c6e9f },
  bowtie:   { angles: [72, 72, 216, 72, 72, 216], sym: 180, colour: 0x9a4a3c },
  hexagon:  { angles: [72, 144, 144, 72, 144, 144], sym: 180, colour: 0x6b5b95 },
};

// Vertices of a tile in its own frame: edge 0 runs from (0,0) along +x, then a turtle turns by each exterior angle.
export function outline(kind) {
  const pts = [[0, 0]];
  let x = 0, y = 0, h = 0;
  const a = TILES[kind].angles;
  for (let i = 0; i < a.length - 1; i++) {
    x += Math.cos(h); y += Math.sin(h); pts.push([x, y]);
    h += (180 - a[i + 1]) * D;
  }
  return pts;
}

export const centroid = pts => pts.reduce(([sx, sy], [x, y]) => [sx + x / pts.length, sy + y / pts.length], [0, 0]);

// Outline centred on its centroid, so a piece rotates about its middle.
export function centred(kind) {
  const p = outline(kind), [cx, cy] = centroid(p);
  return p.map(([x, y]) => [x - cx, y - cy]);
}

export const rot = ([x, y], r) => [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];

// World vertices of a placed tile {kind, x, y, r} (r in degrees).
export const placed = t => centred(t.kind).map(p => rot(p, t.r * D)).map(([x, y]) => [x + t.x, y + t.y]);

// Place tile `kind` so its edge `k` lies on edge `e` of `host` (reversed), i.e. the two tiles share that edge.
export function attach(host, e, kind, k = 0) {
  const hv = placed(host), a = hv[e], b = hv[(e + 1) % hv.length];
  const own = centred(kind), p = own[k], q = own[(k + 1) % own.length];
  // Rotate the new tile so its edge q→p points along a→b, then move p onto b... equivalently q onto a.
  const want = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const have = Math.atan2(p[1] - q[1], p[0] - q[0]);
  const r = want - have;
  const q2 = rot(q, r);
  return { kind, x: a[0] - q2[0], y: a[1] - q2[1], r: ((r / D) % 360 + 360) % 360 };
}

// Smallest rotation difference between two orientations of a tile with the given symmetry, in degrees.
export function angleOff(r1, r2, sym) {
  const d = (((r1 - r2) % sym) + sym) % sym;
  return Math.min(d, sym - d);
}

// Girih strapwork: segments joining edge midpoints (decagon i→i+3, pentagon i→i+2, others i→i+1 across).
export function strap(t) {
  const v = placed(t), n = v.length;
  const mid = i => { const a = v[i % n], b = v[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  const step = t.kind === 'decagon' ? 3 : t.kind === 'pentagon' ? 2 : 1;
  const seg = [];
  for (let i = 0; i < n; i++) seg.push([mid(i), mid(i + step)]);
  return seg;
}

const ring = (count, every) => {
  const dec = { kind: 'decagon', x: 0, y: 0, r: 0 };
  const out = [dec];
  for (let e = 0; e < 10; e += every) if (out.length <= count) out.push(attach(dec, e, 'pentagon'));
  return out;
};

// Levels: slots to fill, plus decoys in the tray that fit nowhere (you learn the shapes by trying).
export const LEVELS = [
  { slots: ring(3, 3), decoys: ['rhombus'] },
  { slots: ring(5, 2), decoys: ['rhombus', 'bowtie'] },
  { slots: ring(10, 1), decoys: ['hexagon', 'bowtie', 'rhombus'] },
];

// Does a piece at (x, y, r) fit slot s? Close enough and turned the right way, given the tile's symmetry.
export function fits(kind, x, y, r, s, tol = { dist: 0.35, deg: 14 }) {
  return kind === s.kind && Math.hypot(x - s.x, y - s.y) < tol.dist && angleOff(r, s.r, TILES[kind].sym) < tol.deg;
}

// Polygon overlap test (separating axis), for checking that level slots never overlap.
export function overlap(a, b, eps = 1e-6) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const nx = q[1] - p[1], ny = p[0] - q[0];
      const pr = s => s.map(([x, y]) => x * nx + y * ny);
      const A = pr(a), B = pr(b);
      if (Math.max(...A) <= Math.min(...B) + eps || Math.max(...B) <= Math.min(...A) + eps) return false;
    }
  }
  return true;
}

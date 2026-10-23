// The room state converges: random concurrent writes from three peers, delivered to the merge in every order the
// network could produce, always end in the same state — and that state holds each field's highest (clock, peer).
import { merge } from '../relay.mjs';
let fail = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail = 1; };
const peers = ['aaaaaa', 'bbbbbb', 'cccccc'], fields = ['mission', 'p', 'theta', 'phi'];
let rnd = 7; const r = n => ((rnd = (rnd * 1103515245 + 12345) % 2 ** 31) % n);
let same = 0, right = 0;
for (let trial = 0; trial < 2000; trial++) {
  const writes = Array.from({ length: 2 + r(8) }, () => ({ peer: peers[r(3)], st: { [fields[r(4)]]: [r(100), 1 + r(5)] } }));
  const results = [];
  for (let o = 0; o < 6; o++) {
    const order = writes.slice().sort(() => r(3) - 1), state = {};
    for (const w of order) merge(state, w.st, w.peer);
    results.push(JSON.stringify(Object.keys(state).sort().map(k => [k, state[k]])));   // canonical: key order is not state
  }
  if (results.every(x => x === results[0])) same++;
  const final = Object.fromEntries(JSON.parse(results[0]));
  if (fields.every(f => { const ws = writes.filter(w => w.st[f]).map(w => [w.st[f][1], w.peer]); if (!ws.length) return !final[f];
    const best = ws.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1)).at(-1); return final[f][1] === best[0] && final[f][2] === best[1]; })) right++;
}
ok(same === 2000, `2000 random histories: every delivery order ends in the same room state (${same}/2000)`);
ok(right === 2000, `the state holds each field's highest (Lamport clock, peer) write (${right}/2000)`);
const s = {}; merge(s, { secret: [1, 9], theta: ['x', 1.5] }, 'aaaaaa');
ok(!Object.keys(s).length, 'unknown fields and non-integer clocks are refused');
process.exit(fail);

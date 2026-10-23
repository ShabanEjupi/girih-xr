// Quasicrystal Lab in mixed reality, in Meta's emulator (IWER, Quest 3) with a stand-in wall (lab-xr.html?wall=1):
// "On my table" starts unpinned, a pinch sets the crystal on the surface facing the room, and the hands still work
// there — the right pinch-drag slides the 5D cut.
//   node lab-mr.mjs <base-url> <out-dir>
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; p.on('pageerror', e => errors.push(e.message));
let fail = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail = 1; };
await p.goto(`${base}/test/lab-xr.html?wall=1`);
await p.waitForFunction(() => window.lab && window.xrDevice);
await p.evaluate(() => { localStorage.clear(); });
await p.click('#next');                                            // the free lab: both controls live
ok(await p.isVisible('#mr'), 'the "On my table" button shows on a headset with passthrough');
await p.click('#mr'); await p.waitForTimeout(1500);
ok(await p.evaluate(() => lab.mr && !lab.pinned), 'the session starts unpinned, the ring looks for a surface');
const step = (hand, f) => p.evaluate(([h, src]) => new Function('H', src)(window.xrDevice.hands[h]), [hand, f]);
await step('right', 'H.position.set(0.15, 1.3, -0.4)'); await step('left', 'H.position.set(-0.25, 1.0, -0.35)');
await p.waitForTimeout(300);
await step('right', 'H.updatePinchValue(1)'); await p.waitForTimeout(250);
await step('right', 'H.updatePinchValue(0)'); await p.waitForTimeout(500);
const f = await p.evaluate(() => lab.pinned && lab.facing);
ok(f && Math.abs(f.at[2] + 1.2) < 0.02 && f.normal[2] > 0.99, `a pinch sets the crystal on the wall, facing the room (z ${f && f.at[2].toFixed(3)}, n ${f && f.normal.map(x => x.toFixed(2))})`);
const s0 = await p.evaluate(() => [...lab.p]);
await step('right', 'H.updatePinchValue(1)'); await p.waitForTimeout(300);
for (let i = 0; i < 8; i++) { await step('right', 'H.position.set(H.position.x + 0.012, H.position.y + 0.006, H.position.z)'); await p.waitForTimeout(80); }
await step('right', 'H.updatePinchValue(0)'); await p.waitForTimeout(300);
const s1 = await p.evaluate(() => [...lab.p]);
ok(Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) > 0.005, `on the wall, the right pinch-drag slides the 5D cut: ${s0.map(x => x.toFixed(3))} → ${s1.map(x => x.toFixed(3))}`);
await p.screenshot({ path: `${out}/lab-mr.png` });
ok(!errors.length, `no errors ${errors.join(' | ')}`);
await b.close(); process.exit(fail);

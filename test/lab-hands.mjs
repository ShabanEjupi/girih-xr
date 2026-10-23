// Quasicrystal Lab with hands only, in Meta's emulator (IWER, Quest 3): the right hand pinches and drags to slide the
// 5D cut, the left hand pinches and rises to bend the girih lines. Needs test/iwer.module.js (iwer@2.7.0).
//   node lab-hands.mjs <base-url> <out-dir>
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; p.on('pageerror', e => errors.push(e.message));
let fail = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail = 1; };
await p.goto(`${base}/test/lab-xr.html`);
await p.waitForFunction(() => window.lab && window.xrDevice);
await p.evaluate(() => { localStorage.clear(); });
await p.click('#next');                                            // the free lab: both controls live
await p.click('#enter');
await p.waitForTimeout(1500);
const step = (hand, f) => p.evaluate(([h, src]) => { const H = window.xrDevice.hands[h]; new Function('H', src)(H); }, [hand, f]);
const st = () => p.evaluate(() => ({ p: [...lab.p], theta: lab.theta, phi: lab.phi }));
await step('left', 'H.position.set(-0.25, 1.0, -0.35)'); await step('right', 'H.position.set(0.15, 1.0, -0.4)');
await p.waitForTimeout(400);
const s0 = await st();
await step('right', 'H.updatePinchValue(1)'); await p.waitForTimeout(300);
for (let i = 0; i < 8; i++) { await step('right', 'H.position.set(H.position.x + 0.012, H.position.y, H.position.z - 0.006)'); await p.waitForTimeout(80); }
await step('right', 'H.updatePinchValue(0)'); await p.waitForTimeout(300);
const s1 = await st();
ok(Math.hypot(s1.p[0] - s0.p[0], s1.p[1] - s0.p[1]) > 0.005, `right pinch-drag slides the 5D cut: p ${s0.p.map(x => x.toFixed(3))} → ${s1.p.map(x => x.toFixed(3))}`);
await step('left', 'H.updatePinchValue(1)'); await p.waitForTimeout(300);
for (let i = 0; i < 6; i++) { await step('left', 'H.position.set(H.position.x, H.position.y + 0.01, H.position.z)'); await p.waitForTimeout(80); }
await step('left', 'H.updatePinchValue(0)'); await p.waitForTimeout(300);
const s2 = await st();
ok(s2.theta - s1.theta > 2, `left pinch and raise bends the girih lines: θ ${s1.theta.toFixed(1)}° → ${s2.theta.toFixed(1)}°`);
await p.screenshot({ path: `${out}/lab-hands.png` });
ok(!errors.length, `no errors ${errors.join(' | ')}`);
await b.close(); process.exit(fail);

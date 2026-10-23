// Girih all the way down. A Penrose tiling holds a copy of itself φ times finer; drawing Hankin strapwork on three
// consecutive levels at once shows large girih with smaller girih inside, and smaller inside that. Each time the
// view has grown by φ the tiling is deflated once and renormalised (quasi.js `dive`), so the numbers never grow and
// the dive has no floor. Pinch with two hands (or wheel, or two fingers) to zoom; pinch with one hand to steer.
import * as THREE from './vendor/three.module.js';
import { PHI, sun, deflate, dive, rhombs, hankin } from './quasi.js';
import { mrSupported, requestMR, placer } from './mr.js';

const DEG = Math.PI / 180, H = 4, S = 0.05, PINCH_ON = 0.018, PINCH_OFF = 0.035;
const T = {
  en: { title: 'Girih all the way down', enter: 'Enter VR', lang: 'Shqip', back: 'Lab', dive: 'Dive', stop: 'Stop', level: 'Level', mag: 'magnified',
        sub: 'A Penrose tiling contains itself, φ times finer. Large girih with smaller girih inside: the two-level design Lu & Steinhardt found on the Darb-i Imam shrine (Isfahan, 1453). Here it has no floor: every level is rebuilt from the one above, so the dive can go on for ever.',
        mouse: 'Wheel or two fingers to zoom, drag to steer.', hands: 'Pinch with both hands and pull apart to zoom in. Pinch with one hand to steer.',
        noxr: 'Hand tracking needs a VR headset; here it works with a mouse or touch.',
        mr: 'Pin to a wall', place: 'Look at a wall or a table, then pinch: the girih is pinned there.' },
  sq: { title: 'Girih pa fund', enter: 'Hyr në VR', lang: 'English', back: 'Laboratori', dive: 'Zhytu', stop: 'Ndal', level: 'Niveli', mag: 'zmadhim',
        sub: 'Pllakëzimi Penrose e përmban veten, φ herë më imët. Girih i madh me girih më të vogël brenda: dizajni me dy nivele që Lu & Steinhardt e gjetën te tyrbja Darb-i Imam (Isfahan, 1453). Këtu s\'ka fund: çdo nivel ndërtohet nga ai sipër, ndaj zhytja mund të vazhdojë pa mbarim.',
        mouse: 'Rrota ose dy gishta për zmadhim, tërhiq për drejtim.', hands: 'Kape me të dy duart dhe largoji për të zmadhuar. Kape me një dorë për drejtim.',
        noxr: 'Duart kërkojnë syze VR; këtu punon me mi ose prekje.',
        mr: 'Ngule te muri', place: 'Shiko një mur ose tavolinë dhe kape me dy gishta: girih-u ngulet aty.' },
};
let lang = (() => { try { return JSON.parse(localStorage.getItem('girih-lab:lang')) || null; } catch { return null; } })() || ((navigator.language || '').startsWith('sq') ? 'sq' : 'en');
const t = k => T[lang][k], $ = id => document.getElementById(id);

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });   // alpha: passthrough shows through in MR
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1412);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 80);
// mount = where the work hangs in the room (identity on screen and in VR, the pinned surface in MR); board = the work itself.
const mount = new THREE.Group(), board = new THREE.Group(); mount.add(board); scene.add(mount);
const place = placer(scene, mount);
let mr = false;
const disc = new THREE.Mesh(new THREE.CircleGeometry(H * 1.04, 120), new THREE.MeshBasicMaterial({ color: 0x15231f }));
disc.position.z = -0.02; board.add(disc);
// Three strap layers (coarse, fine, finest) and the faint rhombs of the fine level.
const layer = (color, z) => { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.position.z = z; m.frustumCulled = false; board.add(m); return m; };
const edges = layer(0x2f7a6c, 0), L3 = [layer(0xf2d47a, 0.03), layer(0xe9c46a, 0.02), layer(0xcaa64e, 0.01)];

// ---------- the dive ----------
let tris = sun(1), stack = [], s = 1, o = [0, 0], level = 0, theta = 54 * DEG, levels = null, diving = false, rot = 0;
for (let i = 0; i < 6; i++) tris = dive(tris, H);              // grow the root until it covers the porthole
function prepare() {
  const t1 = deflate(tris), t2 = deflate(t1);
  levels = [tris, t1, t2].map(x => { const r = rhombs(x); return { r, seg: hankin(r, theta) }; });
}
function down() {                                               // one level deeper: recentre, deflate, renormalise
  stack.push({ tris, o }); if (stack.length > 40) stack.shift();
  tris = dive(tris.map(([k, ...v]) => [k, ...v.map(p => [p[0] - o[0], p[1] - o[1]])]), H);
  o = [0, 0]; s /= PHI; level++; prepare();
}
function up() {
  const st = stack.pop(); if (!st) { s = 1; return; }
  o = [st.o[0] + o[0] / PHI, st.o[1] + o[1] / PHI]; tris = st.tris; s *= PHI; level--; prepare();
}
function zoomAt(k, q = [0, 0]) {                                // scale by k about board point q
  const pq = [q[0] / s + o[0], q[1] / s + o[1]];
  s *= k; o = [pq[0] - q[0] / s, pq[1] - q[1] / s];
  while (s >= PHI) down();
  while (s < 1 && (stack.length || level > 0)) up();
  if (s < 1) s = 1;
  clampO(); draw();
}
const clampO = () => { const m = H * 0.45, d = Math.hypot(...o); if (d > m) o = [o[0] * m / d, o[1] * m / d]; };
const steer = (dx, dy) => { o = [o[0] - dx / s, o[1] - dy / s]; clampO(); draw(); };

// Geometry for the current s and o, cut to the round porthole. Widths and opacities run so that, at s = φ, each
// layer looks exactly like the next coarser one at s = 1: the level change is invisible.
function draw() {
  const f = (s - 1) / (PHI - 1), R = H * 1.02;
  const xf = ([x, y]) => [(x - o[0]) * s, (y - o[1]) * s];
  const quads = (seg, w) => {
    const out = [];
    for (const [a0, b0] of seg) {
      const a = xf(a0), b = xf(b0);
      if (Math.hypot(...a) > R && Math.hypot(...b) > R) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * w, ny = dx / L * w;
      const q = [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
      for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) out.push(v[0], v[1], 0);
    }
    return new THREE.Float32BufferAttribute(out, 3);
  };
  const W = [0.075, 0.05 + 0.025 * f, 0.03 + 0.02 * f], A = [1 - f, 0.4 + 0.6 * f, 0.4 * f];
  L3.forEach((m, i) => { m.geometry.setAttribute('position', quads(levels[i].seg, W[i])); m.material.opacity = A[i]; m.visible = A[i] > 0.01; });
  const e = []; for (const { v } of levels[1].r) for (let i = 0; i < 4; i++) e.push([v[i], v[(i + 1) % 4]]);
  edges.geometry.setAttribute('position', quads(e, 0.008)); edges.material.opacity = 0.5;
  ui();
}

// ---------- layout and HUD ----------
function layout() {
  board.scale.setScalar(1); board.position.set(0, 0, 0); board.rotation.set(0, 0, rot);
  const tan = Math.tan(camera.fov * DEG / 2), r = H * 1.25, dist = Math.max(r / tan, r / (tan * camera.aspect));
  camera.position.set(0, 0, dist); camera.lookAt(0, 0, 0);
}
const vrLayout = () => { board.scale.setScalar(S); board.position.set(0, -0.3, -0.5); board.rotation.set(-Math.PI / 2 + 0.75, 0, rot); };
const mrLayout = () => { board.scale.setScalar(S); board.position.set(0, 0, 0.004); board.rotation.set(0, 0, rot); };   // 4 mm off the surface
function ui() {
  document.documentElement.lang = lang;
  $('title').textContent = t('title'); $('sub').textContent = t('sub');
  // φ^n written as a power of ten: past a few dozen levels no number on screen could hold it.
  const e = (level + Math.log(s) / Math.log(PHI)) * Math.log10(PHI), mant = 10 ** (e - Math.floor(e));
  $('mag').textContent = `${t('level')} ${level} · ${mant.toFixed(2)} × 10^${Math.floor(e)} ${t('mag')}`;
  $('tip').textContent = !renderer.xr.isPresenting ? t('mouse') : mr && !place.pinned ? t('place') : t('hands');
  $('enter').textContent = t('enter'); $('mr').textContent = t('mr'); $('lang').textContent = t('lang'); $('back').textContent = t('back'); $('dive').textContent = diving ? t('stop') : t('dive');
}
$('lang').onclick = () => { lang = lang === 'en' ? 'sq' : 'en'; try { localStorage.setItem('girih-lab:lang', JSON.stringify(lang)); } catch {} ui(); };
$('dive').onclick = () => { diving = !diving; ui(); };
$('theta').oninput = e => { theta = e.target.value * DEG; prepare(); draw(); };

// ---------- mouse and touch ----------
const el = renderer.domElement, ptr = new Map();
const toBoard = (x, y) => {                                     // screen pixel → board plane
  const v = new THREE.Vector3((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
  const p = camera.position.clone().add(v.multiplyScalar(-camera.position.z / v.z));
  return [p.x * Math.cos(-rot) - p.y * Math.sin(-rot), p.x * Math.sin(-rot) + p.y * Math.cos(-rot)];
};
el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); ptr.set(e.pointerId, toBoard(e.clientX, e.clientY)); });
el.addEventListener('pointermove', e => {
  if (!ptr.has(e.pointerId)) return;
  const now = toBoard(e.clientX, e.clientY);
  if (ptr.size === 2) {                                         // two fingers: pinch about their midpoint
    const [a, b] = [...ptr.values()], before = Math.hypot(a[0] - b[0], a[1] - b[1]);
    ptr.set(e.pointerId, now);
    const [c, d] = [...ptr.values()], after = Math.hypot(c[0] - d[0], c[1] - d[1]);
    if (before > 0.05) zoomAt(after / before, [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2]);
  } else { const was = ptr.get(e.pointerId); ptr.set(e.pointerId, now); steer(now[0] - was[0], now[1] - was[1]); }
});
const lift = e => ptr.delete(e.pointerId);
el.addEventListener('pointerup', lift); el.addEventListener('pointercancel', lift);
addEventListener('wheel', e => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.0015), toBoard(e.clientX, e.clientY)); }, { passive: false });
addEventListener('keydown', e => { if (e.key === '+' || e.key === '=') zoomAt(1.1); if (e.key === '-') zoomAt(1 / 1.1); });

// ---------- hands ----------
const tips = [0, 1].map(() => [0, 1].map(() => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf4efe2 }));
  m.visible = false; scene.add(m); return m;
}));
const hands = { left: { pinch: false }, right: { pinch: false } };
const v3 = j => new THREE.Vector3(j.transform.position.x, j.transform.position.y, j.transform.position.z);
let span = null;
function handFrame(frame, ref) {
  let i = 0;
  for (const src of renderer.xr.getSession().inputSources) {
    if (!src.hand || i > 1) continue;
    const h = hands[src.handedness === 'left' ? 'left' : 'right'], [mt, mi] = tips[i++];
    const th = frame.getJointPose(src.hand.get('thumb-tip'), ref), ix = frame.getJointPose(src.hand.get('index-finger-tip'), ref);
    if (!th || !ix) { mt.visible = mi.visible = false; h.pinch = false; continue; }
    const pt = v3(th), pi = v3(ix); mt.position.copy(pt); mi.position.copy(pi); mt.visible = mi.visible = true;
    const was = h.pinch; h.pinch = pt.distanceTo(pi) < (was ? PINCH_OFF : PINCH_ON);
    mt.material.color.set(h.pinch ? 0xf2d47a : 0xf4efe2);
    const local = board.worldToLocal(pt.clone().add(pi).multiplyScalar(0.5));
    h.now = [local.x, local.y]; if (h.pinch && !was) h.at = h.now;
  }
  const { left: l, right: r } = hands;
  if (l.pinch && r.pinch) {                                     // both hands: the distance between them is the zoom
    const d = Math.hypot(l.now[0] - r.now[0], l.now[1] - r.now[1]), mid = [(l.now[0] + r.now[0]) / 2, (l.now[1] + r.now[1]) / 2];
    if (span) zoomAt(d / span, mid);
    span = d;
  } else {
    span = null;
    for (const h of [l, r]) if (h.pinch && h.at) { steer(h.now[0] - h.at[0], h.now[1] - h.at[1]); h.at = h.now; }
  }
}
$('enter').onclick = async () => {
  if (!navigator.xr || !(await navigator.xr.isSessionSupported('immersive-vr').catch(() => false))) { $('tip').textContent = t('noxr'); return; }
  const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking', 'local-floor'] });
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);
  vrLayout(); ui();
  session.addEventListener('end', () => { layout(); tips.flat().forEach(m => (m.visible = false)); ui(); });
};
$('mr').onclick = async () => {
  const session = await requestMR();
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);
  mr = true; scene.background = null; mrLayout();
  await place.start(session, () => { mount.position.set(0, -0.1, -0.6); }, ui);
  ui();
  session.addEventListener('end', () => {
    mr = false; place.stop(); scene.background = new THREE.Color(0x0b1412);
    layout(); tips.flat().forEach(m => (m.visible = false)); ui();
  });
};
mrSupported().then(ok => { $('mr').hidden = !ok; });

// ---------- loop ----------
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); if (!renderer.xr.isPresenting) layout(); });
let last = 0;
renderer.setAnimationLoop((time, frame) => {
  const dt = Math.min(0.05, (time - last) / 1000 || 0); last = time;
  if (frame && mr) place.frame(frame, renderer.xr.getReferenceSpace());
  if (frame && (!mr || place.pinned)) handFrame(frame, renderer.xr.getReferenceSpace());
  // The dive: one level (×φ) every 2.5 s, turning slowly, so the eye follows the girih down.
  if (diving) { zoomAt(PHI ** (dt / 2.5)); rot += dt * 0.05; board.rotation.z = rot; }
  renderer.render(scene, camera);
});
$('theta').value = theta / DEG;
prepare(); layout(); draw();
window.zoom = { get level() { return level; }, get s() { return s; }, get mr() { return mr; }, get pinned() { return place.pinned; },
                get facing() { const n = new THREE.Vector3(0, 0, 1).applyQuaternion(board.getWorldQuaternion(new THREE.Quaternion())), p = board.getWorldPosition(new THREE.Vector3()); return { at: p.toArray(), normal: n.toArray() }; }, get layers() { return L3.map(m => m.geometry.getAttribute('position').count / 6); },
                zoomAt, steer, dive: on => { diving = on; ui(); } };

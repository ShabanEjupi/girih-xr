// Girih XR — a seated, hands-only puzzle: pinch a tile, turn your wrist to rotate it, drop it into the pattern.
// The same rules run with a mouse in a normal browser, so the puzzle can be played (and tested) without a headset.
import * as THREE from './vendor/three.module.js';
import { TILES, centred, placed, strap, LEVELS, fits } from './girih.js';

const S = 0.06;                 // metres per girih edge in VR
const PINCH_ON = 0.018, PINCH_OFF = 0.035, GRAB = 0.06;
const T = {
  en: { title: 'Girih XR', level: 'Pattern', of: 'of', left: 'tiles left', done: 'Pattern complete!', all: 'All patterns complete. MashaAllah — well done.',
        hint: 'Pinch a tile, turn your wrist to rotate it, release it in its place.', hintMouse: 'Drag a tile. Scroll or Q / E to rotate it.', hintTouch: 'Drag a tile. Turn it with ⟲ ⟳ while it is selected.',
        enter: 'Enter VR', noxr: 'Hand tracking needs a VR headset; the mouse version works here.', paused: 'Paused', restart: 'Restart', lang: 'Shqip',
        decoy: 'Not every tile belongs in every pattern.' },
  sq: { title: 'Girih XR', level: 'Modeli', of: 'nga', left: 'pllaka mbetur', done: 'Modeli u plotësua!', all: 'Të gjitha modelet u plotësuan. MashaAllah — të lumtë.',
        hint: 'Kape pllakën me dy gishta, rrotulloje me kyçin e dorës, lëshoje në vendin e saj.', hintMouse: 'Tërhiq një pllakë. Rrotullo me rrotën ose Q / E.', hintTouch: 'Tërhiq një pllakë. Rrotulloje me ⟲ ⟳.',
        enter: 'Hyr në VR', noxr: 'Duart kërkojnë syze VR; versioni me mi punon këtu.', paused: 'Pauzë', restart: 'Rifillo', lang: 'English',
        decoy: 'Jo çdo pllakë i takon çdo modeli.' },
};

const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('girih-xr:' + k)) ?? d; } catch { return d; } },
                set(k, v) { try { localStorage.setItem('girih-xr:' + k, JSON.stringify(v)); } catch {} } };
let lang = store.get('lang', (navigator.language || '').startsWith('sq') ? 'sq' : 'en');
const t = k => T[lang][k];

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10201c);
scene.add(new THREE.HemisphereLight(0xf4efe2, 0x203a33, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(0.3, 1, 0.5); scene.add(sun);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 50);

// The board: girih units in its local x/y plane. Desktop: looked at from above. VR: a tilted tabletop at lap height.
const board = new THREE.Group(); scene.add(board);
const table = new THREE.Mesh(new THREE.CircleGeometry(7.2, 64), new THREE.MeshStandardMaterial({ color: 0xe9e1cf, roughness: 0.9 }));
table.position.z = -0.02; board.add(table);
const layer = { slots: new THREE.Group(), pieces: new THREE.Group(), lines: new THREE.Group() };
Object.values(layer).forEach(g => board.add(g));
function deskView() {
  board.scale.setScalar(1); board.position.set(0, 0, 0); board.rotation.set(0, 0, 0);
  // Fit the whole board (about 15 units wide, 16 tall) on any screen, portrait phones included.
  const tan = Math.tan(camera.fov * Math.PI / 360), dist = Math.max(8.2 / tan, 7.8 / (tan * camera.aspect));
  camera.position.set(0, -1.2, dist); camera.lookAt(0, -0.6, 0);
}
function vrView() {
  board.scale.setScalar(S); board.position.set(0, -0.36, -0.5); board.rotation.set(-Math.PI / 2 + 0.75, 0, 0);
}
deskView();

const shapeOf = kind => { const s = new THREE.Shape(); centred(kind).forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); return s; };
const geo = {};
for (const k of Object.keys(TILES)) geo[k] = new THREE.ExtrudeGeometry(shapeOf(k), { depth: 0.18, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });

// ---------- level state ----------
let level = 0, pieces = [], slots = [], started = 0, pausedAt = 0, pausedTotal = 0;
function build(n, filled = []) {
  level = Math.min(n, LEVELS.length - 1);
  for (const g of Object.values(layer)) g.clear();
  pieces = []; slots = [];
  const L = LEVELS[level];
  for (const [i, s] of L.slots.entries()) {
    const pts = placed(s).map(([x, y]) => new THREE.Vector3(x, y, 0.005));
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8a7f66 }));
    const fill = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(s.kind)), new THREE.MeshBasicMaterial({ color: 0xd8ceb6, transparent: true, opacity: 0.55 }));
    fill.position.set(s.x, s.y, 0.002); fill.rotation.z = s.r * Math.PI / 180;
    layer.slots.add(line, fill);
    slots.push({ ...s, i, filled: filled.includes(i) });
  }
  // The tray: every slot's tile plus the decoys, shuffled on a ring round the pattern, starting nearest the player.
  const kinds = [...L.slots.map(s => s.kind), ...L.decoys];
  const order = kinds.map((k, i) => [Math.sin(i * 12.9898 + level * 78.233) * 43758.5 % 1, k]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  order.forEach((kind, i) => {
    const m = new THREE.Mesh(geo[kind], new THREE.MeshStandardMaterial({ color: TILES[kind].colour, roughness: 0.55, metalness: 0.05 }));
    // Only the near half of the table: seated, the far side would be out of reach. Two arcs when there are many tiles.
    const rows = order.length > 8 ? 2 : 1, per = Math.ceil(order.length / rows), row = i % rows, j = Math.floor(i / rows);
    const a = -Math.PI / 2 + (j - (per - 1) / 2) * 0.42 + row * 0.21, rad = 4.6 + row * 1.6;
    m.position.set(Math.cos(a) * rad, Math.sin(a) * rad, 0.02);
    m.rotation.z = ((i * 3 + 1) % 5) * 36 * Math.PI / 180;   // start turned, so rotating is part of the puzzle
    m.scale.setScalar(kind === 'decagon' ? 0.62 : 0.78);      // tray size; full size once placed
    m.userData = { kind, home: m.position.clone(), placed: -1 };
    layer.pieces.add(m); pieces.push(m);
  });
  // Restore tiles already placed (progress survives a reload or taking the headset off).
  for (const s of slots) if (s.filled) { const p = pieces.find(p => p.userData.kind === s.kind && p.userData.placed < 0); if (p) settle(p, s, true); }
  started = performance.now(); pausedTotal = 0;
  ui();
  // Reloaded during the short pause after finishing a pattern: finish it again, which opens the next one.
  if (slots.length && slots.every(s => s.filled)) complete();
}
const deg = m => ((m.rotation.z * 180 / Math.PI) % 360 + 360) % 360;
function settle(p, s, quiet) {
  p.position.set(s.x, s.y, 0.02); p.rotation.z = s.r * Math.PI / 180; p.scale.setScalar(1);
  p.userData.placed = s.i; s.filled = true;
  if (!quiet) { chime(slots.filter(x => x.filled).length); save(); if (slots.every(x => x.filled)) complete(); }
}
function release(p) {
  const { kind } = p.userData;
  const s = slots.find(s => !s.filled && fits(kind, p.position.x, p.position.y, deg(p), s));
  if (s) return settle(p, s);
  // Dropped off the table (out of reach when seated): it slides back to its place in the tray.
  if (Math.hypot(p.position.x, p.position.y) > 6.8) p.position.copy(p.userData.home);
  p.scale.setScalar(kind === 'decagon' ? 0.62 : 0.78);
  p.rotation.z = Math.round(deg(p) / 36) * 36 * Math.PI / 180;
}
function complete() {
  for (const s of slots) {
    const seg = strap(s).flatMap(([a, b]) => [new THREE.Vector3(a[0], a[1], 0.3), new THREE.Vector3(b[0], b[1], 0.3)]);
    layer.lines.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), new THREE.LineBasicMaterial({ color: 0xfdf8e8 })));
  }
  fanfare();
  msg = level < LEVELS.length - 1 ? t('done') : t('all');
  ui();
  if (level < LEVELS.length - 1) setTimeout(() => { store.set('level', level + 1); store.set('filled', []); msg = ''; build(level + 1); }, 4200);
}
const save = () => { store.set('level', level); store.set('filled', slots.filter(s => s.filled).map(s => s.i)); };

// ---------- sound (synthesised; no files) ----------
let ac;
const tone = (f, at, d = 0.35, v = 0.12) => {
  ac ??= new AudioContext();
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(v, ac.currentTime + at);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + at + d);
  o.connect(g).connect(ac.destination); o.start(ac.currentTime + at); o.stop(ac.currentTime + at + d);
};
const scale = [392, 440, 494, 523, 587, 659, 740, 784, 880, 988, 1047];
const chime = n => tone(scale[(n - 1) % scale.length], 0);
const fanfare = () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.6));
const tick = () => tone(1200, 0, 0.05, 0.04);

// ---------- 2D overlay (desktop) and a canvas panel (VR) ----------
let msg = '';
const hud = document.getElementById('hud');
const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 320;
const panelTex = new THREE.CanvasTexture(canvas);
const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), new THREE.MeshBasicMaterial({ map: panelTex, transparent: true }));
panel.visible = false; scene.add(panel);
const left = () => slots.filter(s => !s.filled).length;
function ui() {
  const vr = renderer.xr.isPresenting;
  document.title = `${t('title')} — ${t('level')} ${level + 1}`;
  hud.querySelector('.lvl').textContent = `${t('level')} ${level + 1} ${t('of')} ${LEVELS.length}`;
  hud.querySelector('.left').textContent = `${left()} ${t('left')}`;
  hud.querySelector('.msg').textContent = msg || (vr ? t('hint') : matchMedia('(pointer: coarse)').matches ? t('hintTouch') : t('hintMouse'));
  hud.querySelector('.sub').textContent = LEVELS[level].decoys.length ? t('decoy') : '';
  document.getElementById('enter').textContent = t('enter');
  document.getElementById('lang').textContent = t('lang');
  document.getElementById('restart').textContent = t('restart');
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, 1024, 320);
  c.fillStyle = 'rgba(12,28,24,0.82)'; c.beginPath(); c.roundRect(0, 0, 1024, 320, 36); c.fill();
  c.fillStyle = '#f4efe2'; c.font = '600 58px system-ui, sans-serif'; c.fillText(`${t('level')} ${level + 1} ${t('of')} ${LEVELS.length} · ${left()} ${t('left')}`, 40, 92);
  c.font = '40px system-ui, sans-serif'; c.fillStyle = '#d9c98f';
  wrap(c, msg || (pausedAt ? t('paused') : t('hint')), 40, 170, 944, 50);
  panelTex.needsUpdate = true;
}
function wrap(c, s, x, y, w, lh) {
  let line = '';
  for (const word of s.split(' ')) { const test = line + word + ' '; if (c.measureText(test).width > w && line) { c.fillText(line, x, y); line = word + ' '; y += lh; } else line = test; }
  c.fillText(line, x, y);
}

// ---------- mouse / touch ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
let drag = null;
const boardPoint = e => {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(plane, new THREE.Vector3());
};
renderer.domElement.addEventListener('pointerdown', e => {
  if (renderer.xr.isPresenting) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pieces.filter(p => p.userData.placed < 0))[0];
  if (!hit) return;
  const p = hit.object, at = boardPoint(e);
  drag = { p, dx: p.position.x - at.x, dy: p.position.y - at.y };
  p.scale.setScalar(1); p.position.z = 0.3; tick();
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!drag) return;
  const at = boardPoint(e); drag.p.position.x = at.x + drag.dx; drag.p.position.y = at.y + drag.dy;
});
renderer.domElement.addEventListener('pointerup', () => { if (!drag) return; drag.p.position.z = 0.02; release(drag.p); drag = null; ui(); });
const turn = dir => {
  const p = drag?.p ?? pieces.filter(p => p.userData.placed < 0).at(-1); if (!p) return;
  p.rotation.z += dir * 36 * Math.PI / 180; tick();
};
addEventListener('wheel', e => { if (drag) { e.preventDefault(); turn(Math.sign(e.deltaY)); } }, { passive: false });
addEventListener('keydown', e => { if (e.key === 'q' || e.key === 'Q') turn(1); if (e.key === 'e' || e.key === 'E') turn(-1); });
document.getElementById('rotL').onclick = () => turn(1);
document.getElementById('rotR').onclick = () => turn(-1);
document.getElementById('lang').onclick = () => { lang = lang === 'en' ? 'sq' : 'en'; store.set('lang', lang); document.documentElement.lang = lang; ui(); };
document.getElementById('restart').onclick = () => { store.set('level', 0); store.set('filled', []); msg = ''; build(0); };

// ---------- hands (WebXR hand tracking) ----------
const tips = [0, 1].map(() => ['thumb-tip', 'index-finger-tip'].map(() => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf4efe2 }));
  m.visible = false; scene.add(m); return m;
}));
const hands = [{ held: null, pinch: false }, { held: null, pinch: false }];
const v = (p) => new THREE.Vector3(p.transform.position.x, p.transform.position.y, p.transform.position.z);
// The hand's heading on the board: the line across the knuckles (index → little finger), seen from above the board.
function heading(frame, hand, ref) {
  const a = frame.getJointPose(hand.get('index-finger-metacarpal'), ref), b = frame.getJointPose(hand.get('pinky-finger-metacarpal'), ref);
  if (!a || !b) return null;
  const pa = board.worldToLocal(v(a)), pb = board.worldToLocal(v(b));
  return Math.atan2(pa.y - pb.y, pa.x - pb.x) * 180 / Math.PI;
}
function handFrame(frame, ref) {
  const session = renderer.xr.getSession();
  let i = 0;
  for (const src of session.inputSources) {
    if (!src.hand || i > 1) continue;
    const h = hands[i], [mt, mi] = tips[i]; i++;
    const th = frame.getJointPose(src.hand.get('thumb-tip'), ref), ix = frame.getJointPose(src.hand.get('index-finger-tip'), ref);
    if (!th || !ix) { mt.visible = mi.visible = false; continue; }
    const pt = v(th), pi = v(ix);
    mt.position.copy(pt); mi.position.copy(pi); mt.visible = mi.visible = true;
    const d = pt.distanceTo(pi), mid = pt.clone().add(pi).multiplyScalar(0.5);
    const was = h.pinch; h.pinch = d < (was ? PINCH_OFF : PINCH_ON);
    mt.material.color.set(h.pinch ? 0xd9c98f : 0xf4efe2);
    const local = board.worldToLocal(mid.clone());
    if (h.pinch && !was) {
      // Grab the nearest loose tile within reach of the pinch.
      let best = null, bd = GRAB / S;
      for (const p of pieces) {
        if (p.userData.placed >= 0 || hands.some(o => o.held === p)) continue;
        const dd = Math.hypot(p.position.x - local.x, p.position.y - local.y);
        if (dd < bd) { bd = dd; best = p; }
      }
      if (best) {
        h.held = best; h.dx = best.position.x - local.x; h.dy = best.position.y - local.y;
        h.r0 = deg(best); h.a0 = heading(frame, src.hand, ref) ?? 0; h.step = Math.round(h.r0 / 36);
        best.scale.setScalar(1); tick();
      }
    } else if (h.pinch && h.held) {
      h.held.position.set(local.x + h.dx, local.y + h.dy, Math.max(0.3, local.z));
      const a = heading(frame, src.hand, ref);
      if (a != null) {
        const r = h.r0 + (((a - h.a0 + 540) % 360) - 180);
        const step = Math.round(r / 36);
        if (step !== h.step) { h.step = step; tick(); }
        h.held.rotation.z = step * 36 * Math.PI / 180;       // the tile clicks through 36° steps, like a dial
      }
    } else if (!h.pinch && was && h.held) {
      h.held.position.z = 0.02; release(h.held); h.held = null; ui();
    }
  }
}

// ---------- VR session ----------
document.getElementById('enter').onclick = async () => {
  if (!navigator.xr || !(await navigator.xr.isSessionSupported('immersive-vr').catch(() => false))) { msg = t('noxr'); return ui(); }
  const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking', 'local-floor'] });
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);
  vrView(); panel.visible = true; panel.position.set(0, 0.06, -0.85); panel.rotation.x = -0.1;
  scene.background = new THREE.Color(0x0e1a17);
  // Taking the headset off or opening the system menu pauses the clock; progress is already saved per tile.
  session.addEventListener('visibilitychange', () => { pausedAt = session.visibilityState === 'visible' ? 0 : performance.now(); ui(); });
  session.addEventListener('end', () => { deskView(); panel.visible = false; tips.flat().forEach(m => m.visible = false); scene.background = new THREE.Color(0x10201c); ui(); });
  ui();
};
document.addEventListener('visibilitychange', () => { pausedAt = document.hidden ? performance.now() : 0; });

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); if (!renderer.xr.isPresenting) deskView(); });
renderer.setAnimationLoop((time, frame) => {
  if (frame && !pausedAt) handFrame(frame, renderer.xr.getReferenceSpace());
  renderer.render(scene, camera);
});

document.documentElement.lang = lang;
build(store.get('level', 0), store.get('filled', []));
window.girih = { get level() { return level; }, slots: () => slots.map(s => ({ kind: s.kind, filled: s.filled, x: s.x, y: s.y, r: s.r })),
                 tips: () => tips.flat().map(m => m.visible ? m.getWorldPosition(new THREE.Vector3()).toArray() : null),
                 toWorld: (x, y, z = 0) => board.localToWorld(new THREE.Vector3(x, y, z)).toArray(),
                 normal: () => new THREE.Vector3(0, 0, 1).applyQuaternion(board.getWorldQuaternion(new THREE.Quaternion())).toArray(),
                 toScreen: (x, y) => { const p = board.localToWorld(new THREE.Vector3(x, y, 0)).project(camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; },
                 pieces: () => pieces.map(p => ({ kind: p.userData.kind, placed: p.userData.placed, x: p.position.x, y: p.position.y, r: deg(p) })), board, S };

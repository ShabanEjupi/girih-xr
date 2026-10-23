// Quasicrystal Lab — the girih tiling as physics. A Penrose tiling is a flat slice through a 5-dimensional cubic
// lattice; the player slides that slice with one hand (tiles flip, gold), turns the crystal and bends its girih lines
// with the other, and a live X-ray diffraction pattern answers. Missions: recover a hidden structure from its
// diffraction alone, the way crystallographers solve real crystals.
import * as THREE from './vendor/three.module.js';
import { pentagrid, gammas, flips, hankin, samples, similarity, fingerprint, MISSIONS, SOLVED } from './quasi.js';
import { mrSupported, requestMR, placer } from './mr.js';
import { together, roomLink } from './together.js';

const DEG = Math.PI / 180, R_TILES = 5.6, R_PTS = 5, WIN = 3, KMAX = 1.6, RT = 160, S = 0.035;
const PINCH_ON = 0.018, PINCH_OFF = 0.035;
const T = {
  en: { mission: 'Mission', of: 'of', free: 'Free lab', target: 'Target diffraction', yours: 'Your crystal', enter: 'Enter VR', lang: 'Shqip', back: 'Puzzle',
        m0: 'Turn the crystal until its diffraction matches the target.',
        m1: 'Change the contact angle of the girih lines until the peaks match.',
        m2: 'Angle and orientation both unknown. Solve the structure from its diffraction alone.',
        f: 'Free lab. Drag the tiling: you are sliding the cut through a 5-dimensional lattice. Tiles flip (gold), yet the diffraction hardly changes: the hallmark of a quasicrystal.',
        solved: 'Solved', all: 'All three structures solved. MashaAllah — you think like a crystallographer.',
        sub: 'Penrose tiling from de Bruijn\'s pentagrid (a slice of a 5D lattice) · girih lines by Hankin\'s polygons-in-contact method · diffraction |Σ e^(−2πi k·r)|² computed live, ten-fold like real quasicrystals.',
        mouse: 'Drag the tiling to slide the 5D cut. θ bends the girih lines, φ turns the crystal (wheel and Q / E too).',
        hands: 'Right hand: pinch and drag to slide the 5D cut. Left hand: pinch, twist to turn the crystal, raise or lower to bend the lines.',
        noxr: 'Hand tracking needs a VR headset; everything works here with a mouse or touch.', match: 'match',
        mr: 'On my table', place: 'Look at a table or a wall, then pinch: the crystal is set down there.',
        invite: 'Lab for two', copy: 'Copy the link', here: 'here', copied: 'Link copied — send it to the other person.' },
  sq: { mission: 'Misioni', of: 'nga', free: 'Laborator i lirë', target: 'Difraksioni i synuar', yours: 'Kristali yt', enter: 'Hyr në VR', lang: 'English', back: 'Enigma',
        m0: 'Rrotullo kristalin derisa difraksioni i tij të përputhet me të synuarin.',
        m1: 'Ndrysho këndin e takimit të vijave girih derisa majat të përputhen.',
        m2: 'As këndi as drejtimi nuk dihen. Gjeje strukturën vetëm nga difraksioni i saj.',
        f: 'Laborator i lirë. Tërhiq pllakat: po e rrëshqet prerjen nëpër një rrjetë 5-dimensionale. Pllakat kthehen (ari), por difraksioni mezi ndryshon: shenja dalluese e një kuazikristali.',
        solved: 'U zgjidh', all: 'Të tria strukturat u zgjidhën. MashaAllah — mendon si kristalograf.',
        sub: 'Pllakëzimi Penrose nga pentarrjeta e de Bruijn-it (prerje e një rrjete 5D) · vijat girih me metodën e Hankin-it · difraksioni |Σ e^(−2πi k·r)|² llogaritet drejtpërdrejt, dhjetëfish si te kuazikristalet e vërteta.',
        mouse: 'Tërhiq pllakat për të rrëshqitur prerjen 5D. θ përkul vijat girih, φ rrotullon kristalin (edhe rrota dhe Q / E).',
        hands: 'Dora e djathtë: kape dhe tërhiq për të rrëshqitur prerjen 5D. E majta: kape, rrotullo kyçin për drejtimin, ngrite ose ule për të përkulur vijat.',
        noxr: 'Duart kërkojnë syze VR; këtu gjithçka punon me mi ose prekje.', match: 'përputhje',
        mr: 'Mbi tavolinë', place: 'Shiko një tavolinë ose mur dhe kape me dy gishta: kristali vendoset aty.',
        invite: 'Laborator për dy', copy: 'Kopjo lidhjen', here: 'këtu', copied: 'Lidhja u kopjua — dërgoja personit tjetër.' },
};
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('girih-lab:' + k)) ?? d; } catch { return d; } },
                set(k, v) { try { localStorage.setItem('girih-lab:' + k, JSON.stringify(v)); } catch {} } };
let lang = store.get('lang', (navigator.language || '').startsWith('sq') ? 'sq' : 'en');
const t = k => T[lang][k];

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });   // alpha: passthrough shows through in MR
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1412);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 80);
// mount = where the crystal sits in the room (identity on screen and in VR, the pinned table or wall in MR).
const mount = new THREE.Group(), board = new THREE.Group(), crystal = new THREE.Group(); board.add(crystal); mount.add(board); scene.add(mount);
const place = placer(scene, mount);
let mr = false;
const disc = new THREE.Mesh(new THREE.CircleGeometry(R_TILES + 0.9, 96), new THREE.MeshBasicMaterial({ color: 0x15231f }));
disc.position.z = -0.03; board.add(disc);

// Tiles: one mesh, two triangles per rhomb, colours per vertex so flipped rhombs can glow and fade.
const tileGeo = new THREE.BufferGeometry(), tiles = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ vertexColors: true }));
const strapGeo = new THREE.BufferGeometry(), straps = new THREE.Mesh(strapGeo, new THREE.MeshBasicMaterial({ color: 0xf2d47a, side: THREE.DoubleSide }));
straps.position.z = 0.01; crystal.add(tiles, straps);
const THICK = new THREE.Color(0x1f5c52), THIN = new THREE.Color(0x2f7a6c), GOLD = new THREE.Color(0xf2d47a);

// Diffraction on the GPU: every pixel sums the waves scattered by every point of the strapwork.
const MAXP = 64 * 64, ptsData = new Float32Array(MAXP * 4), ptsTex = new THREE.DataTexture(ptsData, 64, 64, THREE.RGBAFormat, THREE.FloatType);
const diffMat = new THREE.ShaderMaterial({
  uniforms: { pts: { value: ptsTex }, count: { value: 0 }, kmax: { value: KMAX * 1.4 }, phi: { value: 0 }, norm: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }',
  fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D pts; uniform int count; uniform float kmax, phi, norm;
    void main(){
      vec2 g = (vUv * 2.0 - 1.0) * kmax; float c = cos(-phi), s = sin(-phi);
      vec2 k = 6.2831853 * vec2(g.x * c - g.y * s, g.x * s + g.y * c);
      float re = 0.0, im = 0.0;
      for (int i = 0; i < ${MAXP}; i++) { if (i >= count) break;
        vec4 p = texelFetch(pts, ivec2(i % 64, i / 64), 0); float a = dot(k, p.xy); re += p.z * cos(a); im -= p.z * sin(a); }
      float v = smoothstep(0.3, 1.0, clamp(log(1.0 + (re * re + im * im) * norm) / 4.2, 0.0, 1.0));   // speckle floor off
      if (length(g) < 0.25) v = 0.0;                    // beam stop
      vec3 col = mix(vec3(0.03, 0.07, 0.06), vec3(0.10, 0.45, 0.40), smoothstep(0.0, 0.45, v));
      col = mix(col, vec3(0.95, 0.83, 0.48), smoothstep(0.45, 0.8, v)); col = mix(col, vec3(1.0), smoothstep(0.85, 1.0, v));
      gl_FragColor = vec4(col, 1.0); }`,
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), diffMat), quadScene = new THREE.Scene(), quadCam = new THREE.Camera();
quad.frustumCulled = false; quadScene.add(quad);
const rtTarget = new THREE.WebGLRenderTarget(RT, RT), rtLive = new THREE.WebGLRenderTarget(RT, RT);
function renderDiffraction(points, phi, rt) {
  const n = Math.min(points.length, MAXP); let W = 0;
  for (let i = 0; i < n; i++) {
    const [x, y] = points[i], w = Math.exp(-(x * x + y * y) / (2 * WIN * WIN));
    ptsData.set([x, y, w, 0], i * 4); W += w * w;
  }
  ptsTex.needsUpdate = true;
  const u = diffMat.uniforms; u.count.value = n; u.phi.value = phi; u.norm.value = 1 / W;
  const xr = renderer.xr.enabled; renderer.xr.enabled = false;
  renderer.setRenderTarget(rt); renderer.render(quadScene, quadCam); renderer.setRenderTarget(null);
  renderer.xr.enabled = xr;
}
const label = () => { const c = document.createElement('canvas'); c.width = 512; c.height = 64; return c; };
function screen(rt) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rt.texture })));
  const c = label(), tex = new THREE.CanvasTexture(c), m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.125), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.position.y = 0.6; g.add(m); g.userData = { c, tex }; scene.add(g); return g;
}
const scrTarget = screen(rtTarget), scrLive = screen(rtLive);
const write = (scr, s) => { const c = scr.userData.c.getContext('2d'); c.clearRect(0, 0, 512, 64); c.fillStyle = '#d9c98f'; c.font = '600 34px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(s, 256, 44); scr.userData.tex.needsUpdate = true; };

// ---------- state ----------
// The live diffraction is the costly part (thousands of waves per pixel): while a hand drags, it is redrawn at most
// every 90 ms, from the latest crystal.
let live = null, liveAt = 0, duo = null, peers = 1;
let m = Math.min(store.get('mission', 0), MISSIONS.length), theta, phi, p = [0, 0], prev = [], flash = new Map(), score = 0, msg = '', target = null;
const free = () => m >= MISSIONS.length ? ['theta', 'phi'] : MISSIONS[m].free;
const need = () => MISSIONS[m]?.need ?? SOLVED;
function start(n) {
  m = n; store.set('mission', m); msg = ''; p = [0, 0]; prev = [];
  const M = MISSIONS[m];
  theta = M ? M.start.theta : store.get('theta', 45 * DEG); phi = M ? M.start.phi : 0;
  if (M) { target = fingerprint(M.theta, M.phi); renderDiffraction(samples(hankin(pentagrid(R_PTS), M.theta)), M.phi, rtTarget); }
  scrTarget.visible = !!M; layout(); rebuild(true);
}
function rebuild(scoreToo) {
  const T0 = pentagrid(R_TILES, gammas(p)), now = performance.now();
  if (prev.length) for (const f of flips(prev, T0)) flash.set(f.c.join(), now);
  prev = T0;
  const pos = [], col = [];
  for (const tl of T0) {
    const [a, b, c, d] = tl.v, base = tl.thick ? THICK : THIN;
    // Drawn 4 % smaller than true size, so the dark ground shows through as grout between the tiles.
    const k = 0.96, at = q => [tl.c[0] + (q[0] - tl.c[0]) * k, tl.c[1] + (q[1] - tl.c[1]) * k];
    for (const q of [a, b, c, a, c, d].map(at)) pos.push(q[0], q[1], 0);
    tl.base = base;
    for (let i = 0; i < 6; i++) col.push(base.r, base.g, base.b);
  }
  tileGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  tileGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); tileGeo.userData.tiles = T0;
  const seg = hankin(T0, theta), sp = [], w = 0.035;
  for (const [a, b] of seg) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * w, ny = dx / L * w;
    const q = [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
    for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) sp.push(v[0], v[1], 0);
  }
  strapGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  crystal.rotation.z = phi;
  // While a mission is locked after a solve (m past the end), only the crystal is shared, not the lock.
  duo?.local(m <= MISSIONS.length ? { mission: m, p, theta, phi } : { p, theta, phi });
  live = () => renderDiffraction(samples(hankin(T0.filter(tl => Math.hypot(...tl.c) <= R_PTS), theta)), phi, rtLive);
  if (scoreToo && MISSIONS[m]) {
    score = similarity(target, fingerprint(theta, phi));
    if (score >= need()) solved();
  }
  ui();
}
function solved() {
  const M = MISSIONS[m]; theta = M.theta; phi = M.phi;
  msg = `${t('solved')}: θ = ${(theta / DEG).toFixed(1)}°, φ = ${(phi / DEG).toFixed(1)}°` + (m === MISSIONS.length - 1 ? ' — ' + t('all') : '');
  fanfare(); const next = m + 1; store.set('mission', next);
  setTimeout(() => start(next), 4000);
  m = MISSIONS.length + 1;                                         // locked until the next mission opens
}
function nudge(k, d) {
  if (!free().includes(k)) return;
  if (k === 'theta') theta = Math.min(80 * DEG, Math.max(20 * DEG, theta + d));
  else phi = ((phi + d) % (36 * DEG) + 36 * DEG) % (36 * DEG);    // ten-fold: 36° brings it back to itself
  if (m >= MISSIONS.length) store.set('theta', theta);
  rebuild(true);
}

// ---------- layout ----------
function layout() {
  const portrait = innerHeight > innerWidth * 1.1, both = scrTarget.visible;
  board.scale.setScalar(1); board.rotation.set(0, 0, 0);
  for (const s of [scrTarget, scrLive]) s.scale.setScalar(5.6), s.rotation.set(0, 0, 0);
  let w, h;
  if (portrait) {
    board.position.set(0, 4.2, 0);
    scrLive.position.set(both ? 3.1 : 0, -4.6, 0); scrTarget.position.set(-3.1, -4.6, 0);
    w = 13.4; h = 30;
  } else {
    board.position.set(-4.4, -0.6, 0);
    scrLive.position.set(both ? 9.2 : 6.2, both ? -3.6 : 0, 0); scrTarget.position.set(9.2, 3.4, 0);
    if (both) { scrLive.scale.setScalar(5.2); scrTarget.scale.setScalar(5.2); scrLive.position.x = scrTarget.position.x = 6.4; }
    w = both ? 24 : 23; h = 17.5;
  }
  const tan = Math.tan(camera.fov * DEG / 2), dist = Math.max(h / 2 / tan, w / 2 / (tan * camera.aspect));
  const cy = portrait ? 2.5 : 0.9, cx = portrait ? 0 : 1.2;
  camera.position.set(cx, cy, dist); camera.lookAt(cx, cy, 0);
}
function vrLayout() {
  board.scale.setScalar(S); board.position.set(0, -0.34, -0.48); board.rotation.set(-Math.PI / 2 + 0.75, 0, 0);
  for (const s of [scrTarget, scrLive]) s.scale.setScalar(0.24);
  scrTarget.position.set(-0.16, 0.06, -0.78); scrLive.position.set(scrTarget.visible ? 0.16 : 0, 0.06, -0.78);
  scrTarget.rotation.set(0, 0.25, 0); scrLive.rotation.set(0, scrTarget.visible ? -0.25 : 0, 0);
}

// ---------- sound ----------
let ac;
const tone = (f, at, d = 0.35, v = 0.12) => {
  ac ??= new AudioContext();
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(v, ac.currentTime + at);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + at + d);
  o.connect(g).connect(ac.destination); o.start(ac.currentTime + at); o.stop(ac.currentTime + at + d);
};
const fanfare = () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.6));

// ---------- HUD (desktop) and panel (VR) ----------
const hud = document.getElementById('hud'), $ = id => document.getElementById(id);
const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 300;
const panelTex = new THREE.CanvasTexture(canvas);
const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.135), new THREE.MeshBasicMaterial({ map: panelTex, transparent: true }));
panel.visible = false; scene.add(panel);
function ui() {
  const vr = renderer.xr.isPresenting, M = MISSIONS[Math.min(m, MISSIONS.length)];
  const head = m < MISSIONS.length ? `${t('mission')} ${m + 1} ${t('of')} ${MISSIONS.length}` : m === MISSIONS.length ? t('free') : '';
  const lead = msg || (m < MISSIONS.length ? t('m' + m) : m === MISSIONS.length ? t('f') : '');
  const pct = MISSIONS[m] ? Math.max(0, Math.min(1, (score - 0.5) / (need() - 0.5))) : msg ? 1 : 0;
  document.title = `Quasicrystal Lab — ${head || t('solved')}`;
  if (head) hud.querySelector('.mis').textContent = `${head}${MISSIONS[m] ? ` · ${t('match')} ${Math.round(pct * 100)}%` : ''}`;
  hud.querySelector('.meter').style.visibility = MISSIONS[m] || msg ? 'visible' : 'hidden';
  hud.querySelector('.meter b').style.width = `${pct * 100}%`;
  hud.querySelector('.msg').textContent = lead;
  hud.querySelector('.sub').textContent = (vr ? '' : (matchMedia('(pointer: coarse)').matches ? '' : t('mouse') + ' ')) + t('sub');
  $('lt').hidden = !free().includes('theta'); $('lp').hidden = !free().includes('phi');
  $('theta').value = (theta / DEG).toFixed(1); $('phi').value = (phi / DEG).toFixed(2);
  $('duo').textContent = duo ? `${t('copy')} · ${peers} ${t('here')}` : t('invite');
  $('enter').textContent = t('enter'); $('mr').textContent = t('mr'); $('lang').textContent = t('lang'); $('back').textContent = t('back');
  $('next').textContent = m < MISSIONS.length ? t('free') : `${t('mission')} 1`;
  write(scrTarget, t('target')); write(scrLive, t('yours'));
  const c = canvas.getContext('2d'); c.clearRect(0, 0, 1024, 300);
  c.fillStyle = 'rgba(10,22,19,0.85)'; c.beginPath(); c.roundRect(0, 0, 1024, 300, 34); c.fill();
  c.fillStyle = '#f4efe2'; c.font = '600 48px system-ui, sans-serif'; c.fillText(head + (MISSIONS[m] ? ` · ${Math.round(pct * 100)}%` : ''), 36, 72);
  c.fillStyle = 'rgba(244,239,226,.15)'; c.fillRect(36, 96, 952, 12); c.fillStyle = '#f2d47a'; c.fillRect(36, 96, 952 * pct, 12);
  c.font = '34px system-ui, sans-serif'; c.fillStyle = '#d9c98f';
  wrap(c, msg || (mr && !place.pinned ? t('place') : vr ? t('hands') : lead), 36, 158, 952, 42);
  panelTex.needsUpdate = true;
}
function wrap(c, s, x, y, w, lh) {
  let line = '';
  for (const word of s.split(' ')) { const test = line + word + ' '; if (c.measureText(test).width > w && line) { c.fillText(line, x, y); line = word + ' '; y += lh; } else line = test; }
  c.fillText(line, x, y);
}

// ---------- mouse / touch / keys ----------
let drag = null;
const el = renderer.domElement;
el.addEventListener('pointerdown', e => { if (!renderer.xr.isPresenting) { drag = [e.clientX, e.clientY]; el.setPointerCapture(e.pointerId); } });
el.addEventListener('pointermove', e => {
  if (!drag) return;
  const k = 14 / Math.min(innerWidth, innerHeight);           // ~ one tiling radius per screen = one window of the cut
  p = [p[0] + (e.clientX - drag[0]) * k * 0.08, p[1] - (e.clientY - drag[1]) * k * 0.08]; drag = [e.clientX, e.clientY];
  rebuild(false);
});
el.addEventListener('pointerup', () => { drag = null; });
// With someone else in the lab, the mouse shows as a fingertip on their crystal.
const ray = new THREE.Raycaster();
el.addEventListener('pointermove', e => {
  if (!duo || renderer.xr.isPresenting) return;
  ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, 1 - e.clientY / innerHeight * 2), camera);
  const hit = ray.intersectObject(disc)[0];
  if (hit) { const q = board.worldToLocal(hit.point); duo.hands([[q.x, q.y]]); }
});
$('theta').oninput = e => nudge('theta', e.target.value * DEG - theta);
$('phi').oninput = e => nudge('phi', e.target.value * DEG - phi);
addEventListener('wheel', e => { e.preventDefault(); nudge('theta', -Math.sign(e.deltaY) * 0.5 * DEG); }, { passive: false });
addEventListener('keydown', e => { if (/^[qQ]$/.test(e.key)) nudge('phi', 0.25 * DEG); if (/^[eE]$/.test(e.key)) nudge('phi', -0.25 * DEG); });
$('lang').onclick = () => { lang = lang === 'en' ? 'sq' : 'en'; store.set('lang', lang); document.documentElement.lang = lang; ui(); };
$('next').onclick = () => start(m < MISSIONS.length ? MISSIONS.length : 0);

// ---------- hands ----------
const tips = [0, 1].map(() => [0, 1].map(() => {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf4efe2 }));
  s.visible = false; scene.add(s); return s;
}));
const hands = { left: { pinch: false }, right: { pinch: false } };
const v3 = j => new THREE.Vector3(j.transform.position.x, j.transform.position.y, j.transform.position.z);
function heading(frame, hand, ref) {
  const a = frame.getJointPose(hand.get('index-finger-metacarpal'), ref), b = frame.getJointPose(hand.get('pinky-finger-metacarpal'), ref);
  if (!a || !b) return null;
  const pa = board.worldToLocal(v3(a)), pb = board.worldToLocal(v3(b));
  return Math.atan2(pa.y - pb.y, pa.x - pb.x);
}
function handFrame(frame, ref) {
  let i = 0;
  const mine = [];
  for (const src of renderer.xr.getSession().inputSources) {
    if (!src.hand || i > 1) continue;
    const h = hands[src.handedness === 'left' ? 'left' : 'right'], [mt, mi] = tips[i++];
    const th = frame.getJointPose(src.hand.get('thumb-tip'), ref), ix = frame.getJointPose(src.hand.get('index-finger-tip'), ref);
    if (!th || !ix) { mt.visible = mi.visible = false; continue; }
    const pt = v3(th), pi = v3(ix); mt.position.copy(pt); mi.position.copy(pi); mt.visible = mi.visible = true;
    for (const q of [pt, pi]) { const b = board.worldToLocal(q.clone()); mine.push([b.x, b.y]); }
    const was = h.pinch; h.pinch = pt.distanceTo(pi) < (was ? PINCH_OFF : PINCH_ON);
    mt.material.color.set(h.pinch ? 0xf2d47a : 0xf4efe2);
    const mid = pt.clone().add(pi).multiplyScalar(0.5), local = board.worldToLocal(mid.clone());
    if (h.pinch && !was) Object.assign(h, { x: local.x, y: local.y, wy: mid.y, a: heading(frame, src.hand, ref) });
    else if (h.pinch && h === hands.right) {
      // Sliding the cut: a hand-width of travel moves the slice about a third of the way across the 5D cell.
      p = [p[0] + (local.x - h.x) * 0.06, p[1] + (local.y - h.y) * 0.06]; h.x = local.x; h.y = local.y; rebuild(false);
    } else if (h.pinch) {
      const a = heading(frame, src.hand, ref);
      if (a != null && h.a != null) { const d = ((a - h.a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI; if (Math.abs(d) > 0.004) { nudge('phi', d * 0.5); h.a = a; } }
      const dy = mid.y - h.wy; if (Math.abs(dy) > 0.004) { nudge('theta', dy * 100 * DEG); h.wy = mid.y; }   // 1 cm = 1°
    }
  }
  if (duo && mine.length) duo.hands(mine);
}

// ---------- lab for two ----------
// The other person's fingertips, on the board itself: they land on the same tiles they touch at their end.
const ghosts = new Map();   // peer → { dots, at }
function showHands(from, pts) {
  let g = ghosts.get(from);
  if (!g) {
    g = { dots: [0, 1, 2, 3].map(() => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), new THREE.MeshBasicMaterial({ color: 0x7fd1c7 })); d.visible = false; board.add(d); return d; }), at: 0 };
    ghosts.set(from, g);
  }
  g.at = performance.now();
  g.dots.forEach((d, i) => { const q = pts[i]; d.visible = !!q && q.every(Number.isFinite); if (d.visible) d.position.set(q[0], q[1], 0.12); });
}
$('duo').onclick = async () => {
  if (!duo) { location.href = roomLink(); return; }
  try { await navigator.clipboard.writeText(location.href); msg = t('copied'); } catch { msg = location.href; }
  ui(); setTimeout(() => { msg = ''; ui(); }, 4000);
};
$('enter').onclick = async () => {
  if (!navigator.xr || !(await navigator.xr.isSessionSupported('immersive-vr').catch(() => false))) { msg = t('noxr'); return ui(); }
  const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking', 'local-floor'] });
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);
  vrLayout(); panel.visible = true; panel.position.set(0, 0.33, -0.82); ui();
  session.addEventListener('end', () => { layout(); panel.visible = false; tips.flat().forEach(s => s.visible = false); ui(); });
};
$('mr').onclick = async () => {
  const session = await requestMR();
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);
  mr = true; scene.background = null;
  vrLayout(); board.position.set(0, 0, 0.004); board.rotation.set(0, 0, 0);   // the screens float as in VR; the crystal goes on the surface
  panel.visible = true; panel.position.set(0, 0.33, -0.82);
  await place.start(session, () => { mount.position.set(0, -0.34, -0.48); mount.rotation.set(-Math.PI / 2 + 0.75, 0, 0); }, ui);
  ui();
  session.addEventListener('end', () => {
    mr = false; place.stop(); scene.background = new THREE.Color(0x0b1412);
    layout(); panel.visible = false; tips.flat().forEach(s => s.visible = false); ui();
  });
};
mrSupported().then(ok => { $('mr').hidden = !ok; });

// ---------- loop ----------
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); if (!renderer.xr.isPresenting) layout(); });
renderer.setAnimationLoop((time, frame) => {
  if (frame && mr) place.frame(frame, renderer.xr.getReferenceSpace());
  if (frame && (!mr || place.pinned)) handFrame(frame, renderer.xr.getReferenceSpace());
  if (live && time - liveAt > 90) { live(); live = null; liveAt = time; }
  for (const g of ghosts.values()) if (performance.now() - g.at > 2000) g.dots.forEach(d => (d.visible = false));   // they stopped moving
  if (flash.size) {                                                 // flipped rhombs glow gold, then fade in 0.9 s
    const col = tileGeo.getAttribute('color'), tl = tileGeo.userData.tiles, now = performance.now();
    tl.forEach((x, i) => {
      const at = flash.get(x.c.join()); if (at == null) return;
      const k = Math.max(0, 1 - (now - at) / 900), c = x.base.clone().lerp(GOLD, k);
      for (let j = 0; j < 6; j++) col.setXYZ(i * 6 + j, c.r, c.g, c.b);
      if (!k) flash.delete(x.c.join());
    });
    for (const key of flash.keys()) if (now - flash.get(key) > 900) flash.delete(key);
    col.needsUpdate = true;
  }
  renderer.render(scene, camera);
});

document.documentElement.lang = lang;
duo = together({
  current: () => ({ mission: Math.min(m, MISSIONS.length), p, theta, phi }),
  apply: v => {
    if (v.mission != null && v.mission !== m) start(v.mission);
    if (v.p) p = v.p; if (v.theta != null) theta = v.theta; if (v.phi != null) phi = v.phi;
    rebuild(true);
  },
  onPeers: n => { peers = n; ui(); },
  onHands: showHands,
});
start(m);
window.lab = { get mission() { return m; }, get score() { return score; }, get theta() { return theta / DEG; }, get phi() { return phi / DEG; },
               get p() { return p; }, get mr() { return mr; }, get peers() { return peers; },
               discBox() { const b = new THREE.Box3().setFromObject(disc), q = [b.min, b.max].map(v => v.clone().project(camera)); return [(q[0].x + 1) / 2 * innerWidth, (1 - q[1].y) / 2 * innerHeight, (q[1].x + 1) / 2 * innerWidth, (1 - q[0].y) / 2 * innerHeight]; },
               get ghosts() { return [...ghosts.values()].flatMap(g => g.dots).filter(d => d.visible).length; }, get pinned() { return place.pinned; },
               get facing() { const q = board.getWorldQuaternion(new THREE.Quaternion()); return { at: board.getWorldPosition(new THREE.Vector3()).toArray(), normal: new THREE.Vector3(0, 0, 1).applyQuaternion(q).toArray() }; }, get flipping() { return flash.size; }, set(th, ph) { if (th != null) nudge('theta', th * DEG - theta); if (ph != null) nudge('phi', ph * DEG - phi); },
               slide(dx, dy) { p = [p[0] + dx, p[1] + dy]; rebuild(false); }, answer: () => MISSIONS[m] && { theta: MISSIONS[m].theta / DEG, phi: MISSIONS[m].phi / DEG } };

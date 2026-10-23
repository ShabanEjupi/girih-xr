// Mixed reality: a passthrough session, a ring that follows your gaze over real surfaces (WebXR hit-test),
// and a pinch that pins the work there — flat on a table or upright on a wall, facing out of the surface.
import * as THREE from './vendor/three.module.js';

export const mrSupported = async () => !!navigator.xr && navigator.xr.isSessionSupported('immersive-ar').catch(() => false);

export const requestMR = () => navigator.xr.requestSession('immersive-ar',
  { optionalFeatures: ['hit-test', 'hand-tracking', 'local-floor', 'plane-detection'] });

// The board lies in its own XY plane facing +Z; a hit pose has the surface normal on +Y. This turn maps one onto the other.
const TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

export function placer(scene, mount) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.065, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xc9a227, side: THREE.DoubleSide }));
  ring.matrixAutoUpdate = false; ring.visible = false; scene.add(ring);
  let source = null, pinned = false, onPin = () => {};
  const pin = () => {
    if (pinned || !ring.visible) return;
    ring.matrix.decompose(mount.position, mount.quaternion, new THREE.Vector3());
    mount.quaternion.multiply(TURN); mount.visible = true; ring.visible = false; pinned = true; onPin();
  };
  return {
    get pinned() { return pinned; },
    // fallback(): where the board goes when the device cannot hit-test (no room mesh, emulator) — the VR layout.
    async start(session, fallback, pinnedCb) {
      pinned = false; onPin = pinnedCb || (() => {}); mount.visible = false;
      const viewer = await session.requestReferenceSpace('viewer');
      source = session.requestHitTestSource ? await session.requestHitTestSource({ space: viewer }).catch(() => null) : null;
      if (!source) { mount.visible = true; pinned = true; fallback(); onPin(); return; }
      session.addEventListener('select', pin);           // a pinch (hands) or trigger (controllers) is a WebXR select
    },
    frame(frame, ref) {
      if (pinned || !source) return;
      const pose = frame.getHitTestResults(source)[0]?.getPose(ref);
      ring.visible = !!pose; if (pose) ring.matrix.fromArray(pose.transform.matrix);
    },
    pin,
    stop() {
      source?.cancel?.(); source = null; ring.visible = false; pinned = false;
      mount.position.set(0, 0, 0); mount.quaternion.identity(); mount.visible = true;
    },
  };
}

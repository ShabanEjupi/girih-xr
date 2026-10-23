// Test only: a stand-in room for IWER — one wall 1.2 m ahead — so WebXR hit-test rays land on a real surface.
// IWER asks its environment module (SEM) for hits; this is the smallest one that answers.
export class WallSEM {
  environmentCanvas = document.createElement('canvas'); trackedPlanes = new Set(); trackedMeshes = new Set();
  render() {}
  // m = column-major matrix of the ray: it starts at the translation and looks down its -Z.
  computeHitTestResults(m) {
    const o = [m[12], m[13], m[14]], dir = [-m[8], -m[9], -m[10]], WALL = -1.2;
    if (dir[2] >= -1e-6) return [];
    const k = (WALL - o[2]) / dir[2];
    return [new Float32Array([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, o[0] + k * dir[0], o[1] + k * dir[1], WALL, 1])];   // +Y = the wall's normal
  }
}

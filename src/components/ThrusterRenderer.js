import * as THREE from 'three';

// Two flame cones — one per engine pod (matches ModelFactory positions: x=±0.55, z=0.42)
const ENGINE_OFFSETS = [
  new THREE.Vector3(-0.55, -0.12, 0.72),
  new THREE.Vector3( 0.55, -0.12, 0.72),
];

export class ThrusterRenderer {
  constructor(scene) {
    this.threeScene = scene;
    this._flames = ENGINE_OFFSETS.map(() => this._makeFlame());
    this._visible = false;
  }

  _makeFlame() {
    const outerGeo = new THREE.ConeGeometry(0.12, 0.7, 7);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xff6600, transparent: true, opacity: 0.75,
    });
    const outer = new THREE.Mesh(outerGeo, outerMat);

    const coreGeo = new THREE.ConeGeometry(0.055, 0.45, 6);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xaaddff, transparent: true, opacity: 0.9,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);

    const g = new THREE.Group();
    g.add(outer);
    g.add(core);
    // Cones point upward by default (+Y). We rotate so they point +Z (rearward in local space).
    g.rotation.x = -Math.PI / 2; // cone tip now points in -Z → rearward flame
    return g;
  }

  update(playerMesh, moveX, moveZ) {
    if (!playerMesh) return;

    const fwd   = Math.max(0, -moveZ); // 0–1 — moving forward intensifies flame
    const intensity = Math.max(0.22, fwd);

    ENGINE_OFFSETS.forEach((offset, i) => {
      const flame = this._flames[i];

      if (!flame.parent) {
        playerMesh.add(flame);
      }

      // Position relative to player mesh (engine pod rear)
      flame.position.copy(offset);

      // Scale based on intensity + flicker
      const flicker = 0.7 + Math.random() * 0.6;
      const len = (0.55 + intensity * 0.7) * flicker;
      flame.scale.set(intensity + 0.2, len, intensity + 0.2);

      // Update opacity
      flame.children[0].material.opacity = 0.5 + intensity * 0.4;
      flame.children[1].material.opacity = 0.7 + intensity * 0.25;
    });
  }

  clear() {
    this._flames.forEach(f => {
      if (f.parent) f.parent.remove(f);
    });
  }
}

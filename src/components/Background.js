import * as THREE from 'three';

const GROUND_W = 20;   // total ground width
const GROUND_FAR = 35; // how far the ground extends in Z

// Ground objects wrap back when they scroll past this Z
const WRAP_NEAR = 14;
const WRAP_FAR  = -28;

export class Background {
  constructor(scene) {
    this.scene   = scene;
    this.objects = []; // { mesh, scrollSpeed }
    this.scrollZ = 0;
    this.SCROLL_SPEED = 7; // world units per second
  }

  create() {
    this._addGround();
    this._addRoads();
    this._scatterObjects();
  }

  _addGround() {
    const geo = new THREE.PlaneGeometry(GROUND_W, GROUND_FAR);
    const mat = new THREE.MeshLambertMaterial({ color: 0x1a2810 });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, -0.02, (WRAP_NEAR + WRAP_FAR) / 2);
    plane.receiveShadow = true;
    this.scene.add(plane);
  }

  _addRoads() {
    // Long road along centre
    this._makeRoad(0, GROUND_FAR, 1.1, 0);
    // Cross roads at intervals
    for (let z = -20; z < 12; z += 8) {
      this._makeRoad(GROUND_W, 1.1, 1.1, z, true);
    }
  }

  _makeRoad(length, width, height, z, isLateral = false) {
    const geo = new THREE.BoxGeometry(
      isLateral ? length : width,
      0.03,
      isLateral ? width : length
    );
    const mat = new THREE.MeshLambertMaterial({ color: 0x333340 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, 0, z);
    m.receiveShadow = true;
    this.scene.add(m);

    if (!isLateral) return; // static
    // Lateral roads scroll with the world
    this.objects.push({ mesh: m, spawnZ: z });
  }

  _scatterObjects() {
    const rng = (a, b) => a + Math.random() * (b - a);

    // Buildings — only on the edges (|x| > 4)
    for (let i = 0; i < 28; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = side * rng(4.5, 8.5);
      const z = rng(WRAP_FAR, WRAP_NEAR);
      const h = rng(0.4, 3.2);
      const w = rng(0.3, 1.0);
      const d = rng(0.3, 1.0);
      this._addBuilding(x, z, w, h, d);
    }

    // Trees — mid-range (|x| 2.5–5)
    for (let i = 0; i < 24; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = side * rng(2.5, 5.5);
      const z = rng(WRAP_FAR, WRAP_NEAR);
      this._addTree(x, z);
    }
  }

  _addBuilding(x, z, w, h, d) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const gray = Math.round(0x30 + Math.random() * 0x30);
    const col  = (gray << 16) | (gray << 8) | (gray + 0x10);
    const mat  = new THREE.MeshLambertMaterial({ color: col });
    const m    = new THREE.Mesh(geo, mat);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    this.objects.push({ mesh: m, spawnX: x, spawnZ: z });
  }

  _addTree(x, z) {
    const g = new THREE.Group();

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 0.55, 6),
      new THREE.MeshLambertMaterial({ color: 0x4a3010 })
    );
    trunk.position.y = 0.28;
    g.add(trunk);

    const h = 0.45 + Math.random() * 0.4;
    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(0.32 + Math.random() * 0.18, h, 7),
      new THREE.MeshLambertMaterial({ color: 0x1a4a10 })
    );
    foliage.position.y = 0.55 + h / 2;
    g.add(foliage);

    g.position.set(x, 0, z);
    g.castShadow = true;
    this.scene.add(g);
    this.objects.push({ mesh: g, spawnX: x, spawnZ: z });
  }

  scroll(delta) {
    const dz = this.SCROLL_SPEED * delta;
    this.objects.forEach(obj => {
      obj.mesh.position.z += dz;
      if (obj.mesh.position.z > WRAP_NEAR) {
        // Re-spawn far back, keep same X (buildings stay on sides)
        obj.mesh.position.z -= (WRAP_NEAR - WRAP_FAR);
      }
    });
  }
}

import * as THREE from 'three';

// Shared geometry/material cache
const _cache = {
  geo: new Map(),
  mat: new Map(),
};

function geo(key, factory) {
  if (!_cache.geo.has(key)) _cache.geo.set(key, factory());
  return _cache.geo.get(key);
}

function mat(hex, opts = {}) {
  const key = hex + JSON.stringify(opts);
  if (!_cache.mat.has(key)) {
    _cache.mat.set(key, new THREE.MeshLambertMaterial({ color: hex, ...opts }));
  }
  return _cache.mat.get(key);
}

function mesh(geoKey, geoFn, color, opts) {
  return new THREE.Mesh(geo(geoKey, geoFn), mat(color, opts));
}

export class ModelFactory {
  // ── TurboKat (player) ─────────────────────────────────────────────────────
  // Faces -Z (nose points toward enemies). Viewed from above.
  createPlayer() {
    const g = new THREE.Group();

    // Fuselage — elongated, slightly raised
    const fuselage = mesh('pFuse', () => new THREE.BoxGeometry(0.42, 0.22, 2.1), 0x0c1a44);
    g.add(fuselage);

    // Main wings — thin, swept
    const wings = mesh('pWings', () => new THREE.BoxGeometry(4.2, 0.07, 1.05), 0x1040aa);
    wings.position.set(0, -0.06, 0.12);
    g.add(wings);

    // Red leading-edge stripe on wings
    const wingeStripe = mesh('pWStripe', () => new THREE.BoxGeometry(4.4, 0.07, 0.18), 0xcc0018);
    wingeStripe.position.set(0, -0.04, -0.42);
    g.add(wingeStripe);

    // Tail fins
    const tail = mesh('pTail', () => new THREE.BoxGeometry(1.7, 0.06, 0.5), 0x1040aa);
    tail.position.set(0, -0.04, 0.82);
    g.add(tail);

    // Vertical tail fin
    const vTail = mesh('pVTail', () => new THREE.BoxGeometry(0.07, 0.28, 0.5), 0x0c1a44);
    vTail.position.set(0, 0.1, 0.82);
    g.add(vTail);

    // Twin engine pods under wings
    for (const sx of [-0.55, 0.55]) {
      const eng = mesh('pEng', () => new THREE.CylinderGeometry(0.1, 0.08, 0.55, 8), 0x0a0a18);
      eng.rotation.x = Math.PI / 2;
      eng.position.set(sx, -0.12, 0.42);
      g.add(eng);
      // Engine glow ring
      const glow = mesh('pEngGlow', () => new THREE.CylinderGeometry(0.1, 0.1, 0.04, 8), 0xff6600);
      glow.rotation.x = Math.PI / 2;
      glow.position.set(sx, -0.12, 0.72);
      g.add(glow);
    }

    // Cockpit bubble
    const cockpit = mesh('pCock', () => new THREE.SphereGeometry(0.19, 8, 6), 0x1144bb);
    cockpit.scale.set(1, 0.55, 1.2);
    cockpit.position.set(0, 0.14, -0.45);
    g.add(cockpit);

    // Nose cone
    const nose = mesh('pNose', () => new THREE.ConeGeometry(0.1, 0.35, 8), 0x0c1a44);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0, -1.18);
    g.add(nose);

    return g;
  }

  // ── Enemy aircraft ────────────────────────────────────────────────────────
  // Faces +Z (nose toward player, since enemy moves in +Z direction).
  createEnemy() {
    const g = new THREE.Group();

    const fuselage = mesh('eFuse', () => new THREE.BoxGeometry(0.32, 0.19, 1.5), 0x1a0808);
    g.add(fuselage);

    const wings = mesh('eWings', () => new THREE.BoxGeometry(3.1, 0.06, 0.72), 0x330a0a);
    wings.position.set(0, -0.05, 0.06);
    g.add(wings);

    const stripe = mesh('eStripe', () => new THREE.BoxGeometry(3.2, 0.06, 0.15), 0xcc3300);
    stripe.position.set(0, -0.03, 0.38);
    g.add(stripe);

    const tail = mesh('eTail', () => new THREE.BoxGeometry(1.2, 0.05, 0.42), 0x220a0a);
    tail.position.set(0, -0.03, -0.56);
    g.add(tail);

    const vTail = mesh('eVTail', () => new THREE.BoxGeometry(0.06, 0.25, 0.38), 0x1a0808);
    vTail.position.set(0, 0.1, -0.54);
    g.add(vTail);

    // Single engine
    const eng = mesh('eEng', () => new THREE.CylinderGeometry(0.1, 0.08, 0.5, 8), 0x080808);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(0, -0.08, -0.5);
    g.add(eng);

    const engGlow = mesh('eEngGlow', () => new THREE.CylinderGeometry(0.09, 0.09, 0.04, 8), 0xff3300);
    engGlow.rotation.x = Math.PI / 2;
    engGlow.position.set(0, -0.08, -0.77);
    g.add(engGlow);

    // Cockpit
    const cockpit = mesh('eCock', () => new THREE.SphereGeometry(0.15, 8, 5), 0x440000);
    cockpit.scale.set(1, 0.5, 1.1);
    cockpit.position.set(0, 0.11, 0.3);
    g.add(cockpit);

    // Nose
    const nose = mesh('eNose', () => new THREE.ConeGeometry(0.08, 0.3, 8), 0x110505);
    nose.rotation.x = -Math.PI / 2; // points in +Z
    nose.position.set(0, 0, 0.95);
    g.add(nose);

    // Enemy faces +Z by default (nose built at +Z)
    return g;
  }

  // ── Boss aircraft ─────────────────────────────────────────────────────────
  // Faces +Z, like enemies.
  createBoss() {
    const g = new THREE.Group();

    // Heavy fuselage
    const fuselage = mesh('bFuse', () => new THREE.BoxGeometry(0.75, 0.38, 3.4), 0x150606);
    g.add(fuselage);

    // Wide swept wings — two layers for depth
    const wings1 = mesh('bWing1', () => new THREE.BoxGeometry(6.5, 0.08, 1.35), 0x220a0a);
    wings1.position.set(0, -0.06, 0.2);
    g.add(wings1);

    const wings2 = mesh('bWing2', () => new THREE.BoxGeometry(4.8, 0.07, 0.75), 0xcc4400);
    wings2.position.set(0, -0.04, 0.0);
    g.add(wings2);

    const wStripe = mesh('bWStripe', () => new THREE.BoxGeometry(7.0, 0.06, 0.16), 0x880000);
    wStripe.position.set(0, -0.02, 0.5);
    g.add(wStripe);

    // Tail section
    const tail = mesh('bTail', () => new THREE.BoxGeometry(2.2, 0.07, 0.65), 0x220a0a);
    tail.position.set(0, -0.04, -1.35);
    g.add(tail);

    const vTail = mesh('bVTail', () => new THREE.BoxGeometry(0.09, 0.55, 0.7), 0x150606);
    vTail.position.set(0, 0.22, -1.32);
    g.add(vTail);

    // Four engine pods
    for (const [sx, sz] of [[-0.7, -0.5], [0.7, -0.5], [-0.45, -0.9], [0.45, -0.9]]) {
      const eng = new THREE.Mesh(
        geo('bEng', () => new THREE.CylinderGeometry(0.14, 0.11, 0.62, 8)),
        mat(0x080808)
      );
      eng.rotation.x = Math.PI / 2;
      eng.position.set(sx, -0.14, sz);
      g.add(eng);

      const glow = new THREE.Mesh(
        geo('bEngGlow', () => new THREE.CylinderGeometry(0.13, 0.13, 0.04, 8)),
        mat(0xff5500)
      );
      glow.rotation.x = Math.PI / 2;
      glow.position.set(sx, -0.14, sz - 0.34);
      g.add(glow);
    }

    // Cockpit
    const cockpit = mesh('bCock', () => new THREE.SphereGeometry(0.28, 10, 7), 0x550000);
    cockpit.scale.set(1, 0.5, 1.3);
    cockpit.position.set(0, 0.22, 1.0);
    g.add(cockpit);

    // Nose
    const nose = mesh('bNose', () => new THREE.ConeGeometry(0.14, 0.45, 8), 0x110404);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0, 1.95);
    g.add(nose);

    // Weapon pylons
    for (const sx of [-1.2, 1.2]) {
      const pylon = new THREE.Mesh(
        geo('bPylon', () => new THREE.BoxGeometry(0.12, 0.12, 0.55)),
        mat(0x331100)
      );
      pylon.position.set(sx, -0.1, 0.4);
      g.add(pylon);
    }

    return g;
  }

  // ── Projectiles ───────────────────────────────────────────────────────────

  createBullet() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      geo('bulBody', () => new THREE.CylinderGeometry(0.04, 0.04, 0.45, 6)),
      mat(0xffff44)
    );
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const tip = new THREE.Mesh(
      geo('bulTip', () => new THREE.ConeGeometry(0.04, 0.12, 6)),
      mat(0xffffff)
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.z = -0.27;
    g.add(tip);
    // Glow point light (cheap: just a small emissive sphere)
    const glow = new THREE.Mesh(
      geo('bulGlow', () => new THREE.SphereGeometry(0.06, 5, 4)),
      mat(0xffff88, { emissive: 0xffff44, emissiveIntensity: 0.8 })
    );
    g.add(glow);
    return g;
  }

  createEnemyBullet() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      geo('eBulBody', () => new THREE.CylinderGeometry(0.05, 0.05, 0.42, 6)),
      mat(0xff5500)
    );
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const glow = new THREE.Mesh(
      geo('eBulGlow', () => new THREE.SphereGeometry(0.07, 5, 4)),
      mat(0xff7700, { emissive: 0xff4400, emissiveIntensity: 0.8 })
    );
    g.add(glow);
    return g;
  }

  createRocket() {
    return this._buildRocket(0xdd6600, 0xffaa00, 0xffcc44);
  }

  createIceRocket() {
    return this._buildRocket(0x1155cc, 0xaaddff, 0x88eeff);
  }

  createZapRocket() {
    return this._buildRocket(0xcc9900, 0xffee00, 0xffff88);
  }

  createPoisonRocket() {
    return this._buildRocket(0x226600, 0x55dd00, 0x88ff44);
  }

  _buildRocket(bodyColor, tipColor, glowColor) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      geo('rktBody', () => new THREE.CylinderGeometry(0.065, 0.065, 0.55, 8)),
      mat(bodyColor)
    );
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const tip = new THREE.Mesh(
      geo('rktTip', () => new THREE.ConeGeometry(0.065, 0.22, 8)),
      mat(tipColor)
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.z = -0.38;
    g.add(tip);
    // Fins
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(
        geo('rktFin', () => new THREE.BoxGeometry(0.02, 0.14, 0.18)),
        mat(bodyColor)
      );
      fin.rotation.z = (i / 4) * Math.PI * 2;
      fin.position.z = 0.2;
      g.add(fin);
    }
    const exhaust = new THREE.Mesh(
      geo('rktEx', () => new THREE.SphereGeometry(0.08, 6, 4)),
      mat(glowColor, { emissive: glowColor, emissiveIntensity: 1.2 })
    );
    exhaust.position.z = 0.32;
    g.add(exhaust);
    return g;
  }

  // ── Explosion sphere (reused for effects) ─────────────────────────────────
  createExplosionSphere(color) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
  }
}

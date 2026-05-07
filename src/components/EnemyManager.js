import { ENEMY_HEALTH } from '../constants/gameConstants.js';

const BASE_SPEED = 4.2;   // world units / second
const SPEED_WAVE = 0.12;  // added per wave

export class EnemyManager {
  constructor(scene) {
    this.scene = scene;
  }

  spawnDelay() {
    return Math.max(600, 1600 - (this.scene.wave - 1) * 120);
  }

  enemyFireDelay() {
    return Math.max(400, Math.round(2200 * Math.pow(0.9, this.scene.wave - 1)));
  }

  weakestEnemyHP() {
    return Math.max(1, Math.round(ENEMY_HEALTH * Math.pow(1.2, this.scene.wave - 1)));
  }

  spawnEnemy() {
    const g = this.scene;
    if (g.gameOver || !g.gameRunning) return;

    const x = -7.0 + Math.random() * 14.0;
    const mesh = g.modelFactory.createEnemy();
    mesh.position.set(x, 1.0, -24);
    g.threeScene.add(mesh);

    const baseVZ = (BASE_SPEED + (g.wave - 1) * SPEED_WAVE) * (0.85 + Math.random() * 0.3);

    const pattern = Math.floor(Math.random() * 3);
    let vx = 0;
    let sineAmp = 0, sineFreq = 0, sineBaseX = x;

    if (pattern === 1) {
      vx = (Math.random() > 0.5 ? 1 : -1) * (2.2 + Math.random() * 2.5);
    } else if (pattern === 2) {
      sineAmp  = 1.8 + Math.random() * 2.5;
      sineFreq = 0.8 + Math.random() * 0.8;
    }

    g.enemies.push({
      mesh,
      vx,
      vz: baseVZ,
      sineAmp,
      sineFreq,
      sineBaseX,
      sineT: Math.random() * Math.PI * 2, // random phase
      health: this.weakestEnemyHP(),
      slowed: false,
      poisoned: false,
      active: true,
    });
  }

  enemiesShoot() {
    const g = this.scene;
    if (g.gameOver || !g.gameRunning) return;

    g.enemies.forEach(enemy => {
      if (!enemy.active) return;
      const ez = enemy.mesh.position.z;
      // Only shoot when in the "visible lane" (not too far, not past player)
      if (ez < -22 || ez > g.playerPos.z + 2) return;

      const mesh = g.modelFactory.createEnemyBullet();
      mesh.position.set(
        enemy.mesh.position.x,
        enemy.mesh.position.y,
        enemy.mesh.position.z + 0.9 // muzzle at nose (+Z direction)
      );
      g.threeScene.add(mesh);

      const speed = 9 + g.wave * 0.3;
      g.enemyBullets.push({ mesh, vx: 0, vy: 0, vz: speed, active: true });
    });
  }
}

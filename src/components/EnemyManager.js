import { ENEMY_HEALTH } from '../constants/gameConstants.js';

export class EnemyManager {
  constructor(scene) {
    this.scene = scene;
  }

  // ── Wave helpers ──────────────────────────────────────────────────────────

  spawnDelay() {
    return Math.max(600, 1600 - (this.scene.wave - 1) * 120);
  }

  enemyFireDelay() {
    return Math.max(400, Math.round(2200 * Math.pow(0.9, this.scene.wave - 1)));
  }

  weakestEnemyHP() {
    return Math.max(1, Math.round(ENEMY_HEALTH * Math.pow(1.2, this.scene.wave - 1)));
  }

  // ── Spawn ─────────────────────────────────────────────────────────────────

  spawnEnemy() {
    if (this.scene.gameOver) return;
    const x     = Phaser.Math.Between(24, this.scene.W - 24);
    const enemy = this.scene.enemies.create(x, -40, 'enemy');
    if (!enemy) return;

    enemy.setDepth(8);
    enemy.health    = this.weakestEnemyHP();
    enemy.slowed    = false;
    enemy.waveTween = null;

    this._applyMovementPattern(enemy);
  }

  _applyMovementPattern(enemy) {
    const pattern = Phaser.Math.Between(0, 2);
    const baseVY  = Math.round(
      Phaser.Math.Between(100, 160) * Math.pow(1.05, this.scene.wave - 1)
    );

    if (pattern === 0) {
      enemy.setVelocityY(baseVY);
    } else if (pattern === 1) {
      const dir = Phaser.Math.Between(0, 1) ? 1 : -1;
      enemy.setVelocityX(dir * Phaser.Math.Between(70, 130));
      enemy.setVelocityY(baseVY);
    } else {
      enemy.setVelocityY(baseVY);
      enemy.waveTween = this.scene.tweens.add({
        targets: enemy,
        x: { value: `+=${Phaser.Math.Between(0, 1) ? 120 : -120}`, duration: 1400 },
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
      });
    }
  }

  // ── Shooting ──────────────────────────────────────────────────────────────

  enemiesShoot() {
    if (this.scene.gameOver) return;
    this.scene.enemies.getChildren().forEach(enemy => {
      if (!enemy.active || enemy.y < 20 || enemy.y > this.scene.H * 0.75) return;
      const b = this.scene.enemyBullets.create(enemy.x, enemy.y + 26, 'ebullet');
      if (!b) return;
      b.setVelocityY(280 + this.scene.wave * 10).setDepth(7);
    });
  }
}

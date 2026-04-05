import { audioManager } from '../audio/AudioManager.js';
import {
  ROCKET_AOE_RADIUS,
  ICE_AOE_RADIUS, ICE_DAMAGE, ICE_SLOW_FACTOR, ICE_SLOW_DURATION,
  ZAP_DAMAGE, ZAP_HITS, ZAP_INTERVAL,
  POISON_AOE_RADIUS, POISON_DAMAGE, POISON_DOT_DAMAGE, POISON_DOT_TICKS, POISON_DOT_INTERVAL,
} from '../constants/gameConstants.js';

export class EffectsManager {
  constructor(scene) {
    this.scene = scene;
  }

  // ── Kill ──────────────────────────────────────────────────────────────────

  killEnemy(enemy) {
    this.scene.score     += 10 * this.scene.wave;
    this.scene.killCount += 1;
    const exp = this.scene.add.circle(enemy.x, enemy.y, 6, 0xff5500, 1).setDepth(15);
    this.scene.tweens.add({
      targets: exp, radius: 28, alpha: 0, duration: 280,
      onComplete: () => exp.destroy(),
    });
    audioManager.sfxEnemyDie();
    enemy.destroy();
  }

  // ── Rocket explosion ──────────────────────────────────────────────────────

  triggerRocketExplosion(x, y) {
    this._rocketBlast(x, y);
    this.scene.enemies.getChildren().forEach(enemy => {
      if (!enemy.active) return;
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= ROCKET_AOE_RADIUS)
        this.killEnemy(enemy);
    });
    this.scene.cameras.main.shake(320, 0.014);
    this.scene.score += 5 * this.scene.wave;
  }

  triggerRocketExplosionNoDmg(x, y) {
    this._rocketBlast(x, y);
    this.scene.cameras.main.shake(200, 0.010);
  }

  _rocketBlast(x, y) {
    const outer = this.scene.add.circle(x, y, 8, 0xff6600, 0.9).setDepth(15);
    this.scene.tweens.add({
      targets: outer, radius: ROCKET_AOE_RADIUS, alpha: 0, duration: 420,
      onComplete: () => outer.destroy(),
    });
    const inner = this.scene.add.circle(x, y, 6, 0xffee44, 1).setDepth(16);
    this.scene.tweens.add({
      targets: inner, radius: ROCKET_AOE_RADIUS * 0.55, alpha: 0, duration: 280,
      onComplete: () => inner.destroy(),
    });
    audioManager.sfxRocketExplode();
  }

  // ── Ice explosion ─────────────────────────────────────────────────────────

  triggerIceExplosion(x, y) {
    this._iceVisual(x, y);
    this.scene.cameras.main.flash(120, 100, 180, 255, false);
    this.scene.cameras.main.shake(180, 0.008);
    audioManager.sfxIceExplode();
    this._iceAffectEnemies(x, y);
    this.scene.score += 5 * this.scene.wave;
  }

  _iceVisual(x, y) {
    const outer = this.scene.add.circle(x, y, 10, 0x0066ff, 0.85).setDepth(15);
    this.scene.tweens.add({ targets: outer, radius: ICE_AOE_RADIUS, alpha: 0, duration: 600, onComplete: () => outer.destroy() });
    const mid = this.scene.add.circle(x, y, 8, 0x88ddff, 0.7).setDepth(16);
    this.scene.tweens.add({ targets: mid, radius: ICE_AOE_RADIUS * 0.65, alpha: 0, duration: 450, onComplete: () => mid.destroy() });
    const core = this.scene.add.circle(x, y, 6, 0xffffff, 1).setDepth(17);
    this.scene.tweens.add({ targets: core, radius: 40, alpha: 0, duration: 250, onComplete: () => core.destroy() });
    const sg = this.scene.add.graphics().setDepth(16);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      sg.lineStyle(2, 0xaaddff, 0.7);
      sg.lineBetween(x, y, x + Math.cos(a) * ICE_AOE_RADIUS * 0.5, y + Math.sin(a) * ICE_AOE_RADIUS * 0.5);
    }
    this.scene.tweens.add({ targets: sg, alpha: 0, duration: 600, onComplete: () => sg.destroy() });
  }

  _iceAffectEnemies() {
    this.scene.enemies.getChildren().filter(e => e.active).forEach(enemy => {
      this.flashIce(enemy);
      enemy.health -= ICE_DAMAGE;
      if (enemy.health <= 0) { this.killEnemy(enemy); return; }
      if (!enemy.slowed) {
        enemy.origVX = enemy.body.velocity.x;
        enemy.origVY = enemy.body.velocity.y;
        enemy.slowed = true;
        enemy.setTint(0x88ccff);
        enemy.body.setVelocity(enemy.origVX * ICE_SLOW_FACTOR, enemy.origVY * ICE_SLOW_FACTOR);
        if (enemy.waveTween) enemy.waveTween.timeScale = ICE_SLOW_FACTOR;
        this.scene.time.delayedCall(ICE_SLOW_DURATION, () => {
          if (!enemy.active) return;
          enemy.slowed = false;
          enemy.clearTint();
          enemy.body.setVelocity(enemy.origVX, enemy.origVY);
          if (enemy.waveTween) enemy.waveTween.timeScale = 1;
        });
      }
    });
  }

  // ── Zap chain ─────────────────────────────────────────────────────────────

  triggerZapChain(x, y) {
    const flash = this.scene.add.circle(x, y, 8, 0xffff00, 1).setDepth(17);
    this.scene.tweens.add({
      targets: flash, radius: 60, alpha: 0, duration: 300,
      onComplete: () => flash.destroy(),
    });

    let hitsLeft = ZAP_HITS;
    const doZapHit = () => {
      if (hitsLeft <= 0) return;
      hitsLeft--;
      audioManager.sfxZapHit();

      this.scene.enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        this.showZapOnEnemy(enemy.x, enemy.y);
        this.flashZap(enemy);
        enemy.health -= ZAP_DAMAGE;
        if (enemy.health <= 0) this.killEnemy(enemy);
      });

      if (this.scene.boss && this.scene.boss.active) {
        this.showZapOnEnemy(this.scene.boss.x, this.scene.boss.y);
        this.scene.bossController.damageBoss(ZAP_DAMAGE);
      }

      const ring = this.scene.add.circle(x, y, 5, 0xffff00, 0.6).setDepth(15);
      this.scene.tweens.add({
        targets: ring, radius: 50 + (ZAP_HITS - hitsLeft) * 30, alpha: 0, duration: 350,
        onComplete: () => ring.destroy(),
      });

      if (hitsLeft > 0) this.scene.time.delayedCall(ZAP_INTERVAL, doZapHit);
    };
    doZapHit();
  }

  showZapOnEnemy(x, y) {
    const g = this.scene.add.graphics().setDepth(18);
    g.lineStyle(2, 0xffff44, 1);
    for (let i = 0; i < 4; i++) {
      const a   = Math.random() * Math.PI * 2;
      const len = 10 + Math.random() * 16;
      const mx  = x + Math.cos(a) * len * 0.5 + (Math.random() - 0.5) * 8;
      const my  = y + Math.sin(a) * len * 0.5 + (Math.random() - 0.5) * 8;
      g.lineBetween(x, y, mx, my);
      g.lineBetween(mx, my, x + Math.cos(a) * len, y + Math.sin(a) * len);
    }
    g.fillStyle(0xffffff, 0.9); g.fillCircle(x, y, 4);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
  }

  // ── Poison explosion ──────────────────────────────────────────────────────

  triggerPoisonExplosion(x, y) {
    this._poisonVisual(x, y);
    this.scene.cameras.main.flash(100, 0, 180, 0, false);
    this.scene.cameras.main.shake(150, 0.006);
    audioManager.sfxPoisonExplode();
    this._poisonAffectEnemies(x, y);
    this.scene.score += 5 * this.scene.wave;
  }

  _poisonVisual(x, y) {
    const outer = this.scene.add.circle(x, y, 10, 0x22aa00, 0.8).setDepth(15);
    this.scene.tweens.add({ targets: outer, radius: POISON_AOE_RADIUS, alpha: 0, duration: 700, onComplete: () => outer.destroy() });
    const mid = this.scene.add.circle(x, y, 8, 0x88ff44, 0.65).setDepth(16);
    this.scene.tweens.add({ targets: mid, radius: POISON_AOE_RADIUS * 0.6, alpha: 0, duration: 500, onComplete: () => mid.destroy() });
    const core = this.scene.add.circle(x, y, 6, 0xaaffaa, 1).setDepth(17);
    this.scene.tweens.add({ targets: core, radius: 35, alpha: 0, duration: 220, onComplete: () => core.destroy() });
    const sg = this.scene.add.graphics().setDepth(16);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      sg.lineStyle(2, 0x55ff00, 0.65);
      sg.lineBetween(x, y, x + Math.cos(a) * POISON_AOE_RADIUS * 0.45, y + Math.sin(a) * POISON_AOE_RADIUS * 0.45);
    }
    this.scene.tweens.add({ targets: sg, alpha: 0, duration: 700, onComplete: () => sg.destroy() });
  }

  _poisonAffectEnemies(x, y) {
    this.scene.enemies.getChildren().filter(e => e.active).forEach(enemy => {
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) > POISON_AOE_RADIUS) return;
      this.flashPoison(enemy);
      enemy.health -= POISON_DAMAGE;
      if (enemy.health <= 0) { this.killEnemy(enemy); return; }
      if (!enemy.poisoned) {
        enemy.poisoned = true;
        enemy.setTint(0x55dd00);
        let ticks = POISON_DOT_TICKS;
        const doDot = () => {
          if (!enemy.active || ticks <= 0) {
            if (enemy.active) { enemy.poisoned = false; enemy.clearTint(); }
            return;
          }
          ticks--;
          audioManager.sfxPoisonTick();
          this.flashPoison(enemy);
          enemy.health -= POISON_DOT_DAMAGE;
          if (enemy.health <= 0) { this.killEnemy(enemy); return; }
          this.scene.time.delayedCall(POISON_DOT_INTERVAL, doDot);
        };
        this.scene.time.delayedCall(POISON_DOT_INTERVAL, doDot);
      }
    });
  }

  // ── Flashes ───────────────────────────────────────────────────────────────

  flashEnemy(enemy) {
    this.scene.tweens.add({ targets: enemy, alpha: 0.2, duration: 40, yoyo: true });
  }

  flashIce(enemy) {
    this.scene.tweens.add({ targets: enemy, alpha: 0.3, duration: 60, yoyo: true });
  }

  flashZap(enemy) {
    this.scene.tweens.add({
      targets: enemy, alpha: 0.2, duration: 40, yoyo: true,
      onComplete: () => { if (enemy.active) enemy.setAlpha(1); },
    });
  }

  flashPoison(enemy) {
    this.scene.tweens.add({ targets: enemy, alpha: 0.25, duration: 55, yoyo: true });
  }
}

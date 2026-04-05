import { audioManager } from '../audio/AudioManager.js';
import {
  BOSS_HP_MULT, BOSS_FIRE_RATE, BOSS_SPECIAL_DELAY, BOSS_SPECIAL_WARN,
  BOSS_SAFE_RADIUS, BOSS_SPECIAL_DAMAGE, BOSS_ROCKET_DMG, BOSS_ICE_DMG,
  BOSS_ENTRY_Y, ICE_SLOW_FACTOR, ICE_SLOW_DURATION,
  BOSS_POISON_DMG, BOSS_POISON_DOT, POISON_DOT_TICKS, POISON_DOT_INTERVAL,
} from '../constants/gameConstants.js';

export class BossController {
  constructor(scene) {
    this.scene         = scene;
    this.bossFireTimer = null;
    this.bossSpecTimer = null;
    this.bossSpecRunning = false;
  }

  // ── Spawn & entry ─────────────────────────────────────────────────────────

  spawnBoss() {
    const bossHP = this.scene.enemyManager.weakestEnemyHP() * BOSS_HP_MULT;
    this.scene.boss = this.scene.physics.add.sprite(this.scene.W / 2, -70, 'boss');
    const boss = this.scene.boss;
    boss.setDepth(11).setImmovable(true);
    boss.body.setSize(100, 70).setOffset(14, 18);
    boss.health    = bossHP;
    boss.maxHealth = bossHP;
    boss.slowed    = false;
    boss.bossTween = null;
    this.scene.bossGroup.add(boss);
    this.scene.hud.showBossBar(`BOSS — WAVE ${this.scene.wave}`);
    this._startEntryTween();
  }

  _startEntryTween() {
    this.scene.tweens.add({
      targets: this.scene.boss,
      y: BOSS_ENTRY_Y,
      duration: 1600,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!this.scene.boss || !this.scene.boss.active) return;
        this._startOscillation();
        this._startTimers();
        this._announce();
      },
    });
  }

  _startOscillation() {
    if (!this.scene.boss) return;
    const boss     = this.scene.boss;
    const startX   = boss.x;
    const duration = Phaser.Math.Between(2800, 3600);
    boss.bossTween = this.scene.tweens.add({
      targets: boss,
      x: { value: startX > this.scene.W / 2 ? 70 : this.scene.W - 70, duration },
      ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
      onYoyo: () => {
        if (!boss || !boss.active) return;
        const newY = Phaser.Math.Clamp(
          boss.y + Phaser.Math.Between(-20, 20), 80, BOSS_ENTRY_Y + 40
        );
        this.scene.tweens.add({ targets: boss, y: newY, duration: duration / 2 });
      },
    });
  }

  _startTimers() {
    this.bossFireTimer = this.scene.time.addEvent({
      delay: BOSS_FIRE_RATE, callback: this._bossShoot, callbackScope: this, loop: true,
    });
    this.bossSpecTimer = this.scene.time.addEvent({
      delay: BOSS_SPECIAL_DELAY, callback: this._bossSpecialAbility, callbackScope: this, loop: true,
    });
  }

  _announce() {
    const { width, height } = this.scene.scale;
    const txt = this.scene.add.text(width / 2, height * 0.42, `⚠ BOSS INCOMING ⚠`, {
      fontSize: '28px', fontFamily: 'Arial Black, sans-serif',
      color: '#ff2200', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(60).setAlpha(0);
    this.scene.tweens.add({
      targets: txt, alpha: { from: 0, to: 1 }, duration: 250,
      yoyo: true, hold: 1000, onComplete: () => txt.destroy(),
    });
  }

  // ── Boss shooting ─────────────────────────────────────────────────────────

  _bossShoot() {
    const boss = this.scene.boss;
    if (!boss || !boss.active || this.scene.gameOver) return;
    if (this.bossSpecRunning) return;
    const graceCutoff = (BOSS_SPECIAL_DELAY - 1000) / BOSS_SPECIAL_DELAY;
    if (this.bossSpecTimer && this.bossSpecTimer.getProgress() > graceCutoff) return;

    const count  = 5;
    const spread = 1.5;
    const aim    = Math.atan2(this.scene.player.y - boss.y, this.scene.player.x - boss.x);
    const speed  = 310 + this.scene.wave * 12;

    for (let i = 0; i < count; i++) {
      const angle  = aim + (i - (count - 1) / 2) * (spread / (count - 1));
      const spawnX = boss.x + Math.cos(angle) * 54;
      const spawnY = boss.y + Math.sin(angle) * 54;
      const b = this.scene.enemyBullets.create(spawnX, spawnY, 'bbullet');
      if (!b) continue;
      b.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      b.setDepth(7);
    }
  }

  // ── Special ability ───────────────────────────────────────────────────────

  _bossSpecialAbility() {
    const boss = this.scene.boss;
    if (!boss || !boss.active || this.scene.gameOver || this.bossSpecRunning) return;
    this.bossSpecRunning = true;
    audioManager.sfxBossWarning();

    const numSafe   = Phaser.Math.Between(2, 3);
    const safeZones = this._buildSafeZones(numSafe);
    const { overlay, safeObjs, warnTxt } = this._buildSpecialOverlays(safeZones);

    const cleanup = () => {
      overlay.destroy(); warnTxt.destroy();
      safeObjs.forEach(o => { o.fill.destroy(); o.ring.destroy(); o.label.destroy(); });
      this.bossSpecRunning = false;
    };

    this.scene.time.delayedCall(BOSS_SPECIAL_WARN, () => {
      if (this.scene.gameOver) { cleanup(); return; }
      const inSafe = safeZones.some(sz =>
        Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, sz.x, sz.y) <= BOSS_SAFE_RADIUS
      );
      if (!inSafe) {
        this.scene.damagePlayer(BOSS_SPECIAL_DAMAGE);
        this.scene.cameras.main.shake(380, 0.022);
      }
      this.scene.cameras.main.flash(180, 255, 60, 0, false);
      this.scene.time.delayedCall(380, cleanup);
    });
  }

  _buildSafeZones(numSafe) {
    const zones  = [];
    const margin = BOSS_SAFE_RADIUS + 14;
    for (let i = 0; i < numSafe; i++) {
      let x, y, tries = 0;
      do {
        x = Phaser.Math.Between(margin, this.scene.W - margin);
        y = i === 0
          ? Phaser.Math.Between(this.scene.H * 0.52, this.scene.H * 0.76)
          : Phaser.Math.Between(this.scene.H * 0.28, this.scene.H * 0.76);
        tries++;
      } while (
        tries < 25 &&
        zones.some(sz => Phaser.Math.Distance.Between(x, y, sz.x, sz.y) < BOSS_SAFE_RADIUS * 2.4)
      );
      zones.push({ x, y });
    }
    return zones;
  }

  _buildSpecialOverlays(safeZones) {
    const dpth   = 25;
    const overlay = this.scene.add.rectangle(this.scene.W / 2, this.scene.H / 2, this.scene.W, this.scene.H, 0xcc0000, 0.48)
      .setDepth(dpth);
    this.scene.tweens.add({ targets: overlay, alpha: { from: 0.28, to: 0.62 }, duration: 240, yoyo: true, repeat: -1 });

    const safeObjs = safeZones.map(sz => {
      const fill  = this.scene.add.circle(sz.x, sz.y, BOSS_SAFE_RADIUS, 0x00ff88, 0.45).setDepth(dpth + 1);
      const ring  = this.scene.add.circle(sz.x, sz.y, BOSS_SAFE_RADIUS, 0x000000, 0)
        .setStrokeStyle(3, 0x00ffaa, 1).setDepth(dpth + 2);
      const label = this.scene.add.text(sz.x, sz.y, 'SAFE', {
        fontSize: '15px', fontFamily: 'Arial Black', color: '#ffffff',
        stroke: '#005533', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(dpth + 3);
      this.scene.tweens.add({ targets: fill, alpha: { from: 0.35, to: 0.75 }, duration: 280, yoyo: true, repeat: -1 });
      this.scene.tweens.add({ targets: ring, scaleX: { from: 0.88, to: 1.12 }, scaleY: { from: 0.88, to: 1.12 }, duration: 280, yoyo: true, repeat: -1 });
      return { fill, ring, label };
    });

    const warnTxt = this.scene.add.text(this.scene.W / 2, this.scene.H * 0.44, '⚡ DANGER — DODGE! ⚡', {
      fontSize: '26px', fontFamily: 'Arial Black, sans-serif',
      color: '#ff3300', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(dpth + 4);
    this.scene.tweens.add({ targets: warnTxt, alpha: 0.15, duration: 180, yoyo: true, repeat: -1 });

    return { overlay, safeObjs, warnTxt };
  }

  // ── Damage & death ────────────────────────────────────────────────────────

  damageBoss(amount) {
    const boss = this.scene.boss;
    if (!boss || !boss.active) return;
    boss.health -= amount;
    this.scene.tweens.add({ targets: boss, alpha: 0.35, duration: 55, yoyo: true });
    this.scene.hud.updateBossBar(boss);
    if (boss.health <= 0) this._onBossDied();
  }

  onBulletHitBoss(bullet) {
    bullet.destroy();
    this.damageBoss(1);
  }

  onRocketHitBoss(rocket) {
    rocket.destroy();
    this.scene.effectsManager.triggerRocketExplosionNoDmg(rocket.x, rocket.y);
    this.damageBoss(BOSS_ROCKET_DMG);
  }

  onIceHitBoss(iceRocket) {
    iceRocket.destroy();
    this.scene.effectsManager.triggerIceExplosion(iceRocket.x, iceRocket.y);
    this.damageBoss(BOSS_ICE_DMG);
    const boss = this.scene.boss;
    if (!boss || boss.slowed) return;
    boss.slowed = true;
    boss.setTint(0x88ccff);
    if (boss.bossTween) boss.bossTween.timeScale = ICE_SLOW_FACTOR;
    this.scene.time.delayedCall(ICE_SLOW_DURATION, () => {
      if (!boss || !boss.active) return;
      boss.slowed = false;
      boss.clearTint();
      if (boss.bossTween) boss.bossTween.timeScale = 1;
    });
  }

  onZapHitBoss(zapRocket) {
    zapRocket.destroy();
    this.scene.effectsManager.triggerZapChain(zapRocket.x, zapRocket.y);
  }

  onPoisonHitBoss(poisonRocket) {
    poisonRocket.destroy();
    this.scene.effectsManager.triggerPoisonExplosion(poisonRocket.x, poisonRocket.y);
    this.damageBoss(BOSS_POISON_DMG);
    const boss = this.scene.boss;
    if (!boss || boss.poisoned) return;
    boss.poisoned = true;
    boss.setTint(0x55dd00);
    let ticks = POISON_DOT_TICKS;
    const doDot = () => {
      if (!boss.active || ticks <= 0) {
        if (boss.active) { boss.poisoned = false; boss.clearTint(); }
        return;
      }
      ticks--;
      this.damageBoss(BOSS_POISON_DOT);
      if (boss.active) this.scene.time.delayedCall(POISON_DOT_INTERVAL, doDot);
    };
    this.scene.time.delayedCall(POISON_DOT_INTERVAL, doDot);
  }

  _onBossDied() {
    audioManager.sfxBossDie();
    const bx = this.scene.boss.x;
    const by = this.scene.boss.y;

    if (this.bossFireTimer) { this.bossFireTimer.remove(); this.bossFireTimer = null; }
    if (this.bossSpecTimer) { this.bossSpecTimer.remove(); this.bossSpecTimer = null; }
    if (this.scene.boss.bossTween) { this.scene.boss.bossTween.stop(); }

    this.scene.boss.destroy();
    this.scene.boss       = null;
    this.scene.bossActive = false;
    this.scene.hud.hideBossBar();

    this._playDeathExplosions(bx, by);
    this.scene.cameras.main.shake(700, 0.026);
    this.scene.cameras.main.flash(300, 255, 140, 0, false);
    this.scene.score += 500 * this.scene.wave;

    this._showBossDefeatedText(() => this.scene.advanceWave());
  }

  _playDeathExplosions(bx, by) {
    for (let i = 0; i < 6; i++) {
      this.scene.time.delayedCall(i * 120, () => {
        const ex = this.scene.add.circle(
          bx + Phaser.Math.Between(-50, 50),
          by + Phaser.Math.Between(-35, 35),
          8, 0xff6600, 1
        ).setDepth(20);
        this.scene.tweens.add({
          targets: ex, radius: 50 + i * 10, alpha: 0, duration: 380,
          onComplete: () => ex.destroy(),
        });
      });
    }
  }

  _showBossDefeatedText(onComplete) {
    const { width, height } = this.scene.scale;
    const txt = this.scene.add.text(width / 2, height / 2, '✓ BOSS DEFEATED', {
      fontSize: '32px', fontFamily: 'Arial Black, sans-serif',
      color: '#ffcc00', stroke: '#664400', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(60).setAlpha(0);
    this.scene.tweens.add({
      targets: txt, alpha: { from: 0, to: 1 }, duration: 300,
      yoyo: true, hold: 1200,
      onComplete: () => { txt.destroy(); onComplete(); },
    });
  }

  stopTimers() {
    if (this.bossFireTimer) { this.bossFireTimer.remove(); this.bossFireTimer = null; }
    if (this.bossSpecTimer) { this.bossSpecTimer.remove(); this.bossSpecTimer = null; }
  }
}

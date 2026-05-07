import * as THREE from 'three';
import { audioManager } from '../audio/AudioManager.js';
import {
  BOSS_HP_MULT, BOSS_FIRE_RATE, BOSS_SPECIAL_DELAY, BOSS_SPECIAL_WARN,
  BOSS_SAFE_RADIUS, BOSS_SPECIAL_DAMAGE, BOSS_ROCKET_DMG,
  BOSS_ICE_DMG, BOSS_POISON_DMG, BOSS_POISON_DOT,
  BOSS_ENTRY_Z, ICE_SLOW_FACTOR, ICE_SLOW_DURATION,
  POISON_DOT_TICKS, POISON_DOT_INTERVAL,
} from '../constants/gameConstants.js';

export class BossController {
  constructor(scene) {
    this.scene         = scene;
    this._fireTimer    = null;
    this._specTimer    = null;
    this._oscT         = 0;
    this._oscDir       = 1;
    this._oscTarget    = 0;
    this._specRunning  = false;
  }

  update(delta) {
    const g = this.scene;
    if (!g.boss || !g.boss.active) return;
    // Smooth oscillation via lerp toward target X
    this._oscT += delta;
    const boss = g.boss;
    boss.mesh.position.x += (this._oscTarget - boss.mesh.position.x) * delta * 0.8;
    // Occasionally pick a new target
    if (this._oscT > boss.oscPeriod) {
      this._oscT = 0;
      this._oscTarget = -6 + Math.random() * 12;
      boss.oscPeriod  = 2.2 + Math.random() * 1.6;
    }
  }

  // ── Spawn & entry ──────────────────────────────────────────────────────────

  spawnBoss() {
    const g = this.scene;
    const bossHP = g.enemyManager.weakestEnemyHP() * BOSS_HP_MULT;

    const mesh = g.modelFactory.createBoss();
    mesh.position.set(g.playerPos.x, 1.5, -26);
    g.threeScene.add(mesh);

    g.boss = {
      mesh,
      health: bossHP,
      maxHealth: bossHP,
      active: true,
      slowed: false,
      poisoned: false,
      oscPeriod: 3.0,
    };

    g.hud.showBossBar(`BOSS — WAVE ${g.wave}`);
    this._oscTarget = 0;
    this._oscT = 0;

    // Entry: animate Z from -26 to BOSS_ENTRY_Z
    this._entryT = 0;
    this._entryDone = false;
    this._entryStartZ = -26;
  }

  _tickEntry(delta) {
    if (this._entryDone) return;
    const g = this.scene;
    if (!g.boss) return;
    this._entryT += delta;
    const p = Math.min(this._entryT / 1.6, 1);
    // Back-ease out
    const c1 = 1.70158, c3 = c1 + 1;
    const eased = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    g.boss.mesh.position.z = this._entryStartZ + (BOSS_ENTRY_Z - this._entryStartZ) * eased;
    if (p >= 1) {
      this._entryDone = true;
      this._startTimers();
      this._announce();
    }
  }

  _startTimers() {
    this._fireTimer = setInterval(() => this._bossShoot(), BOSS_FIRE_RATE);
    this._specTimer = setInterval(() => this._bossSpecial(), BOSS_SPECIAL_DELAY);
  }

  _announce() {
    const g = this.scene;
    g.hud.showWaveBanner('⚠ BOSS INCOMING ⚠');
    audioManager.sfxBossWarning();
  }

  // ── Boss shooting ──────────────────────────────────────────────────────────

  _bossShoot() {
    const g = this.scene;
    if (!g.boss || !g.boss.active || g.gameOver || this._specRunning) return;

    const count  = 5;
    const spread = 1.5;
    const bPos   = g.boss.mesh.position;
    const aim    = Math.atan2(g.playerPos.x - bPos.x, g.playerPos.z - bPos.z);
    const speed  = 10 + g.wave * 0.4;

    for (let i = 0; i < count; i++) {
      const angle = aim + (i - (count - 1) / 2) * (spread / (count - 1));
      const mesh = g.modelFactory.createEnemyBullet();
      mesh.position.set(bPos.x + Math.sin(angle) * 1.8, bPos.y, bPos.z + Math.cos(angle) * 1.8);
      g.threeScene.add(mesh);
      g.enemyBullets.push({
        mesh,
        vx: Math.sin(angle) * speed,
        vy: 0,
        vz: Math.cos(angle) * speed,
        active: true,
      });
    }
  }

  // ── Special ability ────────────────────────────────────────────────────────

  _bossSpecial() {
    const g = this.scene;
    if (!g.boss || !g.boss.active || g.gameOver || this._specRunning) return;
    this._specRunning = true;
    audioManager.sfxBossWarning();

    const numSafe = 2 + Math.floor(Math.random() * 2);
    const safeZones = this._buildSafeZones(numSafe);

    // Convert 3D world positions to screen positions for the DOM overlay
    const screenZones = safeZones.map(sz => {
      const screenPos = this._worldToScreen(sz);
      return { ...screenPos, worldPos: sz };
    });

    g.hud.showBossSpecial(screenZones, window.innerWidth, window.innerHeight, null);

    setTimeout(() => {
      if (g.gameOver) { this._specRunning = false; return; }
      const inSafe = safeZones.some(sz => {
        const d = new THREE.Vector3(sz.x, g.playerPos.y, sz.z)
          .distanceTo(g.playerPos);
        return d <= BOSS_SAFE_RADIUS;
      });
      if (!inSafe) {
        g.damagePlayer(BOSS_SPECIAL_DAMAGE);
        g.hud.screenShake();
      }
      g.hud.flashRed();
      g.hud.hideBossSpecial();
      setTimeout(() => { this._specRunning = false; }, 300);
    }, BOSS_SPECIAL_WARN);
  }

  _buildSafeZones(numSafe) {
    const zones = [];
    for (let i = 0; i < numSafe; i++) {
      let x, z, tries = 0;
      do {
        x = -6 + Math.random() * 12;
        z = this.scene.playerPos.z - 8 + Math.random() * 10;
        tries++;
      } while (
        tries < 25 &&
        zones.some(sz => Math.hypot(x - sz.x, z - sz.z) < BOSS_SAFE_RADIUS * 2.5)
      );
      zones.push({ x, z });
    }
    return zones;
  }

  _worldToScreen(worldPos) {
    // Project 3D world position into screen space
    const g = this.scene;
    const v = new THREE.Vector3(worldPos.x, 1.2, worldPos.z);
    v.project(g.camera);
    const W = window.innerWidth, H = window.innerHeight;
    const screenX = (v.x + 1) / 2 * W;
    const screenY = (1 - (v.y + 1) / 2) * H;
    // Approximate screen radius for the safe zone circle
    const edge = new THREE.Vector3(worldPos.x + BOSS_SAFE_RADIUS, 1.2, worldPos.z);
    edge.project(g.camera);
    const edgeX = (edge.x + 1) / 2 * W;
    const screenR = Math.abs(edgeX - screenX);
    return { screenX, screenY, screenR };
  }

  // ── Damage & death ─────────────────────────────────────────────────────────

  damageBoss(amount) {
    const g = this.scene;
    if (!g.boss || !g.boss.active) return;
    g.boss.health -= amount;
    g.hud.updateBossBar(g.boss.health / g.boss.maxHealth);
    // Brief emissive flash
    g.boss.mesh.traverse(o => {
      if (o.isMesh) { o.material.emissive = new THREE.Color(0xff2200); o.material.emissiveIntensity = 0.6; }
    });
    setTimeout(() => {
      if (!g.boss) return;
      g.boss.mesh.traverse(o => {
        if (o.isMesh) { o.material.emissive.setHex(0x000000); o.material.emissiveIntensity = 0; }
      });
    }, 55);
    if (g.boss.health <= 0) this._onBossDied();
  }

  onIceHitBoss() {
    const g = this.scene;
    const boss = g.boss;
    if (!boss || boss.slowed) return;
    this.damageBoss(BOSS_ICE_DMG);
    boss.slowed = true;
    boss.origOscPeriod = boss.oscPeriod;
    boss.oscPeriod /= ICE_SLOW_FACTOR;
    setTimeout(() => {
      if (!boss || !boss.active) return;
      boss.slowed = false;
      boss.oscPeriod = boss.origOscPeriod;
    }, ICE_SLOW_DURATION);
  }

  onPoisonHitBoss() {
    const g = this.scene;
    const boss = g.boss;
    this.damageBoss(BOSS_POISON_DMG);
    if (!boss || boss.poisoned) return;
    boss.poisoned = true;
    let ticks = POISON_DOT_TICKS;
    const doDot = () => {
      if (!boss.active || ticks <= 0) { if (boss.active) boss.poisoned = false; return; }
      ticks--;
      this.damageBoss(BOSS_POISON_DOT);
      if (boss.active) setTimeout(doDot, POISON_DOT_INTERVAL);
    };
    setTimeout(doDot, POISON_DOT_INTERVAL);
  }

  _onBossDied() {
    const g = this.scene;
    audioManager.sfxBossDie();
    const bossPos = g.boss.mesh.position.clone();

    this.stopTimers();
    g.threeScene.remove(g.boss.mesh);
    g.boss.active = false;
    g.boss = null;
    g.bossActive = false;
    g.hud.hideBossBar();

    g.effectsManager.bossDeathExplosions(g, bossPos);
    g.score += 500 * g.wave;

    g.hud.showWaveBanner('✓ BOSS DEFEATED');
    setTimeout(() => g.advanceWave(), 2200);
  }

  stopTimers() {
    clearInterval(this._fireTimer);
    clearInterval(this._specTimer);
    this._fireTimer = null;
    this._specTimer = null;
    this._specRunning = false;
  }

  // Called from GameScene.update so entry animation runs in the game loop
  updateEntry(delta) {
    this._tickEntry(delta);
  }
}

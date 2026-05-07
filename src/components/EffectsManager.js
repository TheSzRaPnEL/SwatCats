import * as THREE from 'three';
import { audioManager } from '../audio/AudioManager.js';
import {
  ROCKET_AOE_RADIUS,
  ICE_AOE_RADIUS, ICE_DAMAGE, ICE_SLOW_FACTOR, ICE_SLOW_DURATION,
  ZAP_DAMAGE, ZAP_HITS, ZAP_INTERVAL,
  POISON_AOE_RADIUS, POISON_DAMAGE, POISON_DOT_DAMAGE, POISON_DOT_TICKS, POISON_DOT_INTERVAL,
} from '../constants/gameConstants.js';

// Simple tween objects updated each frame
class ScaleFadeEffect {
  constructor(scene, mesh, maxScale, duration, color) {
    this.scene    = scene;
    this.mesh     = mesh;
    this.t        = 0;
    this.duration = duration;
    this.maxScale = maxScale;
    this.done     = false;
    scene.add(mesh);
  }

  update(delta) {
    this.t += delta;
    const p = Math.min(this.t / this.duration, 1);
    const s = p * this.maxScale;
    this.mesh.scale.setScalar(s);
    this.mesh.material.opacity = 1 - p;
    if (p >= 1) {
      this.scene.remove(this.mesh);
      this.done = true;
    }
  }
}

export class EffectsManager {
  constructor(scene) {
    this.scene   = scene;
    this._effects = []; // active ScaleFadeEffect objects
  }

  update(delta) {
    this._effects = this._effects.filter(e => {
      e.update(delta);
      return !e.done;
    });
  }

  // ── Enemy kill ─────────────────────────────────────────────────────────────

  killEnemy(game, enemy) {
    game.score += 10 * game.wave;
    game.killCount++;
    this._burst(enemy.mesh.position, 0xff5500, 1.5, 0.28);
    audioManager.sfxEnemyDie();
    game.threeScene.remove(enemy.mesh);
    enemy.active = false;
  }

  flashEnemy(mesh) {
    // Brief white flash by changing emissive
    const mats = this._getMats(mesh);
    mats.forEach(m => { m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 1.5; });
    setTimeout(() => {
      mats.forEach(m => { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; });
    }, 60);
  }

  _getMats(mesh) {
    const out = [];
    mesh.traverse(o => { if (o.isMesh && o.material) out.push(o.material); });
    return out;
  }

  // ── Rocket explosion ───────────────────────────────────────────────────────

  triggerRocketExplosion(game, pos) {
    this._rocketBlast(pos);
    game.enemies.forEach(enemy => {
      if (!enemy.active) return;
      if (enemy.mesh.position.distanceTo(pos) <= ROCKET_AOE_RADIUS) this.killEnemy(game, enemy);
    });
    game.enemies = game.enemies.filter(e => e.active);
    game.hud.screenShake();
    game.score += 5 * game.wave;
    audioManager.sfxRocketExplode();
  }

  triggerRocketExplosionNoDmg(game, pos) {
    this._rocketBlast(pos);
    audioManager.sfxRocketExplode();
  }

  _rocketBlast(pos) {
    this._burst(pos, 0xff6600, ROCKET_AOE_RADIUS, 0.42);
    this._burst(pos, 0xffee44, ROCKET_AOE_RADIUS * 0.55, 0.28);
  }

  // ── Ice explosion ──────────────────────────────────────────────────────────

  triggerIceExplosion(game, pos) {
    this._burst(pos, 0x0066ff, ICE_AOE_RADIUS, 0.6);
    this._burst(pos, 0x88ddff, ICE_AOE_RADIUS * 0.65, 0.45);
    this._burst(pos, 0xffffff, 0.8, 0.25);
    audioManager.sfxIceExplode();
    this._iceAffect(game, pos);
    game.score += 5 * game.wave;
    if (game.boss && game.boss.active) game.bossController.onIceHitBoss();
  }

  _iceAffect(game, pos) {
    game.enemies.filter(e => e.active).forEach(enemy => {
      this.flashIce(enemy.mesh);
      enemy.health -= ICE_DAMAGE;
      if (enemy.health <= 0) { this.killEnemy(game, enemy); return; }
      if (!enemy.slowed) {
        enemy.origVX = enemy.vx;
        enemy.origVZ = enemy.vz;
        enemy.slowed = true;
        enemy.vx *= ICE_SLOW_FACTOR;
        enemy.vz *= ICE_SLOW_FACTOR;
        enemy.sineFreq *= ICE_SLOW_FACTOR;
        this._tintMesh(enemy.mesh, 0x88ccff);
        setTimeout(() => {
          if (!enemy.active) return;
          enemy.slowed = false;
          enemy.vx = enemy.origVX;
          enemy.vz = enemy.origVZ;
          enemy.sineFreq /= ICE_SLOW_FACTOR;
          this._clearTint(enemy.mesh);
        }, ICE_SLOW_DURATION);
      }
    });
    game.enemies = game.enemies.filter(e => e.active);
  }

  // ── Zap chain ──────────────────────────────────────────────────────────────

  triggerZapChain(game, pos) {
    this._burst(pos, 0xffff00, 1.2, 0.3);

    let hitsLeft = ZAP_HITS;
    const doZap = () => {
      if (hitsLeft <= 0) return;
      hitsLeft--;
      audioManager.sfxZapHit();

      game.enemies.filter(e => e.active).forEach(enemy => {
        this._zapFlash(enemy.mesh);
        enemy.health -= ZAP_DAMAGE;
        if (enemy.health <= 0) this.killEnemy(game, enemy);
      });
      game.enemies = game.enemies.filter(e => e.active);

      if (game.boss && game.boss.active) game.bossController.damageBoss(ZAP_DAMAGE);

      this._burst(pos, 0xffff44, 1.2 + (ZAP_HITS - hitsLeft) * 0.8, 0.35);
      if (hitsLeft > 0) setTimeout(doZap, ZAP_INTERVAL);
    };
    doZap();
  }

  // ── Poison explosion ───────────────────────────────────────────────────────

  triggerPoisonExplosion(game, pos) {
    this._burst(pos, 0x22aa00, POISON_AOE_RADIUS, 0.7);
    this._burst(pos, 0x88ff44, POISON_AOE_RADIUS * 0.6, 0.5);
    audioManager.sfxPoisonExplode();
    this._poisonAffect(game, pos);
    game.score += 5 * game.wave;
    if (game.boss && game.boss.active) game.bossController.onPoisonHitBoss();
  }

  _poisonAffect(game, pos) {
    game.enemies.filter(e => e.active).forEach(enemy => {
      if (enemy.mesh.position.distanceTo(pos) > POISON_AOE_RADIUS) return;
      this.flashPoison(enemy.mesh);
      enemy.health -= POISON_DAMAGE;
      if (enemy.health <= 0) { this.killEnemy(game, enemy); return; }
      if (!enemy.poisoned) {
        enemy.poisoned = true;
        this._tintMesh(enemy.mesh, 0x55dd00);
        let ticks = POISON_DOT_TICKS;
        const doDot = () => {
          if (!enemy.active || ticks <= 0) {
            if (enemy.active) { enemy.poisoned = false; this._clearTint(enemy.mesh); }
            return;
          }
          ticks--;
          audioManager.sfxPoisonTick();
          this.flashPoison(enemy.mesh);
          enemy.health -= POISON_DOT_DAMAGE;
          if (enemy.health <= 0) { this.killEnemy(game, enemy); return; }
          setTimeout(doDot, POISON_DOT_INTERVAL);
        };
        setTimeout(doDot, POISON_DOT_INTERVAL);
      }
    });
    game.enemies = game.enemies.filter(e => e.active);
  }

  // ── Large explosion (game over / boss death) ───────────────────────────────

  bigExplosion(game, pos) {
    this._burst(pos, 0xff6600, 3.5, 0.7);
    this._burst(pos, 0xff2200, 5.0, 1.0);
    this._burst(pos, 0xffee00, 2.0, 0.5);
    game.hud.screenShake();
    audioManager.sfxPlayerDie();
  }

  bossDeathExplosions(game, pos) {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 3
        );
        this._burst(pos.clone().add(offset), 0xff6600, 1.5 + i * 0.4, 0.38);
        this._burst(pos.clone().add(offset), 0xffaa00, 0.8, 0.28);
      }, i * 120);
    }
    game.hud.screenShake();
  }

  // ── Flash helpers ──────────────────────────────────────────────────────────

  flashIce(mesh) {
    const mats = this._getMats(mesh);
    mats.forEach(m => { m.emissive = new THREE.Color(0x88ccff); m.emissiveIntensity = 1.2; });
    setTimeout(() => mats.forEach(m => { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; }), 80);
  }

  _zapFlash(mesh) {
    const mats = this._getMats(mesh);
    mats.forEach(m => { m.emissive = new THREE.Color(0xffff00); m.emissiveIntensity = 1.5; });
    setTimeout(() => mats.forEach(m => { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; }), 60);
  }

  flashPoison(mesh) {
    const mats = this._getMats(mesh);
    mats.forEach(m => { m.emissive = new THREE.Color(0x55ff00); m.emissiveIntensity = 1.0; });
    setTimeout(() => mats.forEach(m => { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; }), 70);
  }

  _tintMesh(mesh, hex) {
    const mats = this._getMats(mesh);
    mats.forEach(m => { m.emissive = new THREE.Color(hex); m.emissiveIntensity = 0.5; });
  }

  _clearTint(mesh) {
    const mats = this._getMats(mesh);
    mats.forEach(m => { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; });
  }

  // ── Core burst helper ──────────────────────────────────────────────────────

  _burst(pos, color, maxRadius, duration) {
    const geo = new THREE.SphereGeometry(0.5, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const m   = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    const eff = new ScaleFadeEffect(this.scene.threeScene, m, maxRadius * 2, duration, color);
    this._effects.push(eff);
  }
}

import * as THREE from 'three';
import { audioManager } from '../audio/AudioManager.js';
import {
  PLAYER_SPEED, PLAYER_R, ENEMY_R, BOSS_R, BULLET_R,
  BOSS_ROCKET_DMG,
} from '../constants/gameConstants.js';
import { ModelFactory      } from '../components/ModelFactory.js';
import { Background        } from '../components/Background.js';
import { HUD               } from '../components/HUD.js';
import { TouchControls     } from '../components/TouchControls.js';
import { ThrusterRenderer  } from '../components/ThrusterRenderer.js';
import { WeaponSystem      } from '../components/WeaponSystem.js';
import { EnemyManager      } from '../components/EnemyManager.js';
import { EffectsManager    } from '../components/EffectsManager.js';
import { BossController    } from '../components/BossController.js';

export class GameScene {
  constructor() {
    // ── Three.js scene ──────────────────────────────────────────────────────
    this.threeScene = new THREE.Scene();
    this.threeScene.background = new THREE.Color(0x060614);
    this.threeScene.fog = new THREE.FogExp2(0x060614, 0.016);

    // ── Camera: ~70° from horizontal (20° tilt from straight down) ──────────
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 400);
    this.camera.position.set(0, 22, 10);
    this.camera.lookAt(0, 0, -4);

    this._setupLights();

    // ── Components (created once, survive restarts) ─────────────────────────
    this.modelFactory    = new ModelFactory();
    this.background      = new Background(this.threeScene);
    this.hud             = new HUD();
    this.touchControls   = new TouchControls(this);
    this.thrusterRenderer = new ThrusterRenderer(this.threeScene);
    this.weaponSystem    = new WeaponSystem(this);
    this.enemyManager    = new EnemyManager(this);
    this.effectsManager  = new EffectsManager(this);
    this.bossController  = new BossController(this);

    this.background.create();

    // Keyboard state
    this.keys = {};
    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup',   e => { this.keys[e.code] = false; });

    // Touch controls: wire callbacks after weapon system exists
    this.touchControls.init(
      () => this.weaponSystem.fireRocket(),
      () => this.weaponSystem.fireIceRocket(),
      () => this.weaponSystem.fireZapRocket(),
      () => this.weaponSystem.firePoisonRocket()
    );

    // Game state
    this.gameRunning = false;
    this.gameOver    = false;
    this._resetState();

    this.hud.showMenu(() => this._startGame());
  }

  // ── Lighting ───────────────────────────────────────────────────────────────

  _setupLights() {
    this.threeScene.add(new THREE.AmbientLight(0x334466, 1.3));

    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(4, 20, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far  = 80;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -20;
    sun.shadow.camera.right = sun.shadow.camera.top   =  20;
    this.threeScene.add(sun);

    // Warm fill from front-below
    const fill = new THREE.DirectionalLight(0x3355aa, 0.55);
    fill.position.set(0, -4, 12);
    this.threeScene.add(fill);
  }

  // ── State management ───────────────────────────────────────────────────────

  _resetState() {
    this.score        = 0;
    this.playerHealth = 100;
    this.wave         = 1;
    this.killCount    = 0;
    this.bossActive   = false;
    this.boss         = null;
    this.gameOver     = false;
    this.moveX        = 0;
    this.moveZ        = 0;
    this.playerPos    = new THREE.Vector3(0, 1.2, 5);
    this.playerMesh   = null;

    this.bullets       = [];
    this.rockets       = [];
    this.iceRockets    = [];
    this.zapRockets    = [];
    this.poisonRockets = [];
    this.enemies       = [];
    this.enemyBullets  = [];

    this._spawnTimer = null;
    this._fireTimer  = null;
    this._waveTimer  = null;
  }

  _clearEntities() {
    const removeAll = arr => arr.forEach(e => this.threeScene.remove(e.mesh));
    removeAll(this.bullets);
    removeAll(this.rockets);
    removeAll(this.iceRockets);
    removeAll(this.zapRockets);
    removeAll(this.poisonRockets);
    removeAll(this.enemies);
    removeAll(this.enemyBullets);
    if (this.boss) this.threeScene.remove(this.boss.mesh);
  }

  _clearTimers() {
    clearInterval(this._spawnTimer);
    clearInterval(this._fireTimer);
    clearTimeout(this._waveTimer);
    this._spawnTimer = null;
    this._fireTimer  = null;
    this._waveTimer  = null;
  }

  // ── Game start / restart ───────────────────────────────────────────────────

  _startGame() {
    this._clearTimers();
    this._clearEntities();
    if (this.playerMesh) this.threeScene.remove(this.playerMesh);
    this.thrusterRenderer.clear();
    this.bossController.stopTimers();

    this._resetState();

    this.playerMesh = this.modelFactory.createPlayer();
    this.playerMesh.position.copy(this.playerPos);
    this.threeScene.add(this.playerMesh);

    this.weaponSystem.reset();
    this.gameRunning = true;

    this.hud.showGame(this.wave);
    this.hud.updateHealth(100);

    audioManager.resume();
    audioManager.startMusic();

    this._setupTimers();
  }

  _setupTimers() {
    this._spawnTimer = setInterval(() => this.enemyManager.spawnEnemy(),     this.enemyManager.spawnDelay());
    this._fireTimer  = setInterval(() => this.enemyManager.enemiesShoot(),   this.enemyManager.enemyFireDelay());
    this._waveTimer  = setTimeout(  () => this._endWave(),                    20000);
  }

  // ── Wave flow ──────────────────────────────────────────────────────────────

  _endWave() {
    if (this.gameOver || this.bossActive) return;
    clearInterval(this._spawnTimer);
    this._spawnTimer = null;
    this.bossActive = true;
    this.bossController.spawnBoss();
  }

  advanceWave() {
    this.wave++;
    this.hud.updateWave(this.wave);
    audioManager.sfxWaveComplete();
    this.playerHealth = Math.min(100, this.playerHealth + 20);
    this.hud.updateHealth(this.playerHealth);

    this._clearTimers();
    this._setupTimers();
    this.bossActive = false;
  }

  // ── Main update ────────────────────────────────────────────────────────────

  update(delta) {
    if (!this.gameRunning) return;

    this.effectsManager.update(delta);

    if (this.gameOver) return;

    this._handleMovement(delta);
    this.weaponSystem.update(delta);
    this._moveEntities(delta);
    this.bossController.update(delta);
    this.bossController.updateEntry(delta);
    this._checkCollisions();
    this._cleanupOffscreen();
    this.thrusterRenderer.update(this.playerMesh, this.moveX, this.moveZ);
    this.background.scroll(delta);

    this.hud.updateScore(this.score);
    this.hud.updateHealth(this.playerHealth);
    this.hud.updateRocketStatus(
      this.weaponSystem.rocketReady,
      this.weaponSystem.rocketCooldownRemaining
    );
  }

  // ── Movement ───────────────────────────────────────────────────────────────

  _handleMovement(delta) {
    let vx = 0, vz = 0;

    if (this.keys['ArrowLeft']  || this.keys['KeyA']) vx = -1;
    else if (this.keys['ArrowRight'] || this.keys['KeyD']) vx = 1;
    if (this.keys['ArrowUp']    || this.keys['KeyW']) vz = -1;
    else if (this.keys['ArrowDown']  || this.keys['KeyS']) vz = 1;

    if (this.touchControls.joy.active) {
      vx = this.touchControls.joy.dx;
      vz = this.touchControls.joy.dy;
    }

    if (vx !== 0 && vz !== 0) { vx *= 0.707; vz *= 0.707; }

    this.moveX = vx;
    this.moveZ = vz;

    this.playerPos.x = THREE.MathUtils.clamp(
      this.playerPos.x + vx * PLAYER_SPEED * delta, -7.5, 7.5
    );
    this.playerPos.z = THREE.MathUtils.clamp(
      this.playerPos.z + vz * PLAYER_SPEED * delta, -18, 7.8
    );
    this.playerMesh.position.copy(this.playerPos);

    // Bank on roll, pitch forward
    const targetRoll  = -vx * 0.32;
    const targetPitch =  vz * 0.1;
    this.playerMesh.rotation.z = THREE.MathUtils.lerp(this.playerMesh.rotation.z, targetRoll,  0.13);
    this.playerMesh.rotation.x = THREE.MathUtils.lerp(this.playerMesh.rotation.x, targetPitch, 0.13);
  }

  // ── Entity movement ────────────────────────────────────────────────────────

  _moveEntities(delta) {
    const move = arr => arr.forEach(e => {
      e.mesh.position.x += e.vx * delta;
      e.mesh.position.y += (e.vy || 0) * delta;
      e.mesh.position.z += e.vz * delta;
    });
    move(this.bullets);
    move(this.rockets);
    move(this.iceRockets);
    move(this.zapRockets);
    move(this.poisonRockets);
    move(this.enemyBullets);

    this.enemies.forEach(e => {
      e.mesh.position.x += e.vx * delta;
      e.mesh.position.z += e.vz * delta;
      if (e.sineAmp > 0) {
        e.sineT += delta;
        e.mesh.position.x = THREE.MathUtils.clamp(
          e.sineBaseX + Math.sin(e.sineT * e.sineFreq) * e.sineAmp, -8.5, 8.5
        );
      } else {
        // Clamp diagonal movers
        if (e.mesh.position.x < -8.5 || e.mesh.position.x > 8.5) e.vx *= -1;
      }
    });
  }

  // ── Collision detection ────────────────────────────────────────────────────

  _checkCollisions() {
    const pp = this.playerPos;

    // ── Player weapons vs enemies ──────────────────────────────────────────
    this._sweepProjectiles(this.bullets, BULLET_R + ENEMY_R, (bullet, enemy) => {
      this._removeProj(this.bullets, bullet);
      this.effectsManager.flashEnemy(enemy.mesh);
      enemy.health--;
      if (enemy.health <= 0) this.effectsManager.killEnemy(this, enemy);
    });
    this.enemies = this.enemies.filter(e => e.active);

    this._sweepProjectiles(this.rockets, BULLET_R + ENEMY_R, (rocket, _enemy) => {
      const pos = rocket.mesh.position.clone();
      this._removeProj(this.rockets, rocket);
      this.effectsManager.triggerRocketExplosion(this, pos);
    });
    this.enemies = this.enemies.filter(e => e.active);

    this._sweepProjectiles(this.iceRockets, BULLET_R + ENEMY_R, (rocket, _enemy) => {
      const pos = rocket.mesh.position.clone();
      this._removeProj(this.iceRockets, rocket);
      this.effectsManager.triggerIceExplosion(this, pos);
    });
    this.enemies = this.enemies.filter(e => e.active);

    this._sweepProjectiles(this.zapRockets, BULLET_R + ENEMY_R, (rocket, _enemy) => {
      const pos = rocket.mesh.position.clone();
      this._removeProj(this.zapRockets, rocket);
      this.effectsManager.triggerZapChain(this, pos);
    });
    this.enemies = this.enemies.filter(e => e.active);

    this._sweepProjectiles(this.poisonRockets, BULLET_R + ENEMY_R, (rocket, _enemy) => {
      const pos = rocket.mesh.position.clone();
      this._removeProj(this.poisonRockets, rocket);
      this.effectsManager.triggerPoisonExplosion(this, pos);
    });
    this.enemies = this.enemies.filter(e => e.active);

    // ── Enemy bullets vs player ────────────────────────────────────────────
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      if (!b.active) continue;
      if (b.mesh.position.distanceTo(pp) < BULLET_R + PLAYER_R) {
        this.threeScene.remove(b.mesh);
        b.active = false;
        this.damagePlayer(8);
      }
    }
    this.enemyBullets = this.enemyBullets.filter(e => e.active);

    // ── Enemies vs player ──────────────────────────────────────────────────
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.active) continue;
      if (e.mesh.position.distanceTo(pp) < ENEMY_R + PLAYER_R) {
        this.threeScene.remove(e.mesh);
        e.active = false;
        this.damagePlayer(20);
        this.hud.screenShake();
      }
    }
    this.enemies = this.enemies.filter(e => e.active);

    // ── Player weapons vs boss ─────────────────────────────────────────────
    if (this.boss && this.boss.active) {
      const bp = this.boss.mesh.position;

      this._sweepVsBoss(this.bullets, BULLET_R + BOSS_R, (b) => {
        this._removeProj(this.bullets, b);
        this.bossController.damageBoss(1);
      });

      this._sweepVsBoss(this.rockets, BULLET_R + BOSS_R, (r) => {
        const pos = r.mesh.position.clone();
        this._removeProj(this.rockets, r);
        this.effectsManager.triggerRocketExplosionNoDmg(this, pos);
        this.bossController.damageBoss(BOSS_ROCKET_DMG);
      });

      this._sweepVsBoss(this.iceRockets, BULLET_R + BOSS_R, (r) => {
        const pos = r.mesh.position.clone();
        this._removeProj(this.iceRockets, r);
        this.effectsManager.triggerIceExplosion(this, pos);
        this.bossController.onIceHitBoss();
      });

      this._sweepVsBoss(this.zapRockets, BULLET_R + BOSS_R, (r) => {
        const pos = r.mesh.position.clone();
        this._removeProj(this.zapRockets, r);
        this.effectsManager.triggerZapChain(this, pos);
        this.bossController.damageBoss(1);
      });

      this._sweepVsBoss(this.poisonRockets, BULLET_R + BOSS_R, (r) => {
        const pos = r.mesh.position.clone();
        this._removeProj(this.poisonRockets, r);
        this.effectsManager.triggerPoisonExplosion(this, pos);
        this.bossController.onPoisonHitBoss();
      });

      // Boss body vs player
      if (bp.distanceTo(pp) < BOSS_R + PLAYER_R) {
        this.damagePlayer(25);
        this.hud.screenShake();
      }
    }
  }

  _sweepProjectiles(arr, threshold, onHit) {
    for (let i = arr.length - 1; i >= 0; i--) {
      const proj = arr[i];
      if (!proj.active) continue;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        if (!enemy.active) continue;
        if (proj.mesh.position.distanceTo(enemy.mesh.position) < threshold) {
          onHit(proj, enemy);
          break;
        }
      }
    }
  }

  _sweepVsBoss(arr, threshold, onHit) {
    if (!this.boss || !this.boss.active) return;
    const bp = this.boss.mesh.position;
    for (let i = arr.length - 1; i >= 0; i--) {
      const proj = arr[i];
      if (!proj.active) continue;
      if (proj.mesh.position.distanceTo(bp) < threshold) {
        onHit(proj);
      }
    }
  }

  _removeProj(arr, proj) {
    proj.active = false;
    this.threeScene.remove(proj.mesh);
  }

  // ── Cleanup offscreen ──────────────────────────────────────────────────────

  _cleanupOffscreen() {
    const clean = arr => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const e = arr[i];
        const p = e.mesh.position;
        if (Math.abs(p.x) > 13 || p.z > 13 || p.z < -30) {
          this.threeScene.remove(e.mesh);
          arr.splice(i, 1);
        }
      }
    };
    clean(this.bullets);
    clean(this.rockets);
    clean(this.enemyBullets);
    clean(this.enemies);

    const cleanSpecial = (arr, onExpire) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const r = arr[i];
        const p = r.mesh.position;
        if (Math.abs(p.x) > 13 || p.z > 13 || p.z < -30) {
          onExpire(p.clone());
          this.threeScene.remove(r.mesh);
          arr.splice(i, 1);
        }
      }
    };
    cleanSpecial(this.iceRockets,    pos => this.effectsManager.triggerIceExplosion(this, pos));
    cleanSpecial(this.zapRockets,    pos => this.effectsManager.triggerZapChain(this, pos));
    cleanSpecial(this.poisonRockets, pos => this.effectsManager.triggerPoisonExplosion(this, pos));
  }

  // ── Player damage & game over ──────────────────────────────────────────────

  damagePlayer(amount) {
    if (this.gameOver) return;
    this.playerHealth = Math.max(0, this.playerHealth - amount);
    this.hud.flashRed();
    audioManager.sfxPlayerHit();
    if (this.playerHealth <= 0) this._triggerGameOver();
  }

  _triggerGameOver() {
    this.gameOver = true;
    this._clearTimers();
    this.bossController.stopTimers();
    this.touchControls.hideSubRocketButtons();
    this.thrusterRenderer.clear();
    audioManager.sfxPlayerDie();
    audioManager.stopMusic();

    this.effectsManager.bigExplosion(this, this.playerPos.clone());

    setTimeout(() => {
      this.hud.showGameOver(this.score, this.wave, () => {
        this.hud.hideGameOver();
        this._startGame();
      });
    }, 1200);
  }
}

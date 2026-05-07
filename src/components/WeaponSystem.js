import { audioManager } from '../audio/AudioManager.js';
import {
  BULLET_SPEED, FIRE_RATE_MS,
  ROCKET_SPEED, ROCKET_COOLDOWN_MS,
} from '../constants/gameConstants.js';

export class WeaponSystem {
  constructor(scene) {
    this.scene  = scene;
    this.lastFired               = 0;
    this.rocketReady             = true;
    this.rocketCooldownRemaining = 0;
    this._fireKey   = false; // set each frame from keys
    this._rocketKey = false;
    this._rocketKeyWas = false;
  }

  reset() {
    this.lastFired               = 0;
    this.rocketReady             = true;
    this.rocketCooldownRemaining = 0;
    this._rocketKeyWas = false;
  }

  update(delta) {
    const g = this.scene;
    const now = performance.now();

    // Auto-fire: held SPACE or touch fire button
    const firing = g.touchControls.isFiring || g.keys['Space'];
    if (firing && now > this.lastFired + FIRE_RATE_MS) {
      this.lastFired = now;
      this._shootBullet();
    }

    // Rocket: just-pressed R
    const rDown = !!g.keys['KeyR'];
    if (rDown && !this._rocketKeyWas) this.fireRocket();
    this._rocketKeyWas = rDown;

    // Cooldown tick
    if (!this.rocketReady) {
      this.rocketCooldownRemaining -= delta * 1000;
      if (this.rocketCooldownRemaining <= 0) {
        this.rocketReady             = true;
        this.rocketCooldownRemaining = 0;
        g.touchControls.onRocketReady();
      } else {
        g.touchControls.updateCooldownText(this.rocketCooldownRemaining);
      }
    }
  }

  _shootBullet() {
    const g = this.scene;
    const px = g.playerPos.x;
    const py = g.playerPos.y;
    const pz = g.playerPos.z;

    const mesh = g.modelFactory.createBullet();
    mesh.position.set(px, py, pz - 1.1);
    g.threeScene.add(mesh);
    g.bullets.push({ mesh, vx: 0, vy: 0, vz: -BULLET_SPEED, active: true });
    audioManager.sfxShoot();
  }

  fireRocket() {
    if (!this.rocketReady || this.scene.gameOver) return;
    this._spawnRocket('rocket', this.scene.rockets);
    this.rocketReady             = false;
    this.rocketCooldownRemaining = ROCKET_COOLDOWN_MS;
    this.scene.touchControls.onRocketFired();
    audioManager.sfxRocketLaunch();
  }

  fireIceRocket() {
    if (this.scene.gameOver) return;
    this.scene.touchControls.hideSubRocketButtons();
    this._spawnRocket('iceRocket', this.scene.iceRockets);
    audioManager.sfxIceLaunch();
  }

  fireZapRocket() {
    if (this.scene.gameOver) return;
    this.scene.touchControls.hideSubRocketButtons();
    this._spawnRocket('zapRocket', this.scene.zapRockets);
    audioManager.sfxZapLaunch();
  }

  firePoisonRocket() {
    if (this.scene.gameOver) return;
    this.scene.touchControls.hideSubRocketButtons();
    this._spawnRocket('poisonRocket', this.scene.poisonRockets);
    audioManager.sfxPoisonLaunch();
  }

  _spawnRocket(type, arr) {
    const g = this.scene;
    const mesh = g.modelFactory[
      type === 'rocket'       ? 'createRocket'       :
      type === 'iceRocket'    ? 'createIceRocket'    :
      type === 'zapRocket'    ? 'createZapRocket'    :
                                'createPoisonRocket'
    ]();
    mesh.position.set(g.playerPos.x, g.playerPos.y, g.playerPos.z - 1.2);
    g.threeScene.add(mesh);
    arr.push({ mesh, vx: 0, vy: 0, vz: -ROCKET_SPEED, active: true });
  }
}

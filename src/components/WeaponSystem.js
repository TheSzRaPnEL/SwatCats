import { audioManager } from '../audio/AudioManager.js';
import {
  BULLET_SPEED, FIRE_RATE_MS,
  ROCKET_SPEED, ROCKET_COOLDOWN_MS,
} from '../constants/gameConstants.js';


export class WeaponSystem {
  constructor(scene) {
    this.scene  = scene;
    this.player = null; // set via init()

    this.lastFired               = 0;
    this.rocketReady             = true;
    this.rocketCooldownRemaining = 0;

    this.bullets       = null;
    this.rockets       = null;
    this.iceRockets    = null;
    this.zapRockets    = null;
    this.poisonRockets = null;

    this.fireKey   = null;
    this.rocketKey = null;
  }

  init(player, bullets, rockets, iceRockets, zapRockets, poisonRockets) {
    this.player        = player;
    this.bullets       = bullets;
    this.rockets       = rockets;
    this.iceRockets    = iceRockets;
    this.zapRockets    = zapRockets;
    this.poisonRockets = poisonRockets;

    this.fireKey   = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.rocketKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
  }

  handleFiring(time) {
    if (this.scene.touchControls.isFiring || this.fireKey.isDown) {
      if (time > this.lastFired + FIRE_RATE_MS) {
        this.lastFired = time;
        this.shootBullet();
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.rocketKey)) this.fireRocket();
  }

  shootBullet() {
    const r  = this.player.rotation;
    const bx = this.player.x - 43 * Math.sin(r);
    const by = this.player.y - 43 * Math.cos(r);
    const b  = this.bullets.create(bx, by, 'bullet');
    if (!b) return;
    b.setVelocityY(-BULLET_SPEED);
    b.setDepth(9);
    b.body.setSize(4, 14);
    audioManager.sfxShoot();
  }

  fireRocket() {
    if (!this.rocketReady || this.scene.gameOver) return;
    const r = this.player.rotation;
    const rocket = this.rockets.create(
      this.player.x - 48 * Math.sin(r),
      this.player.y - 48 * Math.cos(r),
      'rocket'
    );
    if (!rocket) return;
    rocket.setVelocityY(-ROCKET_SPEED).setDepth(9);
    this.rocketReady             = false;
    this.rocketCooldownRemaining = ROCKET_COOLDOWN_MS;
    this.scene.touchControls.onRocketFired();
    audioManager.sfxRocketLaunch();
  }

  fireIceRocket() {
    if (this.scene.gameOver) return;
    this.scene.touchControls.hideSubRocketButtons();
    const r = this.player.rotation;
    const ice = this.iceRockets.create(
      this.player.x - 48 * Math.sin(r),
      this.player.y - 48 * Math.cos(r),
      'iceRocket'
    );
    if (!ice) return;
    ice.setVelocityY(-ROCKET_SPEED).setDepth(9);
    audioManager.sfxIceLaunch();
  }

  fireZapRocket() {
    if (this.scene.gameOver) return;
    this.scene.touchControls.hideSubRocketButtons();
    const r = this.player.rotation;
    const zap = this.zapRockets.create(
      this.player.x - 48 * Math.sin(r),
      this.player.y - 48 * Math.cos(r),
      'zapRocket'
    );
    if (!zap) return;
    zap.setVelocityY(-ROCKET_SPEED).setDepth(9);
    audioManager.sfxZapLaunch();
  }

  firePoisonRocket() {
    if (this.scene.gameOver) return;
    this.scene.touchControls.hideSubRocketButtons();
    const r = this.player.rotation;
    const poison = this.poisonRockets.create(
      this.player.x - 48 * Math.sin(r),
      this.player.y - 48 * Math.cos(r),
      'poisonRocket'
    );
    if (!poison) return;
    poison.setVelocityY(-ROCKET_SPEED).setDepth(9);
    audioManager.sfxPoisonLaunch();
  }

  updateCooldown(delta) {
    if (this.rocketReady) return;
    this.rocketCooldownRemaining -= delta;
    if (this.rocketCooldownRemaining <= 0) {
      this.rocketReady             = true;
      this.rocketCooldownRemaining = 0;
      this.scene.touchControls.onRocketReady();
    } else {
      this.scene.touchControls.updateCooldownText(this.rocketCooldownRemaining);
    }
  }
}

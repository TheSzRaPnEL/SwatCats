import { audioManager } from '../audio/AudioManager.js';
import { PLAYER_SPEED } from '../constants/gameConstants.js';
import { TextureFactory  } from '../components/TextureFactory.js';
import { Background      } from '../components/Background.js';
import { HUD             } from '../components/HUD.js';
import { TouchControls   } from '../components/TouchControls.js';
import { ThrusterRenderer } from '../components/ThrusterRenderer.js';
import { WeaponSystem    } from '../components/WeaponSystem.js';
import { EnemyManager    } from '../components/EnemyManager.js';
import { EffectsManager  } from '../components/EffectsManager.js';
import { BossController  } from '../components/BossController.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // ─────────────────────────────────────────────
  //  LIFECYCLE
  // ─────────────────────────────────────────────

  create() {
    const { width, height } = this.scale;
    this.W = width;
    this.H = height;

    audioManager.resume();
    this._initState();
    this._createComponents();
    this._createPhysicsGroups();
    this._createPlayer();
    this._initComponentSystems();
    this._setupCollisions();
    this._setupTimers();
  }

  _initState() {
    this.score      = 0;
    this.playerHealth = 100;
    this.isFiring   = false;
    this.gameOver   = false;
    this.wave       = 1;
    this.killCount  = 0;
    this.moveX      = 0;
    this.moveY      = 0;
    this.boss       = null;
    this.bossActive = false;
  }

  _createComponents() {
    new TextureFactory(this).createAll();

    this.background      = new Background(this);
    this.hud             = new HUD(this);
    this.touchControls   = new TouchControls(this);
    this.thrusterRenderer = new ThrusterRenderer(this);
    this.weaponSystem    = new WeaponSystem(this);
    this.enemyManager    = new EnemyManager(this);
    this.effectsManager  = new EffectsManager(this);
    this.bossController  = new BossController(this);

    this.background.create();
    this.hud.create();
  }

  _createPhysicsGroups() {
    this.bullets       = this.physics.add.group();
    this.rockets       = this.physics.add.group();
    this.iceRockets    = this.physics.add.group();
    this.zapRockets    = this.physics.add.group();
    this.poisonRockets = this.physics.add.group();
    this.enemies       = this.physics.add.group();
    this.enemyBullets  = this.physics.add.group();
    this.bossGroup     = this.physics.add.group();
  }

  _createPlayer() {
    this.player = this.physics.add.sprite(this.W / 2, this.H * 0.78, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.body.setSize(22, 68).setOffset(29, 16);
    this.player.setScale(0.9);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd    = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
  }

  _initComponentSystems() {
    this.weaponSystem.init(
      this.player, this.bullets, this.rockets, this.iceRockets, this.zapRockets, this.poisonRockets
    );
    this.thrusterRenderer; // graphics already constructed
    this.touchControls.create(
      () => this.weaponSystem.fireRocket(),
      () => this.weaponSystem.fireIceRocket(),
      () => this.weaponSystem.fireZapRocket(),
      () => this.weaponSystem.firePoisonRocket()
    );
  }

  _setupCollisions() {
    // Player weapons vs enemies
    this.physics.add.overlap(this.bullets,       this.enemies,   this._onBulletHitEnemy,   null, this);
    this.physics.add.overlap(this.rockets,       this.enemies,   this._onRocketHitEnemy,   null, this);
    this.physics.add.overlap(this.iceRockets,    this.enemies,   this._onIceRocketHit,     null, this);
    this.physics.add.overlap(this.zapRockets,    this.enemies,   this._onZapRocketHit,     null, this);
    this.physics.add.overlap(this.poisonRockets, this.enemies,   this._onPoisonRocketHit,  null, this);
    // Enemy attacks vs player
    this.physics.add.overlap(this.enemyBullets,  this.player,    this._onEnemyBulletHit,   null, this);
    this.physics.add.overlap(this.enemies,        this.player,    this._onEnemyCollide,      null, this);
    // Player weapons vs boss
    this.physics.add.overlap(this.bullets,       this.bossGroup, this._onBulletHitBoss,    null, this);
    this.physics.add.overlap(this.rockets,       this.bossGroup, this._onRocketHitBoss,    null, this);
    this.physics.add.overlap(this.iceRockets,    this.bossGroup, this._onIceHitBoss,       null, this);
    this.physics.add.overlap(this.zapRockets,    this.bossGroup, this._onZapHitBoss,       null, this);
    this.physics.add.overlap(this.poisonRockets, this.bossGroup, this._onPoisonHitBoss,    null, this);
    // Boss body vs player
    this.physics.add.overlap(this.bossGroup,    this.player,    this._onBossCollide,     null, this);
  }

  _setupTimers() {
    this.enemySpawnEvent = this.time.addEvent({
      delay: this.enemyManager.spawnDelay(),
      callback: this.enemyManager.spawnEnemy,
      callbackScope: this.enemyManager,
      loop: true,
    });
    this.enemyFireEvent = this.time.addEvent({
      delay: this.enemyManager.enemyFireDelay(),
      callback: this.enemyManager.enemiesShoot,
      callbackScope: this.enemyManager,
      loop: true,
    });
    this.waveEvent = this.time.addEvent({
      delay: 20000, callback: this._endWave, callbackScope: this, loop: true,
    });
  }

  update(time, delta) {
    if (this.gameOver) return;
    this.background.scroll(delta);
    this._handleMovement();
    this.thrusterRenderer.update(this.player, this.moveX, this.moveY);
    this.weaponSystem.handleFiring(time);
    this.weaponSystem.updateCooldown(delta);
    this._updateHUD();
    this._cleanupOffscreen();
  }

  // ─────────────────────────────────────────────
  //  HUD UPDATE
  // ─────────────────────────────────────────────

  _updateHUD() {
    this.hud.updateScore(this.score);
    this.hud.updateHealth(this.playerHealth);
    this.hud.updateRocketStatus(
      this.weaponSystem.rocketReady,
      this.weaponSystem.rocketCooldownRemaining
    );
  }

  // ─────────────────────────────────────────────
  //  MOVEMENT
  // ─────────────────────────────────────────────

  _handleMovement() {
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  vx = -1;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) vx = 1;
    if (this.cursors.up.isDown    || this.wasd.up.isDown)   vy = -1;
    else if (this.cursors.down.isDown  || this.wasd.down.isDown)  vy = 1;
    if (this.touchControls.joy.active) {
      vx = this.touchControls.joy.dx;
      vy = this.touchControls.joy.dy;
    }
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
    this.moveX = vx;
    this.moveY = vy;
    this.player.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);
    this.player.angle = Phaser.Math.Linear(this.player.angle, vx * 18, 0.15);
  }

  // ─────────────────────────────────────────────
  //  WAVE / BOSS FLOW
  // ─────────────────────────────────────────────

  _endWave() {
    if (this.gameOver || this.bossActive) return;
    this.enemySpawnEvent.paused = true;
    this.bossActive = true;
    this.bossController.spawnBoss();
  }

  advanceWave() {
    this.wave++;
    this.hud.updateWave(this.wave);
    audioManager.sfxWaveComplete();
    this.playerHealth = Math.min(100, this.playerHealth + 20);
    this.enemySpawnEvent.delay  = this.enemyManager.spawnDelay();
    this.enemySpawnEvent.paused = false;
    this.enemyFireEvent.delay   = this.enemyManager.enemyFireDelay();

    const { width, height } = this.scale;
    const txt = this.add.text(width / 2, height / 2, 'WAVE ' + this.wave, {
      fontSize: '48px', fontFamily: 'Arial Black, sans-serif',
      color: '#ffcc00', stroke: '#664400', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(60).setAlpha(0);
    this.tweens.add({
      targets: txt, alpha: { from: 0, to: 1 }, duration: 300,
      yoyo: true, hold: 800, onComplete: () => txt.destroy(),
    });
  }

  // ─────────────────────────────────────────────
  //  COLLISION HANDLERS — ENEMIES
  // ─────────────────────────────────────────────

  _onBulletHitEnemy(bullet, enemy) {
    bullet.destroy();
    this.effectsManager.flashEnemy(enemy);
    enemy.health--;
    if (enemy.health <= 0) this.effectsManager.killEnemy(enemy);
  }

  _onRocketHitEnemy(rocket, enemy) {
    this.effectsManager.triggerRocketExplosion(rocket.x, rocket.y);
    rocket.destroy();
  }

  _onIceRocketHit(iceRocket, _enemy) {
    this.effectsManager.triggerIceExplosion(iceRocket.x, iceRocket.y);
    iceRocket.destroy();
  }

  _onZapRocketHit(zapRocket, _enemy) {
    this.effectsManager.triggerZapChain(zapRocket.x, zapRocket.y);
    zapRocket.destroy();
  }

  _onPoisonRocketHit(poisonRocket, _enemy) {
    this.effectsManager.triggerPoisonExplosion(poisonRocket.x, poisonRocket.y);
    poisonRocket.destroy();
  }

  _onEnemyBulletHit(_player, bullet) {
    bullet.destroy();
    this.damagePlayer(8);
  }

  _onEnemyCollide(_player, enemy) {
    enemy.destroy();
    this.damagePlayer(20);
    this.cameras.main.shake(200, 0.012);
  }

  // ─────────────────────────────────────────────
  //  COLLISION HANDLERS — BOSS
  // ─────────────────────────────────────────────

  _onBulletHitBoss(bullet, _boss) {
    this.bossController.onBulletHitBoss(bullet);
  }

  _onRocketHitBoss(rocket, _boss) {
    this.bossController.onRocketHitBoss(rocket);
  }

  _onIceHitBoss(iceRocket, _boss) {
    this.bossController.onIceHitBoss(iceRocket);
  }

  _onZapHitBoss(zapRocket, _boss) {
    this.bossController.onZapHitBoss(zapRocket);
  }

  _onPoisonHitBoss(poisonRocket, _boss) {
    this.bossController.onPoisonHitBoss(poisonRocket);
  }

  _onBossCollide(_player, _boss) {
    this.damagePlayer(25);
    this.cameras.main.shake(250, 0.018);
  }

  // ─────────────────────────────────────────────
  //  PLAYER DAMAGE / GAME OVER
  // ─────────────────────────────────────────────

  damagePlayer(amount) {
    this.playerHealth -= amount;
    this.cameras.main.flash(80, 255, 0, 0, true);
    audioManager.sfxPlayerHit();
    if (this.playerHealth <= 0) {
      this.playerHealth = 0;
      this._triggerGameOver();
    }
  }

  _triggerGameOver() {
    this.gameOver = true;
    audioManager.sfxPlayerDie();
    this.player.setVelocity(0, 0).setTint(0xff2200);
    this.thrusterRenderer.clear();
    this.enemySpawnEvent.remove();
    this.enemyFireEvent.remove();
    this.bossController.stopTimers();
    this.touchControls.hideSubRocketButtons();

    const exp = this.add.circle(this.player.x, this.player.y, 8, 0xff8800, 1).setDepth(20);
    this.tweens.add({ targets: exp, radius: 90, alpha: 0, duration: 700, onComplete: () => exp.destroy() });
    this.cameras.main.shake(600, 0.022);
    this.time.delayedCall(900, () => this._showGameOverUI());
  }

  _showGameOverUI() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, 340, 220, 0x000000, 0.88).setDepth(50);
    this.add.text(width / 2, height / 2 - 65, 'GAME OVER', {
      fontSize: '40px', fontFamily: 'Arial Black, sans-serif',
      color: '#ff2200', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(51);
    this.add.text(width / 2, height / 2 - 10, `SCORE: ${this.score}`, {
      fontSize: '26px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
    }).setOrigin(0.5).setDepth(51);
    this.add.text(width / 2, height / 2 + 28, `WAVE: ${this.wave}`, {
      fontSize: '20px', fontFamily: 'Arial, sans-serif', color: '#ffcc00',
    }).setOrigin(0.5).setDepth(51);
    const restartBtn = this.add.text(width / 2, height / 2 + 75, '[ PLAY AGAIN ]', {
      fontSize: '24px', fontFamily: 'Arial Black, sans-serif',
      color: '#ffcc00', stroke: '#664400', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(51).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: restartBtn, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    restartBtn.on('pointerdown', () => this.scene.restart());
    this.input.keyboard.once('keydown-SPACE', () => this.scene.restart());
    this.input.keyboard.once('keydown-ENTER', () => this.scene.restart());
  }

  // ─────────────────────────────────────────────
  //  CLEANUP
  // ─────────────────────────────────────────────

  _cleanupOffscreen() {
    const margin = 80;
    [this.bullets, this.rockets, this.enemies, this.enemyBullets].forEach(group => {
      group.getChildren().forEach(obj => {
        if (obj.y > this.H + margin || obj.y < -margin || obj.x < -margin || obj.x > this.W + margin)
          obj.destroy();
      });
    });
    this._cleanupSpecialRockets(margin);
  }

  _cleanupSpecialRockets(margin) {
    this.iceRockets.getChildren().forEach(obj => {
      if (obj.y > this.H + margin || obj.y < -margin || obj.x < -margin || obj.x > this.W + margin) {
        this.effectsManager.triggerIceExplosion(obj.x, Math.max(obj.y, 20));
        obj.destroy();
      }
    });
    this.zapRockets.getChildren().forEach(obj => {
      if (obj.y > this.H + margin || obj.y < -margin || obj.x < -margin || obj.x > this.W + margin) {
        this.effectsManager.triggerZapChain(obj.x, Math.max(obj.y, 20));
        obj.destroy();
      }
    });
    this.poisonRockets.getChildren().forEach(obj => {
      if (obj.y > this.H + margin || obj.y < -margin || obj.x < -margin || obj.x > this.W + margin) {
        this.effectsManager.triggerPoisonExplosion(obj.x, Math.max(obj.y, 20));
        obj.destroy();
      }
    });
  }
}

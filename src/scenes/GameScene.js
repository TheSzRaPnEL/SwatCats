const PLAYER_SPEED = 280;
const BULLET_SPEED = 620;
const FIRE_RATE_MS = 130;
const ROCKET_SPEED = 420;
const ROCKET_COOLDOWN_MS = 5000;
const ROCKET_AOE_RADIUS = 110;
const ENEMY_HEALTH = 2;

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

    // State
    this.score = 0;
    this.playerHealth = 100;
    this.isFiring = false;
    this.rocketReady = true;
    this.rocketCooldownRemaining = 0;
    this.lastFired = 0;
    this.gameOver = false;
    this.wave = 1;
    this.killCount = 0;

    this.createBackground();
    this.createTextures();

    // Physics groups
    this.bullets      = this.physics.add.group();
    this.rockets      = this.physics.add.group();
    this.enemies      = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();

    // Player
    this.player = this.physics.add.sprite(width / 2, height * 0.78, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);

    // Keyboard
    this.cursors  = this.input.keyboard.createCursorKeys();
    this.wasd     = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.fireKey   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.rocketKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    // Collisions
    this.physics.add.overlap(this.bullets,      this.enemies,      this.onBulletHitEnemy,  null, this);
    this.physics.add.overlap(this.rockets,      this.enemies,      this.onRocketHitEnemy,  null, this);
    this.physics.add.overlap(this.enemyBullets, this.player,       this.onEnemyBulletHit,  null, this);
    this.physics.add.overlap(this.enemies,      this.player,       this.onEnemyCollide,    null, this);

    // Timers
    this.enemySpawnEvent = this.time.addEvent({
      delay: this.spawnDelay(),
      callback: this.spawnEnemy,
      callbackScope: this,
      loop: true,
    });

    this.enemyFireEvent = this.time.addEvent({
      delay: 2200,
      callback: this.enemiesShoot,
      callbackScope: this,
      loop: true,
    });

    this.waveEvent = this.time.addEvent({
      delay: 20000,
      callback: this.nextWave,
      callbackScope: this,
      loop: true,
    });

    this.createUI();
    this.createTouchControls();
  }

  update(time, delta) {
    if (this.gameOver) return;

    this.scrollBackground(delta);
    this.handleMovement();
    this.handleFiring(time);
    this.updateRocketCooldown(delta);
    this.updateHUD();
    this.cleanupOffscreen();
  }

  // ─────────────────────────────────────────────
  //  BACKGROUND
  // ─────────────────────────────────────────────

  createBackground() {
    this.add.rectangle(0, 0, this.W, this.H, 0x050520).setOrigin(0, 0);

    // Three star layers with different speeds
    this.starLayers = [0.4, 0.8, 1.4].map((speed, idx) => {
      const count = 25 + idx * 15;
      const stars = Array.from({ length: count }, () => ({
        x: Phaser.Math.Between(0, this.W),
        y: Phaser.Math.Between(0, this.H),
        r: 0.4 + idx * 0.5,
      }));
      const gfx = this.add.graphics().setDepth(0);
      return { gfx, stars, speed };
    });

    this.drawStarLayers();
  }

  drawStarLayers() {
    this.starLayers.forEach(({ gfx, stars, speed }) => {
      gfx.clear();
      const alpha = 0.4 + speed * 0.2;
      gfx.fillStyle(0xffffff, Math.min(alpha, 1));
      stars.forEach(s => gfx.fillCircle(s.x, s.y, s.r));
    });
  }

  scrollBackground(delta) {
    const dt = delta / 16.67;
    this.starLayers.forEach(layer => {
      layer.stars.forEach(s => {
        s.y += layer.speed * dt;
        if (s.y > this.H + 2) {
          s.y = -2;
          s.x = Phaser.Math.Between(0, this.W);
        }
      });
    });
    this.drawStarLayers();
  }

  // ─────────────────────────────────────────────
  //  TEXTURES (procedural)
  // ─────────────────────────────────────────────

  createTextures() {
    this.makePlayerTexture();
    this.makeEnemyTexture();
    this.makeBulletTexture();
    this.makeEnemyBulletTexture();
    this.makeRocketTexture();
  }

  makePlayerTexture() {
    if (this.textures.exists('player')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // Fuselage
    g.fillStyle(0x0088dd);
    g.fillTriangle(20, 0, 10, 38, 30, 38);
    // Wings
    g.fillStyle(0x006699);
    g.fillTriangle(20, 18, 0, 44, 40, 44);
    // Tail fins
    g.fillStyle(0x004477);
    g.fillTriangle(14, 32, 4, 48, 18, 38);
    g.fillTriangle(26, 32, 36, 48, 22, 38);
    // Engine glow
    g.fillStyle(0x00ccff, 0.9);
    g.fillRect(17, 36, 6, 6);
    // Cockpit
    g.fillStyle(0xaaeeff);
    g.fillEllipse(20, 14, 8, 10);
    g.generateTexture('player', 40, 48);
    g.destroy();
  }

  makeEnemyTexture() {
    if (this.textures.exists('enemy')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // Fuselage (pointing DOWN)
    g.fillStyle(0xdd2200);
    g.fillTriangle(20, 48, 10, 10, 30, 10);
    // Wings
    g.fillStyle(0xaa1100);
    g.fillTriangle(20, 30, 0, 4, 40, 4);
    // Tail fins
    g.fillStyle(0x881100);
    g.fillTriangle(14, 16, 4, 0, 18, 10);
    g.fillTriangle(26, 16, 36, 0, 22, 10);
    // Engine glow
    g.fillStyle(0xff4400, 0.9);
    g.fillRect(17, 6, 6, 6);
    // Cockpit
    g.fillStyle(0xff9966);
    g.fillEllipse(20, 34, 8, 10);
    g.generateTexture('enemy', 40, 48);
    g.destroy();
  }

  makeBulletTexture() {
    if (this.textures.exists('bullet')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffff44);
    g.fillRect(2, 0, 4, 14);
    g.fillStyle(0xffffff);
    g.fillRect(3, 0, 2, 5);
    g.generateTexture('bullet', 8, 14);
    g.destroy();
  }

  makeEnemyBulletTexture() {
    if (this.textures.exists('ebullet')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xff5500);
    g.fillRect(2, 0, 4, 14);
    g.fillStyle(0xff9900);
    g.fillRect(3, 0, 2, 4);
    g.generateTexture('ebullet', 8, 14);
    g.destroy();
  }

  makeRocketTexture() {
    if (this.textures.exists('rocket')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // Body
    g.fillStyle(0xdd6600);
    g.fillRect(5, 6, 10, 20);
    // Nose cone
    g.fillStyle(0xffaa00);
    g.fillTriangle(10, 0, 5, 8, 15, 8);
    // Fins
    g.fillStyle(0xff4400);
    g.fillTriangle(5, 20, 0, 28, 7, 22);
    g.fillTriangle(15, 20, 20, 28, 13, 22);
    // Exhaust
    g.fillStyle(0xffcc44, 0.8);
    g.fillRect(7, 26, 6, 5);
    g.generateTexture('rocket', 20, 32);
    g.destroy();
  }

  // ─────────────────────────────────────────────
  //  HUD
  // ─────────────────────────────────────────────

  createUI() {
    const { width } = this.scale;
    const depth = 100;

    // Score
    this.scoreTxt = this.add.text(10, 10, 'SCORE: 0', {
      fontSize: '18px', fontFamily: 'Arial Black, sans-serif', color: '#ffffff',
    }).setDepth(depth);

    // Wave
    this.waveTxt = this.add.text(width - 10, 10, 'WAVE 1', {
      fontSize: '18px', fontFamily: 'Arial Black, sans-serif', color: '#ffcc00',
    }).setOrigin(1, 0).setDepth(depth);

    // Health bar
    this.add.text(10, 36, 'HP', {
      fontSize: '13px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa',
    }).setDepth(depth);

    this.healthBarBg = this.add.rectangle(36, 43, 160, 12, 0x330000).setOrigin(0, 0.5).setDepth(depth);
    this.healthBar   = this.add.rectangle(36, 43, 160, 12, 0x00ee44).setOrigin(0, 0.5).setDepth(depth + 1);

    // Rocket cooldown (top right, below wave)
    this.rocketStatusTxt = this.add.text(width - 10, 34, 'ROCKET: READY', {
      fontSize: '13px', fontFamily: 'Arial Black, sans-serif', color: '#ff8800',
    }).setOrigin(1, 0).setDepth(depth);
  }

  updateHUD() {
    this.scoreTxt.setText('SCORE: ' + this.score);

    const pct = this.playerHealth / 100;
    this.healthBar.setDisplaySize(Math.max(2, 160 * pct), 12);
    const col = pct > 0.5 ? 0x00ee44 : pct > 0.25 ? 0xffaa00 : 0xff2200;
    this.healthBar.setFillStyle(col);

    if (this.rocketReady) {
      this.rocketStatusTxt.setText('ROCKET: READY').setColor('#ff8800');
    } else {
      const secs = Math.ceil(this.rocketCooldownRemaining / 1000);
      this.rocketStatusTxt.setText(`ROCKET: ${secs}s`).setColor('#555555');
    }
  }

  // ─────────────────────────────────────────────
  //  TOUCH CONTROLS
  // ─────────────────────────────────────────────

  createTouchControls() {
    const { width, height } = this.scale;

    // ── FIRE button ─────────────────────────────
    const fireBtnX = width - 65;
    const fireBtnY = height - 80;

    this.fireBtnBg = this.add.rectangle(fireBtnX, fireBtnY, 115, 65, 0x003366, 0.88)
      .setDepth(200)
      .setInteractive()
      .setStrokeStyle(2, 0x00aaff);

    this.add.text(fireBtnX, fireBtnY, 'FIRE', {
      fontSize: '24px', fontFamily: 'Arial Black, sans-serif', color: '#00ddff',
    }).setOrigin(0.5).setDepth(201);

    this.fireBtnBg.on('pointerdown', () => { this.isFiring = true;  });
    this.fireBtnBg.on('pointerup',   () => { this.isFiring = false; });
    this.fireBtnBg.on('pointerout',  () => { this.isFiring = false; });

    // ── ROCKET button ────────────────────────────
    const rocketBtnX = width - 65;
    const rocketBtnY = height - 165;

    this.rocketBtnBg = this.add.rectangle(rocketBtnX, rocketBtnY, 115, 65, 0x884400, 0.88)
      .setDepth(200)
      .setInteractive()
      .setStrokeStyle(2, 0xff8800);

    this.rocketBtnLabel = this.add.text(rocketBtnX, rocketBtnY - 6, 'ROCKET', {
      fontSize: '20px', fontFamily: 'Arial Black, sans-serif', color: '#ffaa00',
    }).setOrigin(0.5).setDepth(201);

    this.rocketCDOverlay = this.add.rectangle(rocketBtnX, rocketBtnY, 115, 65, 0x000000, 0.55)
      .setDepth(202)
      .setVisible(false);

    this.rocketCDTimerTxt = this.add.text(rocketBtnX, rocketBtnY + 6, '', {
      fontSize: '22px', fontFamily: 'Arial Black, sans-serif', color: '#ffffff',
    }).setOrigin(0.5).setDepth(203);

    this.rocketBtnBg.on('pointerdown', () => this.fireRocket());

    // ── Virtual Joystick ─────────────────────────
    const joyX = 72;
    const joyY = height - 110;

    this.joy = {
      baseX: joyX, baseY: joyY,
      dx: 0, dy: 0,
      active: false,
      pointerId: null,
    };

    this.joyBase  = this.add.circle(joyX, joyY, 52, 0x001133, 0.65).setDepth(200);
    this.joyThumb = this.add.circle(joyX, joyY, 22, 0x0055aa, 0.9).setDepth(201);

    this.input.on('pointerdown', (ptr) => {
      if (ptr.x < this.W / 2 && !this.joy.active) {
        this.joy.active    = true;
        this.joy.pointerId = ptr.id;
        this.joy.baseX     = ptr.x;
        this.joy.baseY     = ptr.y;
        this.joyBase.setPosition(ptr.x, ptr.y);
        this.joyThumb.setPosition(ptr.x, ptr.y);
      }
    });

    this.input.on('pointermove', (ptr) => {
      if (!this.joy.active || ptr.id !== this.joy.pointerId) return;
      const dx   = ptr.x - this.joy.baseX;
      const dy   = ptr.y - this.joy.baseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const max  = 42;
      if (dist === 0) return;
      const clamp   = Math.min(dist, max);
      const angle   = Math.atan2(dy, dx);
      const thumbX  = this.joy.baseX + Math.cos(angle) * clamp;
      const thumbY  = this.joy.baseY + Math.sin(angle) * clamp;
      this.joyThumb.setPosition(thumbX, thumbY);
      this.joy.dx = (dx / dist) * Math.min(1, dist / max);
      this.joy.dy = (dy / dist) * Math.min(1, dist / max);
    });

    this.input.on('pointerup', (ptr) => {
      if (ptr.id === this.joy.pointerId) {
        this.joy.active    = false;
        this.joy.pointerId = null;
        this.joy.dx        = 0;
        this.joy.dy        = 0;
        this.joyThumb.setPosition(this.joy.baseX, this.joy.baseY);
      }
    });
  }

  // ─────────────────────────────────────────────
  //  MOVEMENT
  // ─────────────────────────────────────────────

  handleMovement() {
    let vx = 0, vy = 0;

    // Keyboard input
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  vx = -1;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) vx =  1;

    if (this.cursors.up.isDown   || this.wasd.up.isDown)   vy = -1;
    else if (this.cursors.down.isDown  || this.wasd.down.isDown)  vy =  1;

    // Joystick overrides keyboard
    if (this.joy.active) {
      vx = this.joy.dx;
      vy = this.joy.dy;
    }

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

    this.player.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);

    // Visual tilt based on horizontal movement
    const targetAngle = vx * 18;
    this.player.angle = Phaser.Math.Linear(this.player.angle, targetAngle, 0.15);
  }

  // ─────────────────────────────────────────────
  //  WEAPONS
  // ─────────────────────────────────────────────

  handleFiring(time) {
    if (this.isFiring || this.fireKey.isDown) {
      if (time > this.lastFired + FIRE_RATE_MS) {
        this.lastFired = time;
        this.shootBullet();
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.rocketKey)) {
      this.fireRocket();
    }
  }

  shootBullet() {
    const b = this.bullets.create(this.player.x, this.player.y - 26, 'bullet');
    if (!b) return;
    b.setVelocityY(-BULLET_SPEED);
    b.setDepth(9);
    b.body.setSize(4, 14);
  }

  fireRocket() {
    if (!this.rocketReady || this.gameOver) return;

    const r = this.rockets.create(this.player.x, this.player.y - 28, 'rocket');
    if (!r) return;
    r.setVelocityY(-ROCKET_SPEED);
    r.setDepth(9);

    // Start 5s cooldown
    this.rocketReady              = false;
    this.rocketCooldownRemaining  = ROCKET_COOLDOWN_MS;
    this.rocketCDOverlay.setVisible(true);
    this.rocketBtnBg.setFillStyle(0x221100, 0.88);
  }

  updateRocketCooldown(delta) {
    if (this.rocketReady) return;

    this.rocketCooldownRemaining -= delta;

    if (this.rocketCooldownRemaining <= 0) {
      this.rocketReady             = true;
      this.rocketCooldownRemaining = 0;
      this.rocketCDOverlay.setVisible(false);
      this.rocketCDTimerTxt.setText('');
      this.rocketBtnBg.setFillStyle(0x884400, 0.88);

      // Flash to signal ready
      this.tweens.add({
        targets: this.rocketBtnBg,
        alpha: 0.3,
        duration: 150,
        yoyo: true,
        repeat: 3,
        onComplete: () => this.rocketBtnBg.setAlpha(1),
      });
    } else {
      const secs = Math.ceil(this.rocketCooldownRemaining / 1000);
      this.rocketCDTimerTxt.setText(secs + 's');
    }
  }

  // ─────────────────────────────────────────────
  //  ENEMIES
  // ─────────────────────────────────────────────

  spawnDelay() {
    return Math.max(600, 1600 - (this.wave - 1) * 120);
  }

  spawnEnemy() {
    if (this.gameOver) return;

    const x     = Phaser.Math.Between(24, this.W - 24);
    const enemy = this.enemies.create(x, -32, 'enemy');
    if (!enemy) return;
    enemy.setDepth(8);
    enemy.health = ENEMY_HEALTH + Math.floor((this.wave - 1) / 3);

    const pattern = Phaser.Math.Between(0, 2);
    const baseVY  = Phaser.Math.Between(100, 160) + (this.wave - 1) * 8;

    if (pattern === 0) {
      // Straight
      enemy.setVelocityY(baseVY);
    } else if (pattern === 1) {
      // Diagonal
      const dir = Phaser.Math.Between(0, 1) ? 1 : -1;
      enemy.setVelocityX(dir * Phaser.Math.Between(70, 130));
      enemy.setVelocityY(baseVY);
    } else {
      // Sine wave via tween
      enemy.setVelocityY(baseVY);
      this.tweens.add({
        targets: enemy,
        x: { value: `+=${Phaser.Math.Between(0, 1) ? 120 : -120}`, duration: 1400 },
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    }
  }

  enemiesShoot() {
    if (this.gameOver) return;
    this.enemies.getChildren().forEach(enemy => {
      if (!enemy.active) return;
      if (enemy.y < 20 || enemy.y > this.H * 0.75) return;
      const b = this.enemyBullets.create(enemy.x, enemy.y + 26, 'ebullet');
      if (!b) return;
      b.setVelocityY(280 + this.wave * 10);
      b.setDepth(7);
    });
  }

  nextWave() {
    if (this.gameOver) return;
    this.wave++;
    this.waveTxt.setText('WAVE ' + this.wave);

    // Update spawn timer delay
    this.enemySpawnEvent.delay = this.spawnDelay();

    // Wave announcement
    const { width, height } = this.scale;
    const txt = this.add.text(width / 2, height / 2, 'WAVE ' + this.wave, {
      fontSize: '48px', fontFamily: 'Arial Black, sans-serif',
      color: '#ffcc00', stroke: '#664400', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(60).setAlpha(0);

    this.tweens.add({
      targets: txt,
      alpha: { from: 0, to: 1 },
      duration: 300,
      yoyo: true,
      hold: 800,
      onComplete: () => txt.destroy(),
    });
  }

  // ─────────────────────────────────────────────
  //  COLLISION HANDLERS
  // ─────────────────────────────────────────────

  onBulletHitEnemy(bullet, enemy) {
    bullet.destroy();
    this.flashEnemy(enemy);
    enemy.health--;
    if (enemy.health <= 0) this.killEnemy(enemy);
  }

  onRocketHitEnemy(rocket, enemy) {
    this.triggerRocketExplosion(rocket.x, rocket.y);
    rocket.destroy();
  }

  onEnemyBulletHit(player, bullet) {
    bullet.destroy();
    this.damagePlayer(8);
  }

  onEnemyCollide(player, enemy) {
    enemy.destroy();
    this.damagePlayer(20);
    this.cameras.main.shake(200, 0.012);
  }

  // ─────────────────────────────────────────────
  //  EFFECTS
  // ─────────────────────────────────────────────

  flashEnemy(enemy) {
    this.tweens.add({
      targets: enemy,
      alpha: 0.2,
      duration: 40,
      yoyo: true,
    });
  }

  killEnemy(enemy) {
    this.score      += 10 * this.wave;
    this.killCount  += 1;

    const exp = this.add.circle(enemy.x, enemy.y, 6, 0xff5500, 1).setDepth(15);
    this.tweens.add({
      targets: exp,
      radius: 28,
      alpha: 0,
      duration: 280,
      onComplete: () => exp.destroy(),
    });

    enemy.destroy();
  }

  triggerRocketExplosion(x, y) {
    // Outer ring
    const outer = this.add.circle(x, y, 8, 0xff6600, 0.9).setDepth(15);
    this.tweens.add({
      targets: outer,
      radius: ROCKET_AOE_RADIUS,
      alpha: 0,
      duration: 420,
      onComplete: () => outer.destroy(),
    });

    // Inner flash
    const inner = this.add.circle(x, y, 6, 0xffee44, 1).setDepth(16);
    this.tweens.add({
      targets: inner,
      radius: ROCKET_AOE_RADIUS * 0.55,
      alpha: 0,
      duration: 280,
      onComplete: () => inner.destroy(),
    });

    // AOE damage
    this.enemies.getChildren().forEach(enemy => {
      if (!enemy.active) return;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist <= ROCKET_AOE_RADIUS) {
        this.killEnemy(enemy);
      }
    });

    this.cameras.main.shake(320, 0.014);
    this.score += 5 * this.wave; // bonus for rocket use
  }

  damagePlayer(amount) {
    this.playerHealth -= amount;
    this.cameras.main.flash(80, 255, 0, 0, true);
    if (this.playerHealth <= 0) {
      this.playerHealth = 0;
      this.triggerGameOver();
    }
  }

  // ─────────────────────────────────────────────
  //  GAME OVER
  // ─────────────────────────────────────────────

  triggerGameOver() {
    this.gameOver = true;
    this.player.setVelocity(0, 0);
    this.player.setTint(0xff2200);
    this.enemySpawnEvent.remove();
    this.enemyFireEvent.remove();

    // Player explosion
    const exp = this.add.circle(this.player.x, this.player.y, 8, 0xff8800, 1).setDepth(20);
    this.tweens.add({
      targets: exp,
      radius: 90,
      alpha: 0,
      duration: 700,
      onComplete: () => exp.destroy(),
    });
    this.cameras.main.shake(600, 0.022);

    const { width, height } = this.scale;

    this.time.delayedCall(900, () => {
      // Overlay panel
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

      this.tweens.add({
        targets: restartBtn,
        alpha: 0.2,
        duration: 600,
        yoyo: true,
        repeat: -1,
      });

      restartBtn.on('pointerdown', () => this.scene.restart());
      this.input.keyboard.once('keydown-SPACE', () => this.scene.restart());
      this.input.keyboard.once('keydown-ENTER', () => this.scene.restart());
    });
  }

  // ─────────────────────────────────────────────
  //  CLEANUP
  // ─────────────────────────────────────────────

  cleanupOffscreen() {
    const margin = 80;
    const groups = [this.bullets, this.rockets, this.enemies, this.enemyBullets];
    groups.forEach(group => {
      group.getChildren().forEach(obj => {
        if (
          obj.y > this.H + margin ||
          obj.y < -margin ||
          obj.x < -margin ||
          obj.x > this.W + margin
        ) {
          obj.destroy();
        }
      });
    });
  }
}

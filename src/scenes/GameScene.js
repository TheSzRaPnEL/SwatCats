const PLAYER_SPEED = 280;
const BULLET_SPEED = 620;
const FIRE_RATE_MS = 130;
const ROCKET_SPEED = 420;
const ROCKET_COOLDOWN_MS = 5000;
const ROCKET_AOE_RADIUS = 110;
const ENEMY_HEALTH = 2;

// Sprite dimensions
const PLAYER_W = 80;
const PLAYER_H = 100;

// Sub-rocket constants
const SUB_ROCKET_WINDOW  = 5000;   // ms ICE/ZAP buttons stay visible after ROCKET
const ICE_AOE_RADIUS     = 380;    // huge — covers most screen
const ICE_DAMAGE         = 1;      // 50% of base enemy HP (2)
const ICE_SLOW_FACTOR    = 0.2;    // slow to 20% speed
const ICE_SLOW_DURATION  = 5000;   // 5 s
const ZAP_DAMAGE         = 1;      // 50% of base enemy HP per hit
const ZAP_HITS           = 4;      // total chain hits
const ZAP_INTERVAL       = 1000;   // ms between chain hits

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
    this.moveX = 0;
    this.moveY = 0;
    this.subRocketTimer = null; // TimerEvent hiding ICE/ZAP buttons

    this.createBackground();
    this.createTextures();

    // Physics groups
    this.bullets      = this.physics.add.group();
    this.rockets      = this.physics.add.group();
    this.iceRockets   = this.physics.add.group();
    this.zapRockets   = this.physics.add.group();
    this.enemies      = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();

    // Thruster graphics — depth 9, drawn BEHIND player (depth 10)
    this.thrMain  = this.add.graphics().setDepth(9);
    this.thrLeft  = this.add.graphics().setDepth(9);
    this.thrRight = this.add.graphics().setDepth(9);

    // Player
    this.player = this.physics.add.sprite(width / 2, height * 0.78, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.body.setSize(22, 68).setOffset(29, 16);

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
    this.physics.add.overlap(this.bullets,      this.enemies,   this.onBulletHitEnemy,  null, this);
    this.physics.add.overlap(this.rockets,      this.enemies,   this.onRocketHitEnemy,  null, this);
    this.physics.add.overlap(this.iceRockets,   this.enemies,   this.onIceRocketHit,    null, this);
    this.physics.add.overlap(this.zapRockets,   this.enemies,   this.onZapRocketHit,    null, this);
    this.physics.add.overlap(this.enemyBullets, this.player,    this.onEnemyBulletHit,  null, this);
    this.physics.add.overlap(this.enemies,      this.player,    this.onEnemyCollide,    null, this);

    // Timers
    this.enemySpawnEvent = this.time.addEvent({
      delay: this.spawnDelay(), callback: this.spawnEnemy, callbackScope: this, loop: true,
    });
    this.enemyFireEvent = this.time.addEvent({
      delay: 2200, callback: this.enemiesShoot, callbackScope: this, loop: true,
    });
    this.waveEvent = this.time.addEvent({
      delay: 20000, callback: this.nextWave, callbackScope: this, loop: true,
    });

    this.createUI();
    this.createTouchControls();
  }

  update(time, delta) {
    if (this.gameOver) return;

    this.scrollBackground(delta);
    this.handleMovement();
    this.updateThrusters();
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
        if (s.y > this.H + 2) { s.y = -2; s.x = Phaser.Math.Between(0, this.W); }
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
    this.makeIceRocketTexture();
    this.makeZapRocketTexture();
  }

  // TurboCat — F22 top-down 80×100, based on reference images.
  makePlayerTexture() {
    if (this.textures.exists('player')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Main wing silhouette (near-black)
    g.fillStyle(0x0c0c1a);
    g.fillPoints([
      { x: 40, y: 1   }, { x: 44, y: 12  }, { x: 78, y: 64  },
      { x: 58, y: 76  }, { x: 48, y: 87  }, { x: 44, y: 97  },
      { x: 40, y: 100 }, { x: 36, y: 97  }, { x: 32, y: 87  },
      { x: 22, y: 76  }, { x: 2,  y: 64  }, { x: 36, y: 12  },
    ], true);

    // Blue leading edges
    g.fillStyle(0x1144bb);
    g.fillPoints([{ x:44,y:12 },{ x:78,y:64 },{ x:72,y:62 },{ x:46,y:16 }], true);
    g.fillPoints([{ x:36,y:12 },{ x:2, y:64 },{ x:8, y:62 },{ x:34,y:16 }], true);

    // Red wing stripes
    g.fillStyle(0xcc0018);
    g.fillPoints([{ x:46,y:22 },{ x:70,y:58 },{ x:64,y:64 },{ x:50,y:32 }], true);
    g.fillPoints([{ x:34,y:22 },{ x:10,y:58 },{ x:16,y:64 },{ x:30,y:32 }], true);
    g.fillStyle(0xaa0012);
    g.fillPoints([{ x:47,y:34 },{ x:65,y:58 },{ x:61,y:63 },{ x:51,y:42 }], true);
    g.fillPoints([{ x:33,y:34 },{ x:15,y:58 },{ x:19,y:63 },{ x:29,y:42 }], true);

    // Fuselage overlay
    g.fillStyle(0x10101f);
    g.fillPoints([
      { x:40,y:1   },{ x:44,y:12  },{ x:46,y:28  },{ x:46,y:84  },
      { x:44,y:97  },{ x:40,y:100 },{ x:36,y:97  },{ x:34,y:84  },
      { x:34,y:28  },{ x:36,y:12  },
    ], true);

    // Intakes
    g.fillStyle(0x050510);
    g.fillRect(27, 30, 7, 20); g.fillRect(46, 30, 7, 20);
    g.fillStyle(0x181828);
    g.fillRect(28, 31, 5, 18); g.fillRect(47, 31, 5, 18);
    g.fillStyle(0x222244, 0.8);
    g.fillRect(28, 31, 5, 4);  g.fillRect(47, 31, 5, 4);

    // Cockpit
    g.fillStyle(0x0d2888); g.fillEllipse(40, 24, 13, 19);
    g.fillStyle(0x2255cc); g.fillEllipse(39, 21, 6, 9);
    g.fillStyle(0x4477ff, 0.6); g.fillEllipse(38, 19, 3, 5);

    // Cat eyes — amber with vertical slit pupil
    g.fillStyle(0xff7700, 0.3); g.fillEllipse(34,40,13,9); g.fillEllipse(46,40,13,9);
    g.fillStyle(0xffaa00);      g.fillEllipse(34,40,8,6);  g.fillEllipse(46,40,8,6);
    g.fillStyle(0xff6600);      g.fillEllipse(34,40,6,4);  g.fillEllipse(46,40,6,4);
    g.fillStyle(0x000000);      g.fillEllipse(34,40,2,6);  g.fillEllipse(46,40,2,6);
    g.fillStyle(0xffffff);      g.fillCircle(35,39,1);     g.fillCircle(47,39,1);

    // Tail fins
    g.fillStyle(0x0c0c1a);
    g.fillTriangle(34,72,24,96,36,82); g.fillTriangle(46,72,56,96,44,82);
    g.fillStyle(0xcc0018, 0.85);
    g.fillTriangle(34,75,27,93,35,80); g.fillTriangle(46,75,53,93,45,80);

    // Twin engine nozzles
    g.fillStyle(0x1a1a30); g.fillEllipse(33,84,10,12); g.fillEllipse(47,84,10,12);
    g.fillStyle(0x003399); g.fillEllipse(33,84,7,9);   g.fillEllipse(47,84,7,9);
    g.fillStyle(0x0055ee); g.fillEllipse(33,84,4,5);   g.fillEllipse(47,84,4,5);
    g.fillStyle(0x66aaff, 0.7); g.fillEllipse(33,84,2,3); g.fillEllipse(47,84,2,3);

    // Nose tip highlight
    g.fillStyle(0x223399); g.fillTriangle(40,1,38,9,42,9);
    g.fillStyle(0x4466cc, 0.6); g.fillTriangle(40,2,39,7,41,7);

    // Weapons bay seam
    g.fillStyle(0x220011); g.fillRect(38,52,4,24);
    g.fillStyle(0x550022); g.fillRect(39,54,2,20);

    g.generateTexture('player', PLAYER_W, PLAYER_H);
    g.destroy();
  }

  makeEnemyTexture() {
    if (this.textures.exists('enemy')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    g.fillStyle(0x1a0808);
    g.fillPoints([
      { x:24,y:60 },{ x:27,y:50 },{ x:46,y:8  },{ x:34,y:18 },
      { x:28,y:10 },{ x:24,y:4  },{ x:20,y:10 },{ x:14,y:18 },
      { x:2, y:8  },{ x:21,y:50 },
    ], true);
    g.fillStyle(0xcc3300);
    g.fillPoints([{ x:22,y:46 },{ x:6, y:12 },{ x:12,y:10 },{ x:24,y:38 }], true);
    g.fillPoints([{ x:26,y:46 },{ x:42,y:12 },{ x:36,y:10 },{ x:24,y:38 }], true);
    g.fillStyle(0x140404);
    g.fillPoints([
      { x:24,y:60 },{ x:27,y:48 },{ x:28,y:14 },
      { x:24,y:4  },{ x:20,y:14 },{ x:21,y:48 },
    ], true);
    g.fillStyle(0x880000); g.fillEllipse(24,40,10,14);
    g.fillStyle(0xff2200, 0.6); g.fillEllipse(23,38,4,7);
    g.fillStyle(0xff2200, 0.4); g.fillEllipse(20,28,8,5); g.fillEllipse(28,28,8,5);
    g.fillStyle(0xff4400);      g.fillEllipse(20,28,5,4); g.fillEllipse(28,28,5,4);
    g.fillStyle(0x000000);      g.fillCircle(20,28,2);    g.fillCircle(28,28,2);
    g.fillStyle(0x331100); g.fillEllipse(24,8,8,8);
    g.fillStyle(0xaa3300); g.fillEllipse(24,8,5,5);
    g.fillStyle(0xff6600); g.fillEllipse(24,8,2,2);

    g.generateTexture('enemy', 48, 64);
    g.destroy();
  }

  makeBulletTexture() {
    if (this.textures.exists('bullet')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffff44); g.fillRect(2, 0, 4, 14);
    g.fillStyle(0xffffff); g.fillRect(3, 0, 2, 5);
    g.generateTexture('bullet', 8, 14);
    g.destroy();
  }

  makeEnemyBulletTexture() {
    if (this.textures.exists('ebullet')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xff5500); g.fillRect(2, 0, 4, 14);
    g.fillStyle(0xff9900); g.fillRect(3, 0, 2, 4);
    g.generateTexture('ebullet', 8, 14);
    g.destroy();
  }

  makeRocketTexture() {
    if (this.textures.exists('rocket')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xdd6600); g.fillRect(5, 6, 10, 20);
    g.fillStyle(0xffaa00); g.fillTriangle(10, 0, 5, 8, 15, 8);
    g.fillStyle(0xff4400);
    g.fillTriangle(5, 20, 0, 28, 7, 22); g.fillTriangle(15, 20, 20, 28, 13, 22);
    g.fillStyle(0xffcc44, 0.8); g.fillRect(7, 26, 6, 5);
    g.generateTexture('rocket', 20, 32);
    g.destroy();
  }

  // ICE rocket — blue-white, elongated with icy tip
  makeIceRocketTexture() {
    if (this.textures.exists('iceRocket')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // Body — deep blue
    g.fillStyle(0x1155cc); g.fillRect(4, 6, 10, 22);
    // Nose — white-blue
    g.fillStyle(0xaaddff); g.fillTriangle(9, 0, 4, 8, 14, 8);
    // Ice crystal tip
    g.fillStyle(0xffffff); g.fillTriangle(9, 0, 8, 4, 10, 4);
    // Side fins — cyan
    g.fillStyle(0x00ccff);
    g.fillTriangle(4, 20, 0, 30, 6, 24); g.fillTriangle(14, 20, 18, 30, 12, 24);
    // Frost glow at base
    g.fillStyle(0x88eeff, 0.7); g.fillRect(6, 28, 6, 5);
    // Ice fleck details on body
    g.fillStyle(0xaaddff, 0.6); g.fillRect(6, 12, 2, 3); g.fillRect(10, 16, 2, 3);
    g.generateTexture('iceRocket', 18, 34);
    g.destroy();
  }

  // ZAP rocket — yellow-white with electric energy lines
  makeZapRocketTexture() {
    if (this.textures.exists('zapRocket')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // Body — dark yellow
    g.fillStyle(0xcc9900); g.fillRect(4, 6, 10, 22);
    // Nose — bright yellow
    g.fillStyle(0xffee00); g.fillTriangle(9, 0, 4, 8, 14, 8);
    // Electric tip — white
    g.fillStyle(0xffffff); g.fillTriangle(9, 0, 8, 4, 10, 4);
    // Side fins — electric yellow
    g.fillStyle(0xffdd00);
    g.fillTriangle(4, 18, 0, 28, 6, 22); g.fillTriangle(14, 18, 18, 28, 12, 22);
    // Electric glow at base
    g.fillStyle(0xffff88, 0.7); g.fillRect(6, 28, 6, 5);
    // Lightning bolt details
    g.fillStyle(0xffffff, 0.8);
    g.fillTriangle(8, 10, 6, 16, 10, 14); g.fillTriangle(10, 14, 8, 20, 12, 18);
    g.generateTexture('zapRocket', 18, 34);
    g.destroy();
  }

  // ─────────────────────────────────────────────
  //  THRUSTERS
  // ─────────────────────────────────────────────

  // Local → world coordinate transform (Phaser: clockwise positive, Y-down)
  // wx = px + lx*cos(r) + ly*sin(r)
  // wy = py - lx*sin(r) + ly*cos(r)
  _toWorld(px, py, r, lx, ly) {
    return {
      x: px + lx * Math.cos(r) + ly * Math.sin(r),
      y: py - lx * Math.sin(r) + ly * Math.cos(r),
    };
  }

  _toDir(r, lx, ly) {
    return {
      x: lx * Math.cos(r) + ly * Math.sin(r),
      y: -lx * Math.sin(r) + ly * Math.cos(r),
    };
  }

  updateThrusters() {
    const px = this.player.x;
    const py = this.player.y;
    const r  = this.player.rotation;

    this.thrMain.clear();
    this.thrLeft.clear();
    this.thrRight.clear();

    const fwd   = Math.max(0, -this.moveY);
    const right = Math.max(0,  this.moveX);
    const left  = Math.max(0, -this.moveX);

    // Twin main engine flames
    const idleIntensity = 0.22;
    const mainIntensity = Math.max(idleIntensity, fwd);
    const backDir  = this._toDir(r, 0, 1);
    const backPerp = { x: backDir.y, y: -backDir.x };

    for (const engLX of [-7, 7]) {
      const eng     = this._toWorld(px, py, r, engLX, 34);
      const flicker = 0.65 + Math.random() * 0.7;
      const len     = (12 + mainIntensity * 36) * flicker;
      const hw      = (2.5 + mainIntensity * 2.5) * (0.75 + Math.random() * 0.5);
      const tip     = { x: eng.x + backDir.x * len, y: eng.y + backDir.y * len };

      this.thrMain.fillStyle(0xff6600, 0.45 + mainIntensity * 0.4);
      this.thrMain.fillTriangle(
        eng.x - backPerp.x * hw, eng.y - backPerp.y * hw,
        eng.x + backPerp.x * hw, eng.y + backPerp.y * hw,
        tip.x, tip.y
      );
      const coreLen = len * 0.5;
      const coreTip = { x: eng.x + backDir.x * coreLen, y: eng.y + backDir.y * coreLen };
      const coreHW  = hw * 0.38;
      this.thrMain.fillStyle(0xaaddff, 0.7 + mainIntensity * 0.25);
      this.thrMain.fillTriangle(
        eng.x - backPerp.x * coreHW, eng.y - backPerp.y * coreHW,
        eng.x + backPerp.x * coreHW, eng.y + backPerp.y * coreHW,
        coreTip.x, coreTip.y
      );
      this.thrMain.fillStyle(0x4488ff, 0.35 + mainIntensity * 0.3);
      this.thrMain.fillCircle(eng.x, eng.y, 3 + mainIntensity * 2);
    }

    // Left side thruster (fires when moving right)
    if (right > 0.06) {
      const pos  = this._toWorld(px, py, r, -22, -5);
      const dir  = this._toDir(r, -1, 0);
      const perp = { x: dir.y, y: -dir.x };
      const len  = (5 + right * 20) * (0.7 + Math.random() * 0.6);
      const hw   = 1.5 + right * 2.5;
      const tip  = { x: pos.x + dir.x * len, y: pos.y + dir.y * len };
      this.thrLeft.fillStyle(0xff8800, 0.5 + right * 0.4);
      this.thrLeft.fillTriangle(
        pos.x - perp.x * hw, pos.y - perp.y * hw,
        pos.x + perp.x * hw, pos.y + perp.y * hw,
        tip.x, tip.y
      );
      this.thrLeft.fillStyle(0xffffff, 0.55);
      this.thrLeft.fillCircle(pos.x, pos.y, 1.8);
    }

    // Right side thruster (fires when moving left)
    if (left > 0.06) {
      const pos  = this._toWorld(px, py, r, 22, -5);
      const dir  = this._toDir(r, 1, 0);
      const perp = { x: dir.y, y: -dir.x };
      const len  = (5 + left * 20) * (0.7 + Math.random() * 0.6);
      const hw   = 1.5 + left * 2.5;
      const tip  = { x: pos.x + dir.x * len, y: pos.y + dir.y * len };
      this.thrRight.fillStyle(0xff8800, 0.5 + left * 0.4);
      this.thrRight.fillTriangle(
        pos.x - perp.x * hw, pos.y - perp.y * hw,
        pos.x + perp.x * hw, pos.y + perp.y * hw,
        tip.x, tip.y
      );
      this.thrRight.fillStyle(0xffffff, 0.55);
      this.thrRight.fillCircle(pos.x, pos.y, 1.8);
    }
  }

  // ─────────────────────────────────────────────
  //  HUD
  // ─────────────────────────────────────────────

  createUI() {
    const { width } = this.scale;
    const depth = 100;

    this.scoreTxt = this.add.text(10, 10, 'SCORE: 0', {
      fontSize: '18px', fontFamily: 'Arial Black, sans-serif', color: '#ffffff',
    }).setDepth(depth);

    this.waveTxt = this.add.text(width - 10, 10, 'WAVE 1', {
      fontSize: '18px', fontFamily: 'Arial Black, sans-serif', color: '#ffcc00',
    }).setOrigin(1, 0).setDepth(depth);

    this.add.text(10, 36, 'HP', {
      fontSize: '13px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa',
    }).setDepth(depth);

    this.healthBarBg = this.add.rectangle(36, 43, 160, 12, 0x330000).setOrigin(0, 0.5).setDepth(depth);
    this.healthBar   = this.add.rectangle(36, 43, 160, 12, 0x00ee44).setOrigin(0, 0.5).setDepth(depth + 1);

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
      .setDepth(200).setInteractive().setStrokeStyle(2, 0x00aaff);
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
      .setDepth(200).setInteractive().setStrokeStyle(2, 0xff8800);
    this.rocketBtnLabel = this.add.text(rocketBtnX, rocketBtnY - 6, 'ROCKET', {
      fontSize: '20px', fontFamily: 'Arial Black, sans-serif', color: '#ffaa00',
    }).setOrigin(0.5).setDepth(201);
    this.rocketCDOverlay = this.add.rectangle(rocketBtnX, rocketBtnY, 115, 65, 0x000000, 0.55)
      .setDepth(202).setVisible(false);
    this.rocketCDTimerTxt = this.add.text(rocketBtnX, rocketBtnY + 6, '', {
      fontSize: '22px', fontFamily: 'Arial Black, sans-serif', color: '#ffffff',
    }).setOrigin(0.5).setDepth(203);
    this.rocketBtnBg.on('pointerdown', () => this.fireRocket());

    // ── ICE + ZAP buttons (half-size, just above ROCKET, hidden initially) ───
    // Total width of both = 55+4+55 = 114, centered on rocketBtnX
    const subBtnH  = 30;                                       // half of ~65
    const subBtnW  = 55;                                       // half of ~115
    const subGap   = 4;
    const subY     = rocketBtnY - 65 / 2 - subBtnH / 2 - 4;  // just above ROCKET top edge
    const iceBtnX  = rocketBtnX - subBtnW / 2 - subGap / 2;
    const zapBtnX  = rocketBtnX + subBtnW / 2 + subGap / 2;

    this.iceBtnBg = this.add.rectangle(iceBtnX, subY, subBtnW, subBtnH, 0x002255, 0.92)
      .setDepth(200).setInteractive().setStrokeStyle(2, 0x00aaff).setVisible(false);
    this.iceBtnTxt = this.add.text(iceBtnX, subY, 'ICE', {
      fontSize: '14px', fontFamily: 'Arial Black, sans-serif', color: '#88eeff',
    }).setOrigin(0.5).setDepth(201).setVisible(false);

    this.zapBtnBg = this.add.rectangle(zapBtnX, subY, subBtnW, subBtnH, 0x332200, 0.92)
      .setDepth(200).setInteractive().setStrokeStyle(2, 0xffdd00).setVisible(false);
    this.zapBtnTxt = this.add.text(zapBtnX, subY, 'ZAP', {
      fontSize: '14px', fontFamily: 'Arial Black, sans-serif', color: '#ffee44',
    }).setOrigin(0.5).setDepth(201).setVisible(false);

    this.iceBtnBg.on('pointerdown', () => this.fireIceRocket());
    this.zapBtnBg.on('pointerdown', () => this.fireZapRocket());

    // ── Virtual Joystick ─────────────────────────
    const joyX = 72;
    const joyY = height - 110;
    this.joy = { baseX: joyX, baseY: joyY, dx: 0, dy: 0, active: false, pointerId: null };
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
      const clamp = Math.min(dist, max);
      const angle = Math.atan2(dy, dx);
      this.joyThumb.setPosition(
        this.joy.baseX + Math.cos(angle) * clamp,
        this.joy.baseY + Math.sin(angle) * clamp
      );
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

  // Show ICE + ZAP buttons; auto-hide after SUB_ROCKET_WINDOW
  showSubRocketButtons() {
    [this.iceBtnBg, this.iceBtnTxt, this.zapBtnBg, this.zapBtnTxt]
      .forEach(o => o.setVisible(true).setAlpha(1));

    // Cancel any existing countdown
    if (this.subRocketTimer) { this.subRocketTimer.remove(); this.subRocketTimer = null; }

    this.subRocketTimer = this.time.delayedCall(SUB_ROCKET_WINDOW, () => {
      this.hideSubRocketButtons();
    });
  }

  hideSubRocketButtons() {
    [this.iceBtnBg, this.iceBtnTxt, this.zapBtnBg, this.zapBtnTxt]
      .forEach(o => o.setVisible(false));
    if (this.subRocketTimer) { this.subRocketTimer.remove(); this.subRocketTimer = null; }
  }

  // ─────────────────────────────────────────────
  //  MOVEMENT
  // ─────────────────────────────────────────────

  handleMovement() {
    let vx = 0, vy = 0;

    if (this.cursors.left.isDown  || this.wasd.left.isDown)  vx = -1;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) vx =  1;
    if (this.cursors.up.isDown    || this.wasd.up.isDown)   vy = -1;
    else if (this.cursors.down.isDown  || this.wasd.down.isDown)  vy =  1;

    if (this.joy.active) { vx = this.joy.dx; vy = this.joy.dy; }
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

    this.moveX = vx;
    this.moveY = vy;
    this.player.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);

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
    if (Phaser.Input.Keyboard.JustDown(this.rocketKey)) this.fireRocket();
  }

  shootBullet() {
    const r  = this.player.rotation;
    const bx = this.player.x - 48 * Math.sin(r);
    const by = this.player.y - 48 * Math.cos(r);
    const b  = this.bullets.create(bx, by, 'bullet');
    if (!b) return;
    b.setVelocityY(-BULLET_SPEED);
    b.setDepth(9);
    b.body.setSize(4, 14);
  }

  fireRocket() {
    if (!this.rocketReady || this.gameOver) return;
    const r  = this.player.rotation;
    const rx = this.player.x - 48 * Math.sin(r);
    const ry = this.player.y - 48 * Math.cos(r);
    const rocket = this.rockets.create(rx, ry, 'rocket');
    if (!rocket) return;
    rocket.setVelocityY(-ROCKET_SPEED);
    rocket.setDepth(9);

    this.rocketReady             = false;
    this.rocketCooldownRemaining = ROCKET_COOLDOWN_MS;
    this.rocketCDOverlay.setVisible(true);
    this.rocketBtnBg.setFillStyle(0x221100, 0.88);

    // Reveal ICE + ZAP after each rocket use
    this.showSubRocketButtons();
  }

  fireIceRocket() {
    if (this.gameOver) return;
    this.hideSubRocketButtons();

    const r   = this.player.rotation;
    const rx  = this.player.x - 48 * Math.sin(r);
    const ry  = this.player.y - 48 * Math.cos(r);
    const ice = this.iceRockets.create(rx, ry, 'iceRocket');
    if (!ice) return;
    ice.setVelocityY(-ROCKET_SPEED);
    ice.setDepth(9);
  }

  fireZapRocket() {
    if (this.gameOver) return;
    this.hideSubRocketButtons();

    const r   = this.player.rotation;
    const rx  = this.player.x - 48 * Math.sin(r);
    const ry  = this.player.y - 48 * Math.cos(r);
    const zap = this.zapRockets.create(rx, ry, 'zapRocket');
    if (!zap) return;
    zap.setVelocityY(-ROCKET_SPEED);
    zap.setDepth(9);
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
      this.tweens.add({
        targets: this.rocketBtnBg, alpha: 0.3, duration: 150,
        yoyo: true, repeat: 3, onComplete: () => this.rocketBtnBg.setAlpha(1),
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
    const enemy = this.enemies.create(x, -40, 'enemy');
    if (!enemy) return;
    enemy.setDepth(8);
    enemy.health   = ENEMY_HEALTH + Math.floor((this.wave - 1) / 3);
    enemy.slowed   = false;
    enemy.waveTween = null;

    const pattern = Phaser.Math.Between(0, 2);
    const baseVY  = Phaser.Math.Between(100, 160) + (this.wave - 1) * 8;

    if (pattern === 0) {
      enemy.setVelocityY(baseVY);
    } else if (pattern === 1) {
      const dir = Phaser.Math.Between(0, 1) ? 1 : -1;
      enemy.setVelocityX(dir * Phaser.Math.Between(70, 130));
      enemy.setVelocityY(baseVY);
    } else {
      enemy.setVelocityY(baseVY);
      // Store tween ref so ICE can slow it
      enemy.waveTween = this.tweens.add({
        targets: enemy,
        x: { value: `+=${Phaser.Math.Between(0, 1) ? 120 : -120}`, duration: 1400 },
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
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
    this.enemySpawnEvent.delay = this.spawnDelay();

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

  // ICE rocket hits first enemy it touches → full screen-wide effect
  onIceRocketHit(iceRocket, enemy) {
    this.triggerIceExplosion(iceRocket.x, iceRocket.y);
    iceRocket.destroy();
  }

  // ZAP rocket hits first enemy it touches → chain effect
  onZapRocketHit(zapRocket, enemy) {
    this.triggerZapChain(zapRocket.x, zapRocket.y);
    zapRocket.destroy();
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
  //  STANDARD ROCKET EXPLOSION
  // ─────────────────────────────────────────────

  triggerRocketExplosion(x, y) {
    const outer = this.add.circle(x, y, 8, 0xff6600, 0.9).setDepth(15);
    this.tweens.add({
      targets: outer, radius: ROCKET_AOE_RADIUS, alpha: 0, duration: 420,
      onComplete: () => outer.destroy(),
    });
    const inner = this.add.circle(x, y, 6, 0xffee44, 1).setDepth(16);
    this.tweens.add({
      targets: inner, radius: ROCKET_AOE_RADIUS * 0.55, alpha: 0, duration: 280,
      onComplete: () => inner.destroy(),
    });
    this.enemies.getChildren().forEach(enemy => {
      if (!enemy.active) return;
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= ROCKET_AOE_RADIUS) {
        this.killEnemy(enemy);
      }
    });
    this.cameras.main.shake(320, 0.014);
    this.score += 5 * this.wave;
  }

  // ─────────────────────────────────────────────
  //  ICE ROCKET
  // ─────────────────────────────────────────────

  triggerIceExplosion(x, y) {
    // Visual — huge expanding blue ring
    const outer = this.add.circle(x, y, 10, 0x0066ff, 0.85).setDepth(15);
    this.tweens.add({
      targets: outer, radius: ICE_AOE_RADIUS, alpha: 0, duration: 600,
      onComplete: () => outer.destroy(),
    });
    const mid = this.add.circle(x, y, 8, 0x88ddff, 0.7).setDepth(16);
    this.tweens.add({
      targets: mid, radius: ICE_AOE_RADIUS * 0.65, alpha: 0, duration: 450,
      onComplete: () => mid.destroy(),
    });
    const core = this.add.circle(x, y, 6, 0xffffff, 1).setDepth(17);
    this.tweens.add({
      targets: core, radius: 40, alpha: 0, duration: 250,
      onComplete: () => core.destroy(),
    });

    // Frost snowflake spokes
    const spokeGfx = this.add.graphics().setDepth(16);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const ex    = x + Math.cos(angle) * ICE_AOE_RADIUS * 0.5;
      const ey    = y + Math.sin(angle) * ICE_AOE_RADIUS * 0.5;
      spokeGfx.lineStyle(2, 0xaaddff, 0.7);
      spokeGfx.lineBetween(x, y, ex, ey);
    }
    this.tweens.add({ targets: spokeGfx, alpha: 0, duration: 600, onComplete: () => spokeGfx.destroy() });

    this.cameras.main.flash(120, 100, 180, 255, false);
    this.cameras.main.shake(180, 0.008);

    // Damage + slow ALL current enemies
    const targets = this.enemies.getChildren().filter(e => e.active);
    targets.forEach(enemy => {
      this.flashIce(enemy);
      enemy.health -= ICE_DAMAGE;
      if (enemy.health <= 0) {
        this.killEnemy(enemy);
        return;
      }
      if (!enemy.slowed) {
        // Store original velocities
        enemy.origVX     = enemy.body.velocity.x;
        enemy.origVY     = enemy.body.velocity.y;
        enemy.slowed     = true;
        enemy.setTint(0x88ccff);
        enemy.body.setVelocity(enemy.origVX * ICE_SLOW_FACTOR, enemy.origVY * ICE_SLOW_FACTOR);
        if (enemy.waveTween) enemy.waveTween.timeScale = ICE_SLOW_FACTOR;

        // Restore after ICE_SLOW_DURATION
        this.time.delayedCall(ICE_SLOW_DURATION, () => {
          if (!enemy.active) return;
          enemy.slowed = false;
          enemy.clearTint();
          enemy.body.setVelocity(enemy.origVX, enemy.origVY);
          if (enemy.waveTween) enemy.waveTween.timeScale = 1;
        });
      }
    });

    this.score += 5 * this.wave;
  }

  flashIce(enemy) {
    this.tweens.add({ targets: enemy, alpha: 0.3, duration: 60, yoyo: true });
  }

  // ─────────────────────────────────────────────
  //  ZAP ROCKET
  // ─────────────────────────────────────────────

  triggerZapChain(x, y) {
    // Central explosion visual
    const flash = this.add.circle(x, y, 8, 0xffff00, 1).setDepth(17);
    this.tweens.add({
      targets: flash, radius: 60, alpha: 0, duration: 300,
      onComplete: () => flash.destroy(),
    });

    let hitsLeft = ZAP_HITS;

    const doZapHit = () => {
      if (hitsLeft <= 0) return;
      hitsLeft--;

      // Strike all active enemies
      this.enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        this.showZapOnEnemy(enemy.x, enemy.y);
        this.flashZap(enemy);
        enemy.health -= ZAP_DAMAGE;
        if (enemy.health <= 0) this.killEnemy(enemy);
      });

      // Screen electric pulse ring expanding from impact
      const ring = this.add.circle(x, y, 5, 0xffff00, 0.6).setDepth(15);
      this.tweens.add({
        targets: ring,
        radius: 50 + (ZAP_HITS - hitsLeft) * 30,
        alpha: 0, duration: 350,
        onComplete: () => ring.destroy(),
      });

      // Schedule next hit
      if (hitsLeft > 0) {
        this.time.delayedCall(ZAP_INTERVAL, doZapHit);
      }
    };

    doZapHit(); // immediate first hit
  }

  // Electric crackle drawn at enemy position for each ZAP hit
  showZapOnEnemy(x, y) {
    const g = this.add.graphics().setDepth(18);
    g.lineStyle(2, 0xffff44, 1);
    // 4 random lightning spokes
    for (let i = 0; i < 4; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const len    = 10 + Math.random() * 16;
      const midX   = x + Math.cos(angle) * len * 0.5 + (Math.random() - 0.5) * 8;
      const midY   = y + Math.sin(angle) * len * 0.5 + (Math.random() - 0.5) * 8;
      const endX   = x + Math.cos(angle) * len;
      const endY   = y + Math.sin(angle) * len;
      g.lineBetween(x, y, midX, midY);
      g.lineBetween(midX, midY, endX, endY);
    }
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(x, y, 4);
    this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
  }

  flashZap(enemy) {
    this.tweens.add({
      targets: enemy, alpha: 0.2, duration: 40, yoyo: true,
      onComplete: () => { if (enemy.active) enemy.setAlpha(1); },
    });
  }

  // ─────────────────────────────────────────────
  //  COMMON EFFECTS
  // ─────────────────────────────────────────────

  flashEnemy(enemy) {
    this.tweens.add({ targets: enemy, alpha: 0.2, duration: 40, yoyo: true });
  }

  killEnemy(enemy) {
    this.score     += 10 * this.wave;
    this.killCount += 1;
    const exp = this.add.circle(enemy.x, enemy.y, 6, 0xff5500, 1).setDepth(15);
    this.tweens.add({
      targets: exp, radius: 28, alpha: 0, duration: 280,
      onComplete: () => exp.destroy(),
    });
    enemy.destroy();
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
    this.thrMain.clear(); this.thrLeft.clear(); this.thrRight.clear();
    this.enemySpawnEvent.remove();
    this.enemyFireEvent.remove();
    this.hideSubRocketButtons();

    const exp = this.add.circle(this.player.x, this.player.y, 8, 0xff8800, 1).setDepth(20);
    this.tweens.add({ targets: exp, radius: 90, alpha: 0, duration: 700, onComplete: () => exp.destroy() });
    this.cameras.main.shake(600, 0.022);

    const { width, height } = this.scale;
    this.time.delayedCall(900, () => {
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
    });
  }

  // ─────────────────────────────────────────────
  //  CLEANUP
  // ─────────────────────────────────────────────

  cleanupOffscreen() {
    const margin = 80;
    [this.bullets, this.rockets, this.iceRockets, this.zapRockets, this.enemies, this.enemyBullets]
      .forEach(group => {
        group.getChildren().forEach(obj => {
          if (obj.y > this.H + margin || obj.y < -margin || obj.x < -margin || obj.x > this.W + margin) {
            // Ice/zap rockets that fly off-screen without hitting → still trigger their effects
            if (group === this.iceRockets) this.triggerIceExplosion(obj.x, Math.max(obj.y, -50));
            if (group === this.zapRockets) this.triggerZapChain(obj.x, Math.max(obj.y, -50));
            obj.destroy();
          }
        });
      });
  }
}

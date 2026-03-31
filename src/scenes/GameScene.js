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
const SUB_ROCKET_WINDOW  = 5000;
const ICE_AOE_RADIUS     = 380;
const ICE_DAMAGE         = 1;
const ICE_SLOW_FACTOR    = 0.2;
const ICE_SLOW_DURATION  = 5000;
const ZAP_DAMAGE         = 1;
const ZAP_HITS           = 4;
const ZAP_INTERVAL       = 1000;

// Boss constants
const BOSS_HP_MULT         = 100;   // HP = BOSS_HP_MULT × weakest enemy HP on that wave
const BOSS_FIRE_RATE       = 1500;  // ms between 5-bullet spreads
const BOSS_SPECIAL_DELAY   = 5000;  // ms between special ability uses
const BOSS_SPECIAL_WARN    = 1500;  // ms of warning before damage
const BOSS_SAFE_RADIUS     = 78;    // px radius of each safe zone
const BOSS_SPECIAL_DAMAGE  = 25;    // HP taken if outside safe zone
const BOSS_ROCKET_DMG      = 20;    // normal rocket damage to boss
const BOSS_ICE_DMG         = 10;    // ice rocket damage to boss
const BOSS_ENTRY_Y         = 145;   // y position boss settles to after entry

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
    this.subRocketTimer = null;

    // Boss state
    this.boss            = null;
    this.bossActive      = false;
    this.bossFireTimer   = null;
    this.bossSpecTimer   = null;
    this.bossSpecRunning = false; // prevent overlap of special ability

    this.createBackground();
    this.createTextures();

    // Physics groups
    this.bullets      = this.physics.add.group();
    this.rockets      = this.physics.add.group();
    this.iceRockets   = this.physics.add.group();
    this.zapRockets   = this.physics.add.group();
    this.enemies      = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();
    this.bossGroup    = this.physics.add.group(); // only ever holds this.boss

    // Thrusters (drawn behind player, depth 9)
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

    // Collisions — regular enemies
    this.physics.add.overlap(this.bullets,      this.enemies,   this.onBulletHitEnemy,  null, this);
    this.physics.add.overlap(this.rockets,      this.enemies,   this.onRocketHitEnemy,  null, this);
    this.physics.add.overlap(this.iceRockets,   this.enemies,   this.onIceRocketHit,    null, this);
    this.physics.add.overlap(this.zapRockets,   this.enemies,   this.onZapRocketHit,    null, this);
    this.physics.add.overlap(this.enemyBullets, this.player,    this.onEnemyBulletHit,  null, this);
    this.physics.add.overlap(this.enemies,      this.player,    this.onEnemyCollide,    null, this);

    // Collisions — boss
    this.physics.add.overlap(this.bullets,    this.bossGroup, this.onBulletHitBoss,   null, this);
    this.physics.add.overlap(this.rockets,    this.bossGroup, this.onRocketHitBoss,   null, this);
    this.physics.add.overlap(this.iceRockets, this.bossGroup, this.onIceHitBoss,      null, this);
    this.physics.add.overlap(this.zapRockets, this.bossGroup, this.onZapHitBoss,      null, this);
    this.physics.add.overlap(this.bossGroup,  this.player,    this.onBossCollide,     null, this);

    // Timers
    this.enemySpawnEvent = this.time.addEvent({
      delay: this.spawnDelay(), callback: this.spawnEnemy, callbackScope: this, loop: true,
    });
    this.enemyFireEvent = this.time.addEvent({
      delay: 2200, callback: this.enemiesShoot, callbackScope: this, loop: true,
    });
    // Wave timer — fires to TRIGGER boss spawn, not to advance wave directly
    this.waveEvent = this.time.addEvent({
      delay: 20000, callback: this.endWave, callbackScope: this, loop: true,
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
  //  TEXTURES
  // ─────────────────────────────────────────────

  createTextures() {
    this.makePlayerTexture();
    this.makeEnemyTexture();
    this.makeBossTexture();
    this.makeBulletTexture();
    this.makeBossBulletTexture();
    this.makeEnemyBulletTexture();
    this.makeRocketTexture();
    this.makeIceRocketTexture();
    this.makeZapRocketTexture();
  }

  makePlayerTexture() {
    if (this.textures.exists('player')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x0c0c1a);
    g.fillPoints([
      { x:40,y:1   },{ x:44,y:12  },{ x:78,y:64  },{ x:58,y:76  },
      { x:48,y:87  },{ x:44,y:97  },{ x:40,y:100 },{ x:36,y:97  },
      { x:32,y:87  },{ x:22,y:76  },{ x:2, y:64  },{ x:36,y:12  },
    ], true);
    g.fillStyle(0x1144bb);
    g.fillPoints([{ x:44,y:12 },{ x:78,y:64 },{ x:72,y:62 },{ x:46,y:16 }], true);
    g.fillPoints([{ x:36,y:12 },{ x:2, y:64 },{ x:8, y:62 },{ x:34,y:16 }], true);
    g.fillStyle(0xcc0018);
    g.fillPoints([{ x:46,y:22 },{ x:70,y:58 },{ x:64,y:64 },{ x:50,y:32 }], true);
    g.fillPoints([{ x:34,y:22 },{ x:10,y:58 },{ x:16,y:64 },{ x:30,y:32 }], true);
    g.fillStyle(0xaa0012);
    g.fillPoints([{ x:47,y:34 },{ x:65,y:58 },{ x:61,y:63 },{ x:51,y:42 }], true);
    g.fillPoints([{ x:33,y:34 },{ x:15,y:58 },{ x:19,y:63 },{ x:29,y:42 }], true);
    g.fillStyle(0x10101f);
    g.fillPoints([
      { x:40,y:1   },{ x:44,y:12  },{ x:46,y:28  },{ x:46,y:84  },
      { x:44,y:97  },{ x:40,y:100 },{ x:36,y:97  },{ x:34,y:84  },
      { x:34,y:28  },{ x:36,y:12  },
    ], true);
    g.fillStyle(0x050510); g.fillRect(27,30,7,20); g.fillRect(46,30,7,20);
    g.fillStyle(0x181828); g.fillRect(28,31,5,18); g.fillRect(47,31,5,18);
    g.fillStyle(0x222244,0.8); g.fillRect(28,31,5,4); g.fillRect(47,31,5,4);
    g.fillStyle(0x0d2888); g.fillEllipse(40,24,13,19);
    g.fillStyle(0x2255cc); g.fillEllipse(39,21,6,9);
    g.fillStyle(0x4477ff,0.6); g.fillEllipse(38,19,3,5);
    g.fillStyle(0xff7700,0.3); g.fillEllipse(34,40,13,9); g.fillEllipse(46,40,13,9);
    g.fillStyle(0xffaa00);     g.fillEllipse(34,40,8,6);  g.fillEllipse(46,40,8,6);
    g.fillStyle(0xff6600);     g.fillEllipse(34,40,6,4);  g.fillEllipse(46,40,6,4);
    g.fillStyle(0x000000);     g.fillEllipse(34,40,2,6);  g.fillEllipse(46,40,2,6);
    g.fillStyle(0xffffff);     g.fillCircle(35,39,1);     g.fillCircle(47,39,1);
    g.fillStyle(0x0c0c1a);
    g.fillTriangle(34,72,24,96,36,82); g.fillTriangle(46,72,56,96,44,82);
    g.fillStyle(0xcc0018,0.85);
    g.fillTriangle(34,75,27,93,35,80); g.fillTriangle(46,75,53,93,45,80);
    g.fillStyle(0x1a1a30); g.fillEllipse(33,84,10,12); g.fillEllipse(47,84,10,12);
    g.fillStyle(0x003399); g.fillEllipse(33,84,7,9);   g.fillEllipse(47,84,7,9);
    g.fillStyle(0x0055ee); g.fillEllipse(33,84,4,5);   g.fillEllipse(47,84,4,5);
    g.fillStyle(0x66aaff,0.7); g.fillEllipse(33,84,2,3); g.fillEllipse(47,84,2,3);
    g.fillStyle(0x223399); g.fillTriangle(40,1,38,9,42,9);
    g.fillStyle(0x4466cc,0.6); g.fillTriangle(40,2,39,7,41,7);
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
    g.fillStyle(0xff2200,0.6); g.fillEllipse(23,38,4,7);
    g.fillStyle(0xff2200,0.4); g.fillEllipse(20,28,8,5); g.fillEllipse(28,28,8,5);
    g.fillStyle(0xff4400);     g.fillEllipse(20,28,5,4); g.fillEllipse(28,28,5,4);
    g.fillStyle(0x000000);     g.fillCircle(20,28,2);    g.fillCircle(28,28,2);
    g.fillStyle(0x331100); g.fillEllipse(24,8,8,8);
    g.fillStyle(0xaa3300); g.fillEllipse(24,8,5,5);
    g.fillStyle(0xff6600); g.fillEllipse(24,8,2,2);
    g.generateTexture('enemy', 48, 64);
    g.destroy();
  }

  // Boss — large 128×100 flying wing, dark red/black, 4 engine nozzles
  makeBossTexture() {
    if (this.textures.exists('boss')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const W = 128, H = 100, cx = 64;

    // Main wing silhouette
    g.fillStyle(0x150606);
    g.fillPoints([
      { x:cx,    y:8   }, { x:cx+14,  y:20  }, { x:W-2,   y:56  },
      { x:W-18,  y:72  }, { x:cx+22,  y:84  }, { x:cx+14,  y:96  },
      { x:cx,    y:100 }, { x:cx-14,  y:96  }, { x:cx-22,  y:84  },
      { x:18,    y:72  }, { x:2,      y:56  }, { x:cx-14,  y:20  },
    ], true);

    // Orange leading edges
    g.fillStyle(0xcc4400);
    g.fillPoints([{ x:cx+14,y:20 },{ x:W-2,y:56 },{ x:W-18,y:62 },{ x:cx+18,y:28 }], true);
    g.fillPoints([{ x:cx-14,y:20 },{ x:2,  y:56 },{ x:18,  y:62 },{ x:cx-18,y:28 }], true);

    // Deep-red wing panels
    g.fillStyle(0x880000);
    g.fillPoints([{ x:cx+20,y:32 },{ x:W-16,y:58 },{ x:W-28,y:68 },{ x:cx+28,y:48 }], true);
    g.fillPoints([{ x:cx-20,y:32 },{ x:16,  y:58 },{ x:28,  y:68 },{ x:cx-28,y:48 }], true);
    // Second stripe
    g.fillStyle(0x660000);
    g.fillPoints([{ x:cx+30,y:44 },{ x:W-26,y:64 },{ x:W-36,y:70 },{ x:cx+38,y:56 }], true);
    g.fillPoints([{ x:cx-30,y:44 },{ x:26,  y:64 },{ x:36,  y:70 },{ x:cx-38,y:56 }], true);

    // Central fuselage
    g.fillStyle(0x1c0808);
    g.fillPoints([
      { x:cx,    y:8   }, { x:cx+16,  y:22  }, { x:cx+20,  y:42  },
      { x:cx+20,  y:80  }, { x:cx+14,  y:96  }, { x:cx,    y:100 },
      { x:cx-14,  y:96  }, { x:cx-20,  y:80  }, { x:cx-20,  y:42  },
      { x:cx-16,  y:22  },
    ], true);

    // Side engine pods
    g.fillStyle(0x220808); g.fillRect(cx-38,44,14,32); g.fillRect(cx+24,44,14,32);
    g.fillStyle(0x3d0000); g.fillRect(cx-37,45,12,30); g.fillRect(cx+25,45,12,30);

    // Cockpit dome
    g.fillStyle(0x6b0000); g.fillEllipse(cx,32,24,32);
    g.fillStyle(0xaa0000); g.fillEllipse(cx-3,28,10,16);
    g.fillStyle(0xff2200,0.25); g.fillEllipse(cx-2,27,6,10);

    // Boss red eyes — large and menacing
    g.fillStyle(0xff0000,0.35); g.fillEllipse(cx-14,42,20,13); g.fillEllipse(cx+14,42,20,13);
    g.fillStyle(0xff2200);      g.fillEllipse(cx-14,42,14,10); g.fillEllipse(cx+14,42,14,10);
    g.fillStyle(0xff6600);      g.fillEllipse(cx-14,42,9,7);   g.fillEllipse(cx+14,42,9,7);
    g.fillStyle(0xffffff);      g.fillEllipse(cx-14,42,4,3);   g.fillEllipse(cx+14,42,4,3);
    g.fillStyle(0x000000);      g.fillEllipse(cx-14,42,7,9);   g.fillEllipse(cx+14,42,7,9);

    // Claw mark scratches on wings
    g.lineStyle(2, 0x440000, 0.8);
    for (let i = 0; i < 3; i++) {
      const ox = 24 + i * 11;
      g.lineBetween(cx + ox,     36 + i * 5, cx + ox + 2,  48 + i * 5);
      g.lineBetween(cx - ox,     36 + i * 5, cx - ox - 2,  48 + i * 5);
      g.lineBetween(cx + ox + 4, 38 + i * 5, cx + ox + 6,  50 + i * 5);
      g.lineBetween(cx - ox - 4, 38 + i * 5, cx - ox - 6,  50 + i * 5);
    }

    // 4 engine nozzles at rear
    for (const ex of [cx - 20, cx - 7, cx + 7, cx + 20]) {
      g.fillStyle(0x221100); g.fillEllipse(ex, 88, 9, 11);
      g.fillStyle(0x770000); g.fillEllipse(ex, 88, 6, 8);
      g.fillStyle(0xcc2200); g.fillEllipse(ex, 88, 3, 5);
      g.fillStyle(0xff6600,0.8); g.fillEllipse(ex, 88, 1.5, 2.5);
    }

    // Nose highlight
    g.fillStyle(0x441100); g.fillTriangle(cx, 8, cx-6, 20, cx+6, 20);
    g.fillStyle(0x882200,0.6); g.fillTriangle(cx, 9, cx-3, 16, cx+3, 16);

    g.generateTexture('boss', W, H);
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

  // Larger, more menacing bullet for boss fire
  makeBossBulletTexture() {
    if (this.textures.exists('bbullet')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xff2200); g.fillRect(1, 0, 6, 16);
    g.fillStyle(0xff6600); g.fillRect(2, 0, 4, 6);
    g.fillStyle(0xffaa00,0.6); g.fillRect(3, 0, 2, 3);
    g.generateTexture('bbullet', 8, 16);
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
    g.fillTriangle(5,20,0,28,7,22); g.fillTriangle(15,20,20,28,13,22);
    g.fillStyle(0xffcc44,0.8); g.fillRect(7, 26, 6, 5);
    g.generateTexture('rocket', 20, 32);
    g.destroy();
  }

  makeIceRocketTexture() {
    if (this.textures.exists('iceRocket')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x1155cc); g.fillRect(4, 6, 10, 22);
    g.fillStyle(0xaaddff); g.fillTriangle(9, 0, 4, 8, 14, 8);
    g.fillStyle(0xffffff); g.fillTriangle(9, 0, 8, 4, 10, 4);
    g.fillStyle(0x00ccff);
    g.fillTriangle(4,20,0,30,6,24); g.fillTriangle(14,20,18,30,12,24);
    g.fillStyle(0x88eeff,0.7); g.fillRect(6, 28, 6, 5);
    g.fillStyle(0xaaddff,0.6); g.fillRect(6,12,2,3); g.fillRect(10,16,2,3);
    g.generateTexture('iceRocket', 18, 34);
    g.destroy();
  }

  makeZapRocketTexture() {
    if (this.textures.exists('zapRocket')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xcc9900); g.fillRect(4, 6, 10, 22);
    g.fillStyle(0xffee00); g.fillTriangle(9, 0, 4, 8, 14, 8);
    g.fillStyle(0xffffff); g.fillTriangle(9, 0, 8, 4, 10, 4);
    g.fillStyle(0xffdd00);
    g.fillTriangle(4,18,0,28,6,22); g.fillTriangle(14,18,18,28,12,22);
    g.fillStyle(0xffff88,0.7); g.fillRect(6, 28, 6, 5);
    g.fillStyle(0xffffff,0.8);
    g.fillTriangle(8,10,6,16,10,14); g.fillTriangle(10,14,8,20,12,18);
    g.generateTexture('zapRocket', 18, 34);
    g.destroy();
  }

  // ─────────────────────────────────────────────
  //  THRUSTERS
  // ─────────────────────────────────────────────

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
    this.thrMain.clear(); this.thrLeft.clear(); this.thrRight.clear();

    const fwd   = Math.max(0, -this.moveY);
    const right = Math.max(0,  this.moveX);
    const left  = Math.max(0, -this.moveX);
    const mainIntensity = Math.max(0.22, fwd);
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
    const d = 100;

    this.scoreTxt = this.add.text(10, 10, 'SCORE: 0', {
      fontSize: '18px', fontFamily: 'Arial Black, sans-serif', color: '#ffffff',
    }).setDepth(d);

    this.waveTxt = this.add.text(width - 10, 10, 'WAVE 1', {
      fontSize: '18px', fontFamily: 'Arial Black, sans-serif', color: '#ffcc00',
    }).setOrigin(1, 0).setDepth(d);

    this.add.text(10, 36, 'HP', {
      fontSize: '13px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa',
    }).setDepth(d);
    this.healthBarBg = this.add.rectangle(36, 43, 160, 12, 0x330000).setOrigin(0, 0.5).setDepth(d);
    this.healthBar   = this.add.rectangle(36, 43, 160, 12, 0x00ee44).setOrigin(0, 0.5).setDepth(d + 1);

    this.rocketStatusTxt = this.add.text(width - 10, 34, 'ROCKET: READY', {
      fontSize: '13px', fontFamily: 'Arial Black, sans-serif', color: '#ff8800',
    }).setOrigin(1, 0).setDepth(d);

    // Boss health bar — hidden until boss spawns
    const bby = 64;
    const bbw = width - 24;
    this.bossBarBg   = this.add.rectangle(12, bby, bbw, 18, 0x110000)
      .setOrigin(0).setDepth(d).setVisible(false);
    this.bossBarFill = this.add.rectangle(14, bby + 2, bbw - 4, 14, 0xdd1100)
      .setOrigin(0).setDepth(d + 1).setVisible(false);
    this.bossBarTxt  = this.add.text(width / 2, bby + 9, 'BOSS', {
      fontSize: '11px', fontFamily: 'Arial Black, sans-serif', color: '#ff8800',
    }).setOrigin(0.5).setDepth(d + 2).setVisible(false);
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

  showBossBar(label) {
    this.bossBarTxt.setText(label);
    [this.bossBarBg, this.bossBarFill, this.bossBarTxt].forEach(o => o.setVisible(true));
    this.updateBossBar();
  }

  hideBossBar() {
    [this.bossBarBg, this.bossBarFill, this.bossBarTxt].forEach(o => o.setVisible(false));
  }

  updateBossBar() {
    if (!this.boss) return;
    const pct  = this.boss.health / this.boss.maxHealth;
    const maxW = this.W - 28;
    this.bossBarFill.setDisplaySize(Math.max(2, maxW * pct), 14);
    const col = pct > 0.5 ? 0xdd1100 : pct > 0.25 ? 0xff5500 : 0xffaa00;
    this.bossBarFill.setFillStyle(col);
  }

  // ─────────────────────────────────────────────
  //  TOUCH CONTROLS
  // ─────────────────────────────────────────────

  createTouchControls() {
    const { width, height } = this.scale;

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

    // ICE + ZAP — half-size, just above ROCKET, hidden initially
    const subBtnH = 30;
    const subBtnW = 55;
    const subGap  = 4;
    const subY    = rocketBtnY - 65 / 2 - subBtnH / 2 - 4;
    const iceBtnX = rocketBtnX - subBtnW / 2 - subGap / 2;
    const zapBtnX = rocketBtnX + subBtnW / 2 + subGap / 2;

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

    // Virtual Joystick
    const joyX = 72;
    const joyY = height - 110;
    this.joy = { baseX: joyX, baseY: joyY, dx: 0, dy: 0, active: false, pointerId: null };
    this.joyBase  = this.add.circle(joyX, joyY, 52, 0x001133, 0.65).setDepth(200);
    this.joyThumb = this.add.circle(joyX, joyY, 22, 0x0055aa, 0.9).setDepth(201);

    this.input.on('pointerdown', (ptr) => {
      if (ptr.x < this.W / 2 && !this.joy.active) {
        this.joy.active = true; this.joy.pointerId = ptr.id;
        this.joy.baseX = ptr.x; this.joy.baseY = ptr.y;
        this.joyBase.setPosition(ptr.x, ptr.y);
        this.joyThumb.setPosition(ptr.x, ptr.y);
      }
    });
    this.input.on('pointermove', (ptr) => {
      if (!this.joy.active || ptr.id !== this.joy.pointerId) return;
      const dx = ptr.x - this.joy.baseX;
      const dy = ptr.y - this.joy.baseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const max = 42;
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
        this.joy.active = false; this.joy.pointerId = null;
        this.joy.dx = 0; this.joy.dy = 0;
        this.joyThumb.setPosition(this.joy.baseX, this.joy.baseY);
      }
    });
  }

  showSubRocketButtons() {
    [this.iceBtnBg, this.iceBtnTxt, this.zapBtnBg, this.zapBtnTxt]
      .forEach(o => o.setVisible(true).setAlpha(1));
    if (this.subRocketTimer) { this.subRocketTimer.remove(); this.subRocketTimer = null; }
    this.subRocketTimer = this.time.delayedCall(SUB_ROCKET_WINDOW, () => this.hideSubRocketButtons());
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
    else if (this.cursors.right.isDown || this.wasd.right.isDown) vx = 1;
    if (this.cursors.up.isDown    || this.wasd.up.isDown)   vy = -1;
    else if (this.cursors.down.isDown  || this.wasd.down.isDown)  vy = 1;
    if (this.joy.active) { vx = this.joy.dx; vy = this.joy.dy; }
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
    this.moveX = vx;
    this.moveY = vy;
    this.player.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);
    this.player.angle = Phaser.Math.Linear(this.player.angle, vx * 18, 0.15);
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
    this.rocketCDOverlay.setVisible(true);
    this.rocketBtnBg.setFillStyle(0x221100, 0.88);
    this.showSubRocketButtons();
  }

  fireIceRocket() {
    if (this.gameOver) return;
    this.hideSubRocketButtons();
    const r = this.player.rotation;
    const ice = this.iceRockets.create(
      this.player.x - 48 * Math.sin(r),
      this.player.y - 48 * Math.cos(r),
      'iceRocket'
    );
    if (!ice) return;
    ice.setVelocityY(-ROCKET_SPEED).setDepth(9);
  }

  fireZapRocket() {
    if (this.gameOver) return;
    this.hideSubRocketButtons();
    const r = this.player.rotation;
    const zap = this.zapRockets.create(
      this.player.x - 48 * Math.sin(r),
      this.player.y - 48 * Math.cos(r),
      'zapRocket'
    );
    if (!zap) return;
    zap.setVelocityY(-ROCKET_SPEED).setDepth(9);
  }

  updateRocketCooldown(delta) {
    if (this.rocketReady) return;
    this.rocketCooldownRemaining -= delta;
    if (this.rocketCooldownRemaining <= 0) {
      this.rocketReady = true;
      this.rocketCooldownRemaining = 0;
      this.rocketCDOverlay.setVisible(false);
      this.rocketCDTimerTxt.setText('');
      this.rocketBtnBg.setFillStyle(0x884400, 0.88);
      this.tweens.add({
        targets: this.rocketBtnBg, alpha: 0.3, duration: 150,
        yoyo: true, repeat: 3, onComplete: () => this.rocketBtnBg.setAlpha(1),
      });
    } else {
      this.rocketCDTimerTxt.setText(Math.ceil(this.rocketCooldownRemaining / 1000) + 's');
    }
  }

  // ─────────────────────────────────────────────
  //  WAVE / BOSS FLOW
  // ─────────────────────────────────────────────

  // Called when the wave timer fires — start boss fight instead of advancing wave
  endWave() {
    if (this.gameOver || this.bossActive) return;
    // Pause regular enemy spawning
    this.enemySpawnEvent.paused = true;
    this.spawnBoss();
  }

  weakestEnemyHP() {
    return ENEMY_HEALTH + Math.floor((this.wave - 1) / 3);
  }

  spawnBoss() {
    this.bossActive = true;

    const bossHP = this.weakestEnemyHP() * BOSS_HP_MULT;
    const bossX  = this.W / 2;

    // Create physics sprite, add to bossGroup for overlap detection
    this.boss = this.physics.add.sprite(bossX, -70, 'boss');
    this.boss.setDepth(11);
    this.boss.setImmovable(true);
    this.boss.body.setSize(100, 70).setOffset(14, 18);
    this.boss.health    = bossHP;
    this.boss.maxHealth = bossHP;
    this.boss.slowed    = false;
    this.boss.bossTween = null;
    this.bossGroup.add(this.boss);

    // Show boss bar
    this.showBossBar(`BOSS — WAVE ${this.wave}`);

    // Entrance tween: fly in from top
    this.tweens.add({
      targets: this.boss,
      y: BOSS_ENTRY_Y,
      duration: 1600,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!this.boss || !this.boss.active) return;
        this.startBossOscillation();
        this.startBossTimers();
        this.announceBoss();
      },
    });
  }

  startBossOscillation() {
    if (!this.boss) return;
    const range    = this.W - 140;
    const startX   = this.boss.x;
    const duration = Phaser.Math.Between(2800, 3600);

    this.boss.bossTween = this.tweens.add({
      targets: this.boss,
      x: { value: startX > this.W / 2 ? 70 : this.W - 70, duration },
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      onYoyo: () => {
        // Drift slightly up/down each cycle
        if (this.boss && this.boss.active) {
          const newY = Phaser.Math.Clamp(
            this.boss.y + Phaser.Math.Between(-20, 20),
            80, BOSS_ENTRY_Y + 40
          );
          this.tweens.add({ targets: this.boss, y: newY, duration: duration / 2 });
        }
      },
    });
  }

  startBossTimers() {
    this.bossFireTimer = this.time.addEvent({
      delay: BOSS_FIRE_RATE,
      callback: this.bossShoot,
      callbackScope: this,
      loop: true,
    });

    // First special after a short grace period
    this.bossSpecTimer = this.time.addEvent({
      delay: BOSS_SPECIAL_DELAY,
      callback: this.bossSpecialAbility,
      callbackScope: this,
      loop: true,
    });
  }

  announceBoss() {
    const { width, height } = this.scale;
    const txt = this.add.text(width / 2, height * 0.42, `⚠ BOSS INCOMING ⚠`, {
      fontSize: '28px', fontFamily: 'Arial Black, sans-serif',
      color: '#ff2200', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(60).setAlpha(0);
    this.tweens.add({
      targets: txt, alpha: { from: 0, to: 1 }, duration: 250,
      yoyo: true, hold: 1000, onComplete: () => txt.destroy(),
    });
  }

  // Boss fires 5-bullet aimed spread (like 5 weak enemies combined)
  bossShoot() {
    if (!this.boss || !this.boss.active || this.gameOver) return;
    const count = 5;
    const spread = 0.48; // total radians of spread
    const aim    = Math.atan2(this.player.y - this.boss.y, this.player.x - this.boss.x);
    const speed  = 310 + this.wave * 12;

    for (let i = 0; i < count; i++) {
      const angle = aim + (i - (count - 1) / 2) * (spread / (count - 1));
      const spawnX = this.boss.x + Math.cos(angle) * 54;
      const spawnY = this.boss.y + Math.sin(angle) * 54;
      const b = this.enemyBullets.create(spawnX, spawnY, 'bbullet');
      if (!b) continue;
      b.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      b.setDepth(7);
    }
  }

  // Boss special: cover most of screen, 2–3 safe zones, 1.5s to dodge
  bossSpecialAbility() {
    if (!this.boss || !this.boss.active || this.gameOver) return;
    if (this.bossSpecRunning) return;
    this.bossSpecRunning = true;

    const numSafe    = Phaser.Math.Between(2, 3);
    const safeZones  = [];
    const margin     = BOSS_SAFE_RADIUS + 14;

    // Always put first safe zone in lower half so player has a reachable option
    for (let i = 0; i < numSafe; i++) {
      let x, y, tries = 0;
      do {
        x = Phaser.Math.Between(margin, this.W - margin);
        y = i === 0
          ? Phaser.Math.Between(this.H * 0.52, this.H * 0.76)   // lower half
          : Phaser.Math.Between(this.H * 0.28, this.H * 0.76);  // anywhere playfield
        tries++;
      } while (
        tries < 25 &&
        safeZones.some(sz => Phaser.Math.Distance.Between(x, y, sz.x, sz.y) < BOSS_SAFE_RADIUS * 2.4)
      );
      safeZones.push({ x, y });
    }

    const dpth = 25;

    // Full-screen danger overlay
    const overlay = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0xcc0000, 0.48)
      .setDepth(dpth);

    // Safe zone visuals
    const safeObjs = safeZones.map(sz => {
      const fill  = this.add.circle(sz.x, sz.y, BOSS_SAFE_RADIUS, 0x00ff88, 0.45).setDepth(dpth + 1);
      const ring  = this.add.circle(sz.x, sz.y, BOSS_SAFE_RADIUS, 0x000000, 0)
        .setStrokeStyle(3, 0x00ffaa, 1).setDepth(dpth + 2);
      const label = this.add.text(sz.x, sz.y, 'SAFE', {
        fontSize: '15px', fontFamily: 'Arial Black', color: '#ffffff',
        stroke: '#005533', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(dpth + 3);

      // Pulse tweens
      this.tweens.add({ targets: fill,  alpha: { from: 0.35, to: 0.75 }, duration: 280, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: ring,  scaleX: { from: 0.88, to: 1.12 }, scaleY: { from: 0.88, to: 1.12 }, duration: 280, yoyo: true, repeat: -1 });

      return { fill, ring, label };
    });

    // Warning text
    const warnTxt = this.add.text(this.W / 2, this.H * 0.44, '⚡ DANGER — DODGE! ⚡', {
      fontSize: '26px', fontFamily: 'Arial Black, sans-serif',
      color: '#ff3300', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(dpth + 4);
    this.tweens.add({ targets: warnTxt, alpha: 0.15, duration: 180, yoyo: true, repeat: -1 });

    // Pulse overlay
    this.tweens.add({ targets: overlay, alpha: { from: 0.28, to: 0.62 }, duration: 240, yoyo: true, repeat: -1 });

    const cleanup = () => {
      overlay.destroy();
      warnTxt.destroy();
      safeObjs.forEach(o => { o.fill.destroy(); o.ring.destroy(); o.label.destroy(); });
      this.bossSpecRunning = false;
    };

    // After warning window: check if player is in a safe zone
    this.time.delayedCall(BOSS_SPECIAL_WARN, () => {
      if (this.gameOver) { cleanup(); return; }

      const inSafe = safeZones.some(sz =>
        Phaser.Math.Distance.Between(this.player.x, this.player.y, sz.x, sz.y) <= BOSS_SAFE_RADIUS
      );

      if (!inSafe) {
        this.damagePlayer(BOSS_SPECIAL_DAMAGE);
        this.cameras.main.shake(380, 0.022);
      }

      this.cameras.main.flash(180, 255, 60, 0, false);
      this.time.delayedCall(380, cleanup);
    });
  }

  // ─────────────────────────────────────────────
  //  BOSS DAMAGE / DEATH
  // ─────────────────────────────────────────────

  damageBoss(amount) {
    if (!this.boss || !this.boss.active) return;
    this.boss.health -= amount;
    // Flash boss red
    this.tweens.add({ targets: this.boss, alpha: 0.35, duration: 55, yoyo: true });
    this.updateBossBar();
    if (this.boss.health <= 0) this.onBossDied();
  }

  onBossDied() {
    if (!this.boss) return;
    const bx = this.boss.x;
    const by = this.boss.y;

    // Stop boss timers
    if (this.bossFireTimer)  { this.bossFireTimer.remove();  this.bossFireTimer  = null; }
    if (this.bossSpecTimer)  { this.bossSpecTimer.remove();  this.bossSpecTimer  = null; }
    if (this.boss.bossTween) { this.boss.bossTween.stop();   this.boss.bossTween = null; }

    this.boss.destroy();
    this.boss       = null;
    this.bossActive = false;
    this.hideBossBar();

    // Big multi-explosion sequence
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 120, () => {
        const ex = this.add.circle(
          bx + Phaser.Math.Between(-50, 50),
          by + Phaser.Math.Between(-35, 35),
          8, 0xff6600, 1
        ).setDepth(20);
        this.tweens.add({
          targets: ex, radius: 50 + i * 10, alpha: 0, duration: 380,
          onComplete: () => ex.destroy(),
        });
      });
    }
    this.cameras.main.shake(700, 0.026);
    this.cameras.main.flash(300, 255, 140, 0, false);

    // Score bonus
    this.score += 500 * this.wave;

    // "BOSS DEFEATED" announcement then advance wave
    const { width, height } = this.scale;
    const txt = this.add.text(width / 2, height / 2, '✓ BOSS DEFEATED', {
      fontSize: '32px', fontFamily: 'Arial Black, sans-serif',
      color: '#ffcc00', stroke: '#664400', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(60).setAlpha(0);

    this.tweens.add({
      targets: txt, alpha: { from: 0, to: 1 }, duration: 300,
      yoyo: true, hold: 1200,
      onComplete: () => {
        txt.destroy();
        this.advanceWave();
      },
    });
  }

  advanceWave() {
    this.wave++;
    this.waveTxt.setText('WAVE ' + this.wave);
    // Resume enemy spawning with updated rate
    this.enemySpawnEvent.delay  = this.spawnDelay();
    this.enemySpawnEvent.paused = false;

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
    enemy.health    = this.weakestEnemyHP();
    enemy.slowed    = false;
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
      if (!enemy.active || enemy.y < 20 || enemy.y > this.H * 0.75) return;
      const b = this.enemyBullets.create(enemy.x, enemy.y + 26, 'ebullet');
      if (!b) return;
      b.setVelocityY(280 + this.wave * 10).setDepth(7);
    });
  }

  // ─────────────────────────────────────────────
  //  COLLISION HANDLERS — ENEMIES
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

  onIceRocketHit(iceRocket, enemy) {
    this.triggerIceExplosion(iceRocket.x, iceRocket.y);
    iceRocket.destroy();
  }

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
  //  COLLISION HANDLERS — BOSS
  // ─────────────────────────────────────────────

  onBulletHitBoss(bullet, boss) {
    bullet.destroy();
    this.damageBoss(1);
  }

  onRocketHitBoss(rocket, boss) {
    rocket.destroy();
    // Visual explosion but doesn't kill boss outright
    this.triggerRocketExplosionNoDmg(rocket.x, rocket.y);
    this.damageBoss(BOSS_ROCKET_DMG);
  }

  onIceHitBoss(iceRocket, boss) {
    iceRocket.destroy();
    this.triggerIceExplosion(iceRocket.x, iceRocket.y); // slows regular enemies too
    this.damageBoss(BOSS_ICE_DMG);
    // Slow boss tween
    if (this.boss && !this.boss.slowed) {
      this.boss.slowed = true;
      this.boss.setTint(0x88ccff);
      if (this.boss.bossTween) this.boss.bossTween.timeScale = ICE_SLOW_FACTOR;
      this.time.delayedCall(ICE_SLOW_DURATION, () => {
        if (!this.boss || !this.boss.active) return;
        this.boss.slowed = false;
        this.boss.clearTint();
        if (this.boss.bossTween) this.boss.bossTween.timeScale = 1;
      });
    }
  }

  onZapHitBoss(zapRocket, boss) {
    zapRocket.destroy();
    this.triggerZapChain(zapRocket.x, zapRocket.y);
  }

  onBossCollide(player, boss) {
    this.damagePlayer(25);
    this.cameras.main.shake(250, 0.018);
  }

  // ─────────────────────────────────────────────
  //  EXPLOSIONS & EFFECTS
  // ─────────────────────────────────────────────

  triggerRocketExplosion(x, y) {
    this._rocketBlast(x, y);
    this.enemies.getChildren().forEach(enemy => {
      if (!enemy.active) return;
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= ROCKET_AOE_RADIUS)
        this.killEnemy(enemy);
    });
    this.cameras.main.shake(320, 0.014);
    this.score += 5 * this.wave;
  }

  // Rocket visual only (for boss hit — no AOE enemy kill)
  triggerRocketExplosionNoDmg(x, y) {
    this._rocketBlast(x, y);
    this.cameras.main.shake(200, 0.010);
  }

  _rocketBlast(x, y) {
    const outer = this.add.circle(x, y, 8, 0xff6600, 0.9).setDepth(15);
    this.tweens.add({ targets: outer, radius: ROCKET_AOE_RADIUS, alpha: 0, duration: 420, onComplete: () => outer.destroy() });
    const inner = this.add.circle(x, y, 6, 0xffee44, 1).setDepth(16);
    this.tweens.add({ targets: inner, radius: ROCKET_AOE_RADIUS * 0.55, alpha: 0, duration: 280, onComplete: () => inner.destroy() });
  }

  triggerIceExplosion(x, y) {
    // Visual
    const outer = this.add.circle(x, y, 10, 0x0066ff, 0.85).setDepth(15);
    this.tweens.add({ targets: outer, radius: ICE_AOE_RADIUS, alpha: 0, duration: 600, onComplete: () => outer.destroy() });
    const mid = this.add.circle(x, y, 8, 0x88ddff, 0.7).setDepth(16);
    this.tweens.add({ targets: mid, radius: ICE_AOE_RADIUS * 0.65, alpha: 0, duration: 450, onComplete: () => mid.destroy() });
    const core = this.add.circle(x, y, 6, 0xffffff, 1).setDepth(17);
    this.tweens.add({ targets: core, radius: 40, alpha: 0, duration: 250, onComplete: () => core.destroy() });
    const sg = this.add.graphics().setDepth(16);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      sg.lineStyle(2, 0xaaddff, 0.7);
      sg.lineBetween(x, y, x + Math.cos(a) * ICE_AOE_RADIUS * 0.5, y + Math.sin(a) * ICE_AOE_RADIUS * 0.5);
    }
    this.tweens.add({ targets: sg, alpha: 0, duration: 600, onComplete: () => sg.destroy() });
    this.cameras.main.flash(120, 100, 180, 255, false);
    this.cameras.main.shake(180, 0.008);

    // Damage + slow regular enemies
    this.enemies.getChildren().filter(e => e.active).forEach(enemy => {
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

  triggerZapChain(x, y) {
    const flash = this.add.circle(x, y, 8, 0xffff00, 1).setDepth(17);
    this.tweens.add({ targets: flash, radius: 60, alpha: 0, duration: 300, onComplete: () => flash.destroy() });

    let hitsLeft = ZAP_HITS;
    const doZapHit = () => {
      if (hitsLeft <= 0) return;
      hitsLeft--;

      // Hit all active regular enemies
      this.enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        this.showZapOnEnemy(enemy.x, enemy.y);
        this.flashZap(enemy);
        enemy.health -= ZAP_DAMAGE;
        if (enemy.health <= 0) this.killEnemy(enemy);
      });

      // Hit boss with each ZAP wave
      if (this.boss && this.boss.active) {
        this.showZapOnEnemy(this.boss.x, this.boss.y);
        this.damageBoss(ZAP_DAMAGE);
      }

      const ring = this.add.circle(x, y, 5, 0xffff00, 0.6).setDepth(15);
      this.tweens.add({ targets: ring, radius: 50 + (ZAP_HITS - hitsLeft) * 30, alpha: 0, duration: 350, onComplete: () => ring.destroy() });

      if (hitsLeft > 0) this.time.delayedCall(ZAP_INTERVAL, doZapHit);
    };
    doZapHit();
  }

  showZapOnEnemy(x, y) {
    const g = this.add.graphics().setDepth(18);
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
    this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
  }

  flashEnemy(enemy) {
    this.tweens.add({ targets: enemy, alpha: 0.2, duration: 40, yoyo: true });
  }

  flashZap(enemy) {
    this.tweens.add({
      targets: enemy, alpha: 0.2, duration: 40, yoyo: true,
      onComplete: () => { if (enemy.active) enemy.setAlpha(1); },
    });
  }

  killEnemy(enemy) {
    this.score     += 10 * this.wave;
    this.killCount += 1;
    const exp = this.add.circle(enemy.x, enemy.y, 6, 0xff5500, 1).setDepth(15);
    this.tweens.add({ targets: exp, radius: 28, alpha: 0, duration: 280, onComplete: () => exp.destroy() });
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
    this.player.setVelocity(0, 0).setTint(0xff2200);
    this.thrMain.clear(); this.thrLeft.clear(); this.thrRight.clear();
    this.enemySpawnEvent.remove();
    this.enemyFireEvent.remove();
    if (this.bossFireTimer)  { this.bossFireTimer.remove();  this.bossFireTimer  = null; }
    if (this.bossSpecTimer)  { this.bossSpecTimer.remove();  this.bossSpecTimer  = null; }
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
    [this.bullets, this.rockets, this.enemies, this.enemyBullets].forEach(group => {
      group.getChildren().forEach(obj => {
        if (obj.y > this.H + margin || obj.y < -margin || obj.x < -margin || obj.x > this.W + margin)
          obj.destroy();
      });
    });
    // Ice/zap rockets that fly off-screen without hitting → trigger effects anyway
    [this.iceRockets, this.zapRockets].forEach((group, idx) => {
      group.getChildren().forEach(obj => {
        if (obj.y > this.H + margin || obj.y < -margin || obj.x < -margin || obj.x > this.W + margin) {
          if (idx === 0) this.triggerIceExplosion(obj.x, Math.max(obj.y, 20));
          else            this.triggerZapChain(obj.x, Math.max(obj.y, 20));
          obj.destroy();
        }
      });
    });
  }
}

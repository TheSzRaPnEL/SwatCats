import { PLAYER_W, PLAYER_H } from '../constants/gameConstants.js';

export class TextureFactory {
  constructor(scene) {
    this.scene = scene;
  }

  createAll() {
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
    if (this.scene.textures.exists('player')) return;
    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
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
    if (this.scene.textures.exists('enemy')) return;
    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
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

  makeBossTexture() {
    if (this.scene.textures.exists('boss')) return;
    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
    this._drawBossHull(g);
    this._drawBossDetails(g);
    g.generateTexture('boss', 128, 100);
    g.destroy();
  }

  _drawBossHull(g) {
    const cx = 64;
    g.fillStyle(0x150606);
    g.fillPoints([
      { x:cx,    y:8   }, { x:cx+14,  y:20  }, { x:126,   y:56  },
      { x:110,   y:72  }, { x:cx+22,  y:84  }, { x:cx+14,  y:96  },
      { x:cx,    y:100 }, { x:cx-14,  y:96  }, { x:cx-22,  y:84  },
      { x:18,    y:72  }, { x:2,      y:56  }, { x:cx-14,  y:20  },
    ], true);
    g.fillStyle(0xcc4400);
    g.fillPoints([{ x:cx+14,y:20 },{ x:126,y:56 },{ x:110,y:62 },{ x:cx+18,y:28 }], true);
    g.fillPoints([{ x:cx-14,y:20 },{ x:2,  y:56 },{ x:18, y:62 },{ x:cx-18,y:28 }], true);
    g.fillStyle(0x880000);
    g.fillPoints([{ x:cx+20,y:32 },{ x:112,y:58 },{ x:100,y:68 },{ x:cx+28,y:48 }], true);
    g.fillPoints([{ x:cx-20,y:32 },{ x:16, y:58 },{ x:28, y:68 },{ x:cx-28,y:48 }], true);
    g.fillStyle(0x660000);
    g.fillPoints([{ x:cx+30,y:44 },{ x:102,y:64 },{ x:92,  y:70 },{ x:cx+38,y:56 }], true);
    g.fillPoints([{ x:cx-30,y:44 },{ x:26, y:64 },{ x:36,  y:70 },{ x:cx-38,y:56 }], true);
    g.fillStyle(0x1c0808);
    g.fillPoints([
      { x:cx,    y:8   }, { x:cx+16,  y:22  }, { x:cx+20,  y:42  },
      { x:cx+20,  y:80  }, { x:cx+14,  y:96  }, { x:cx,    y:100 },
      { x:cx-14,  y:96  }, { x:cx-20,  y:80  }, { x:cx-20,  y:42  },
      { x:cx-16,  y:22  },
    ], true);
  }

  _drawBossDetails(g) {
    const cx = 64;
    g.fillStyle(0x220808); g.fillRect(cx-38,44,14,32); g.fillRect(cx+24,44,14,32);
    g.fillStyle(0x3d0000); g.fillRect(cx-37,45,12,30); g.fillRect(cx+25,45,12,30);
    g.fillStyle(0x6b0000); g.fillEllipse(cx,32,24,32);
    g.fillStyle(0xaa0000); g.fillEllipse(cx-3,28,10,16);
    g.fillStyle(0xff2200,0.25); g.fillEllipse(cx-2,27,6,10);
    g.fillStyle(0xff0000,0.35); g.fillEllipse(cx-14,42,20,13); g.fillEllipse(cx+14,42,20,13);
    g.fillStyle(0xff2200);      g.fillEllipse(cx-14,42,14,10); g.fillEllipse(cx+14,42,14,10);
    g.fillStyle(0xff6600);      g.fillEllipse(cx-14,42,9,7);   g.fillEllipse(cx+14,42,9,7);
    g.fillStyle(0xffffff);      g.fillEllipse(cx-14,42,4,3);   g.fillEllipse(cx+14,42,4,3);
    g.fillStyle(0x000000);      g.fillEllipse(cx-14,42,7,9);   g.fillEllipse(cx+14,42,7,9);
    g.lineStyle(2, 0x440000, 0.8);
    for (let i = 0; i < 3; i++) {
      const ox = 24 + i * 11;
      g.lineBetween(cx + ox,     36 + i * 5, cx + ox + 2,  48 + i * 5);
      g.lineBetween(cx - ox,     36 + i * 5, cx - ox - 2,  48 + i * 5);
      g.lineBetween(cx + ox + 4, 38 + i * 5, cx + ox + 6,  50 + i * 5);
      g.lineBetween(cx - ox - 4, 38 + i * 5, cx - ox - 6,  50 + i * 5);
    }
    for (const ex of [cx - 20, cx - 7, cx + 7, cx + 20]) {
      g.fillStyle(0x221100); g.fillEllipse(ex, 88, 9, 11);
      g.fillStyle(0x770000); g.fillEllipse(ex, 88, 6, 8);
      g.fillStyle(0xcc2200); g.fillEllipse(ex, 88, 3, 5);
      g.fillStyle(0xff6600,0.8); g.fillEllipse(ex, 88, 1.5, 2.5);
    }
    g.fillStyle(0x441100); g.fillTriangle(cx, 8, cx-6, 20, cx+6, 20);
    g.fillStyle(0x882200,0.6); g.fillTriangle(cx, 9, cx-3, 16, cx+3, 16);
  }

  makeBulletTexture() {
    if (this.scene.textures.exists('bullet')) return;
    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffff44); g.fillRect(2, 0, 4, 14);
    g.fillStyle(0xffffff); g.fillRect(3, 0, 2, 5);
    g.generateTexture('bullet', 8, 14);
    g.destroy();
  }

  makeBossBulletTexture() {
    if (this.scene.textures.exists('bbullet')) return;
    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xff2200); g.fillRect(1, 0, 6, 16);
    g.fillStyle(0xff6600); g.fillRect(2, 0, 4, 6);
    g.fillStyle(0xffaa00,0.6); g.fillRect(3, 0, 2, 3);
    g.generateTexture('bbullet', 8, 16);
    g.destroy();
  }

  makeEnemyBulletTexture() {
    if (this.scene.textures.exists('ebullet')) return;
    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xff5500); g.fillRect(2, 0, 4, 14);
    g.fillStyle(0xff9900); g.fillRect(3, 0, 2, 4);
    g.generateTexture('ebullet', 8, 14);
    g.destroy();
  }

  makeRocketTexture() {
    if (this.scene.textures.exists('rocket')) return;
    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xdd6600); g.fillRect(5, 6, 10, 20);
    g.fillStyle(0xffaa00); g.fillTriangle(10, 0, 5, 8, 15, 8);
    g.fillStyle(0xff4400);
    g.fillTriangle(5,20,0,28,7,22); g.fillTriangle(15,20,20,28,13,22);
    g.fillStyle(0xffcc44,0.8); g.fillRect(7, 26, 6, 5);
    g.generateTexture('rocket', 20, 32);
    g.destroy();
  }

  makeIceRocketTexture() {
    if (this.scene.textures.exists('iceRocket')) return;
    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
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
    if (this.scene.textures.exists('zapRocket')) return;
    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
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
}

export class Background {
  constructor(scene) {
    this.scene = scene;
    this.W = scene.scale.width;
    this.H = scene.scale.height;
    this.starLayers = [];
  }

  create() {
    this.scene.add.rectangle(0, 0, this.W, this.H, 0x050520).setOrigin(0, 0);
    this.starLayers = [0.4, 0.8, 1.4].map((speed, idx) => {
      const count = 25 + idx * 15;
      const stars = Array.from({ length: count }, () => ({
        x: Phaser.Math.Between(0, this.W),
        y: Phaser.Math.Between(0, this.H),
        r: 0.4 + idx * 0.5,
      }));
      const gfx = this.scene.add.graphics().setDepth(0);
      return { gfx, stars, speed };
    });
    this._draw();
  }

  scroll(delta) {
    const dt = delta / 16.67;
    this.starLayers.forEach(layer => {
      layer.stars.forEach(s => {
        s.y += layer.speed * dt;
        if (s.y > this.H + 2) { s.y = -2; s.x = Phaser.Math.Between(0, this.W); }
      });
    });
    this._draw();
  }

  _draw() {
    this.starLayers.forEach(({ gfx, stars, speed }) => {
      gfx.clear();
      const alpha = 0.4 + speed * 0.2;
      gfx.fillStyle(0xffffff, Math.min(alpha, 1));
      stars.forEach(s => gfx.fillCircle(s.x, s.y, s.r));
    });
  }
}

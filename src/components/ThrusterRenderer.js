export class ThrusterRenderer {
  constructor(scene) {
    this.scene    = scene;
    this.thrMain  = scene.add.graphics().setDepth(9);
    this.thrLeft  = scene.add.graphics().setDepth(9);
    this.thrRight = scene.add.graphics().setDepth(9);
  }

  clear() {
    this.thrMain.clear();
    this.thrLeft.clear();
    this.thrRight.clear();
  }

  update(player, moveX, moveY) {
    const px = player.x;
    const py = player.y;
    const r  = player.rotation;
    this.clear();

    const fwd   = Math.max(0, -moveY);
    const right = Math.max(0,  moveX);
    const left  = Math.max(0, -moveX);

    const backDir  = this._toDir(r, 0, 1);
    const backPerp = { x: backDir.y, y: -backDir.x };
    const mainIntensity = Math.max(0.22, fwd);

    this._drawMainThrusters(px, py, r, mainIntensity, backDir, backPerp);
    if (right > 0.06) this._drawLeftThruster(px, py, r, right);
    if (left  > 0.06) this._drawRightThruster(px, py, r, left);
  }

  _drawMainThrusters(px, py, r, mainIntensity, backDir, backPerp) {
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
  }

  _drawLeftThruster(px, py, r, right) {
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

  _drawRightThruster(px, py, r, left) {
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
}

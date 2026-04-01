import { SUB_ROCKET_WINDOW } from '../constants/gameConstants.js';

export class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.W = scene.scale.width;
    this.H = scene.scale.height;

    // Joystick state (read by GameScene for movement)
    this.joy = { baseX: 72, baseY: 0, dx: 0, dy: 0, active: false, pointerId: null };

    this.isFiring    = false;
    this.subRocketTimer = null;
  }

  create(onRocket, onIce, onZap) {
    this._createFireButton();
    this._createRocketButton(onRocket, onIce, onZap);
    this._createJoystick();
  }

  _createFireButton() {
    const fireBtnX = this.W - 65;
    const fireBtnY = this.H - 80;
    this.fireBtnBg = this.scene.add.rectangle(fireBtnX, fireBtnY, 115, 65, 0x003366, 0.88)
      .setDepth(200).setInteractive().setStrokeStyle(2, 0x00aaff);
    this.scene.add.text(fireBtnX, fireBtnY, 'FIRE', {
      fontSize: '24px', fontFamily: 'Arial Black, sans-serif', color: '#00ddff',
    }).setOrigin(0.5).setDepth(201);
    this.fireBtnBg.on('pointerdown', () => { this.isFiring = true;  });
    this.fireBtnBg.on('pointerup',   () => { this.isFiring = false; });
    this.fireBtnBg.on('pointerout',  () => { this.isFiring = false; });
  }

  _createRocketButton(onRocket, onIce, onZap) {
    const rocketBtnX = this.W - 65;
    const rocketBtnY = this.H - 165;
    this.rocketBtnBg = this.scene.add.rectangle(rocketBtnX, rocketBtnY, 115, 65, 0x884400, 0.88)
      .setDepth(200).setInteractive().setStrokeStyle(2, 0xff8800);
    this.scene.add.text(rocketBtnX, rocketBtnY - 6, 'ROCKET', {
      fontSize: '20px', fontFamily: 'Arial Black, sans-serif', color: '#ffaa00',
    }).setOrigin(0.5).setDepth(201);
    this.rocketCDOverlay = this.scene.add.rectangle(rocketBtnX, rocketBtnY, 115, 65, 0x000000, 0.55)
      .setDepth(202).setVisible(false);
    this.rocketCDTimerTxt = this.scene.add.text(rocketBtnX, rocketBtnY + 6, '', {
      fontSize: '22px', fontFamily: 'Arial Black, sans-serif', color: '#ffffff',
    }).setOrigin(0.5).setDepth(203);
    this.rocketBtnBg.on('pointerdown', onRocket);
    this._createSubRocketButtons(rocketBtnX, rocketBtnY, onIce, onZap);
  }

  _createSubRocketButtons(rocketBtnX, rocketBtnY, onIce, onZap) {
    const subBtnH = 30, subBtnW = 55, subGap = 4;
    const subY    = rocketBtnY - 65 / 2 - subBtnH / 2 - 4;
    const iceBtnX = rocketBtnX - subBtnW / 2 - subGap / 2;
    const zapBtnX = rocketBtnX + subBtnW / 2 + subGap / 2;

    this.iceBtnBg = this.scene.add.rectangle(iceBtnX, subY, subBtnW, subBtnH, 0x002255, 0.92)
      .setDepth(200).setInteractive().setStrokeStyle(2, 0x00aaff).setVisible(false);
    this.iceBtnTxt = this.scene.add.text(iceBtnX, subY, 'ICE', {
      fontSize: '14px', fontFamily: 'Arial Black, sans-serif', color: '#88eeff',
    }).setOrigin(0.5).setDepth(201).setVisible(false);

    this.zapBtnBg = this.scene.add.rectangle(zapBtnX, subY, subBtnW, subBtnH, 0x332200, 0.92)
      .setDepth(200).setInteractive().setStrokeStyle(2, 0xffdd00).setVisible(false);
    this.zapBtnTxt = this.scene.add.text(zapBtnX, subY, 'ZAP', {
      fontSize: '14px', fontFamily: 'Arial Black, sans-serif', color: '#ffee44',
    }).setOrigin(0.5).setDepth(201).setVisible(false);

    this.iceBtnBg.on('pointerdown', onIce);
    this.zapBtnBg.on('pointerdown', onZap);
  }

  _createJoystick() {
    const joyX = 72;
    const joyY = this.H - 110;
    this.joy.baseX = joyX;
    this.joy.baseY = joyY;

    this.joyBase  = this.scene.add.circle(joyX, joyY, 52, 0x001133, 0.65).setDepth(200);
    this.joyThumb = this.scene.add.circle(joyX, joyY, 22, 0x0055aa, 0.9).setDepth(201);

    this.scene.input.on('pointerdown', (ptr) => {
      if (ptr.x < this.W / 2 && !this.joy.active) {
        this.joy.active = true; this.joy.pointerId = ptr.id;
        this.joy.baseX = ptr.x; this.joy.baseY = ptr.y;
        this.joyBase.setPosition(ptr.x, ptr.y);
        this.joyThumb.setPosition(ptr.x, ptr.y);
      }
    });
    this.scene.input.on('pointermove', this._onJoyMove.bind(this));
    this.scene.input.on('pointerup',   this._onJoyUp.bind(this));
  }

  _onJoyMove(ptr) {
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
  }

  _onJoyUp(ptr) {
    if (ptr.id === this.joy.pointerId) {
      this.joy.active = false; this.joy.pointerId = null;
      this.joy.dx = 0; this.joy.dy = 0;
      this.joyThumb.setPosition(this.joy.baseX, this.joy.baseY);
    }
  }

  showSubRocketButtons() {
    [this.iceBtnBg, this.iceBtnTxt, this.zapBtnBg, this.zapBtnTxt]
      .forEach(o => o.setVisible(true).setAlpha(1));
    if (this.subRocketTimer) { this.subRocketTimer.remove(); this.subRocketTimer = null; }
    this.subRocketTimer = this.scene.time.delayedCall(
      SUB_ROCKET_WINDOW, () => this.hideSubRocketButtons()
    );
  }

  hideSubRocketButtons() {
    [this.iceBtnBg, this.iceBtnTxt, this.zapBtnBg, this.zapBtnTxt]
      .forEach(o => o.setVisible(false));
    if (this.subRocketTimer) { this.subRocketTimer.remove(); this.subRocketTimer = null; }
  }

  onRocketFired() {
    this.rocketCDOverlay.setVisible(true);
    this.rocketBtnBg.setFillStyle(0x221100, 0.88);
    this.showSubRocketButtons();
  }

  onRocketReady() {
    this.rocketCDOverlay.setVisible(false);
    this.rocketCDTimerTxt.setText('');
    this.rocketBtnBg.setFillStyle(0x884400, 0.88);
    this.scene.tweens.add({
      targets: this.rocketBtnBg, alpha: 0.3, duration: 150,
      yoyo: true, repeat: 3, onComplete: () => this.rocketBtnBg.setAlpha(1),
    });
  }

  updateCooldownText(remaining) {
    this.rocketCDTimerTxt.setText(Math.ceil(remaining / 1000) + 's');
  }
}

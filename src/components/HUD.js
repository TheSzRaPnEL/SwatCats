export class HUD {
  constructor(scene) {
    this.scene = scene;
    this.W = scene.scale.width;
  }

  create() {
    const d = 100;
    this._createScoreAndWave(d);
    this._createHealthDisplay(d);
    this._createRocketDisplay(d);
    this._createBossBar(d);
  }

  _createScoreAndWave(d) {
    this.scoreTxt = this.scene.add.text(10, 10, 'SCORE: 0', {
      fontSize: '18px', fontFamily: 'Arial Black, sans-serif', color: '#ffffff',
    }).setDepth(d);

    this.waveTxt = this.scene.add.text(this.W - 10, 10, 'WAVE 1', {
      fontSize: '18px', fontFamily: 'Arial Black, sans-serif', color: '#ffcc00',
    }).setOrigin(1, 0).setDepth(d);

    this.scene.add.text(6, 2, 'v0.0.8', {
      fontSize: '10px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
    }).setDepth(d).setAlpha(0.45);
  }

  _createHealthDisplay(d) {
    this.scene.add.text(10, 36, 'HP', {
      fontSize: '13px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa',
    }).setDepth(d);
    this.healthBarBg = this.scene.add.rectangle(36, 43, 160, 12, 0x330000)
      .setOrigin(0, 0.5).setDepth(d);
    this.healthBar = this.scene.add.rectangle(36, 43, 160, 12, 0x00ee44)
      .setOrigin(0, 0.5).setDepth(d + 1);
  }

  _createRocketDisplay(d) {
    this.rocketStatusTxt = this.scene.add.text(this.W - 10, 34, 'ROCKET: READY', {
      fontSize: '13px', fontFamily: 'Arial Black, sans-serif', color: '#ff8800',
    }).setOrigin(1, 0).setDepth(d);
  }

  _createBossBar(d) {
    const bby = 64;
    const bbw = this.W - 24;
    this.bossBarBg   = this.scene.add.rectangle(12, bby, bbw, 18, 0x110000)
      .setOrigin(0).setDepth(d).setVisible(false);
    this.bossBarFill = this.scene.add.rectangle(14, bby + 2, bbw - 4, 14, 0xdd1100)
      .setOrigin(0).setDepth(d + 1).setVisible(false);
    this.bossBarTxt  = this.scene.add.text(this.W / 2, bby + 9, 'BOSS', {
      fontSize: '11px', fontFamily: 'Arial Black, sans-serif', color: '#ff8800',
    }).setOrigin(0.5).setDepth(d + 2).setVisible(false);
  }

  updateScore(score) {
    this.scoreTxt.setText('SCORE: ' + score);
  }

  updateWave(wave) {
    this.waveTxt.setText('WAVE ' + wave);
  }

  updateHealth(playerHealth) {
    const pct = playerHealth / 100;
    this.healthBar.setDisplaySize(Math.max(2, 160 * pct), 12);
    const col = pct > 0.5 ? 0x00ee44 : pct > 0.25 ? 0xffaa00 : 0xff2200;
    this.healthBar.setFillStyle(col);
  }

  updateRocketStatus(rocketReady, cooldownRemaining) {
    if (rocketReady) {
      this.rocketStatusTxt.setText('ROCKET: READY').setColor('#ff8800');
    } else {
      const secs = Math.ceil(cooldownRemaining / 1000);
      this.rocketStatusTxt.setText(`ROCKET: ${secs}s`).setColor('#555555');
    }
  }

  showBossBar(label) {
    this.bossBarTxt.setText(label);
    [this.bossBarBg, this.bossBarFill, this.bossBarTxt].forEach(o => o.setVisible(true));
  }

  hideBossBar() {
    [this.bossBarBg, this.bossBarFill, this.bossBarTxt].forEach(o => o.setVisible(false));
  }

  updateBossBar(boss) {
    if (!boss) return;
    const pct  = boss.health / boss.maxHealth;
    const maxW = this.W - 28;
    this.bossBarFill.setDisplaySize(Math.max(2, maxW * pct), 14);
    const col = pct > 0.5 ? 0xdd1100 : pct > 0.25 ? 0xff5500 : 0xffaa00;
    this.bossBarFill.setFillStyle(col);
  }
}

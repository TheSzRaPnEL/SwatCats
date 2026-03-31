import { audioManager } from '../audio/AudioManager.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.scale;

    // Start pre-rendering music in background (no user gesture needed for OfflineAudioContext)
    audioManager.init();

    this.createStarField();

    // Draw TurboCat silhouette as decoration
    this.createDecorPlane(width / 2, height * 0.52);

    // Title
    this.add.text(width / 2, height * 0.2, 'SWAT', {
      fontSize: '64px',
      fontFamily: 'Arial Black, Impact, sans-serif',
      color: '#00ccff',
      stroke: '#002244',
      strokeThickness: 8,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.3, 'CATS', {
      fontSize: '64px',
      fontFamily: 'Arial Black, Impact, sans-serif',
      color: '#ff8800',
      stroke: '#442200',
      strokeThickness: 8,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.41, 'TurboCat Air Combat', {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#88ccff',
      stroke: '#001133',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Controls hint
    const hints = [
      'WASD / Arrows  — Move',
      'Hold SPACE      — Fire',
      'R key           — Rocket (5s cooldown)',
    ];
    hints.forEach((line, i) => {
      this.add.text(width / 2, height * 0.72 + i * 24, line, {
        fontSize: '14px',
        fontFamily: 'Courier New, monospace',
        color: '#668899',
      }).setOrigin(0.5);
    });

    // Start button
    const btn = this.add.text(width / 2, height * 0.62, '[ TAP TO FLY ]', {
      fontSize: '26px',
      fontFamily: 'Arial Black, sans-serif',
      color: '#ffcc00',
      stroke: '#664400',
      strokeThickness: 5,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.tweens.add({
      targets: btn,
      alpha: 0.15,
      duration: 650,
      yoyo: true,
      repeat: -1,
    });

    const startGame = () => {
      audioManager.startMusic();
      this.scene.start('GameScene');
    };

    btn.on('pointerdown', startGame);
    this.input.keyboard.on('keydown-SPACE', startGame);
    this.input.keyboard.on('keydown-ENTER', startGame);
  }

  createStarField() {
    const { width, height } = this.scale;
    const gfx = this.add.graphics();
    for (let i = 0; i < 120; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const r = Math.random() * 1.5 + 0.3;
      const a = Math.random() * 0.7 + 0.3;
      gfx.fillStyle(0xffffff, a);
      gfx.fillCircle(x, y, r);
    }
  }

  createDecorPlane(x, y) {
    const gfx = this.add.graphics();
    gfx.fillStyle(0x003355, 0.6);
    // Body
    gfx.fillTriangle(x, y - 50, x - 12, y + 20, x + 12, y + 20);
    // Wings
    gfx.fillStyle(0x004466, 0.6);
    gfx.fillTriangle(x, y, x - 60, y + 30, x + 60, y + 30);
    // Tail
    gfx.fillStyle(0x003355, 0.5);
    gfx.fillTriangle(x - 8, y + 15, x - 28, y + 40, x, y + 25);
    gfx.fillTriangle(x + 8, y + 15, x + 28, y + 40, x, y + 25);
  }
}

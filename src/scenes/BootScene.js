export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // All graphics are drawn procedurally - no external assets needed
  }

  create() {
    this.scene.start('MenuScene');
  }
}

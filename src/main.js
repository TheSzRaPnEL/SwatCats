import * as THREE from 'three';
import { audioManager } from './audio/AudioManager.js';
import { GameScene } from './scenes/GameScene.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const game = new GameScene();
audioManager.init();

function resize() {
  const W = window.innerWidth, H = window.innerHeight;
  renderer.setSize(W, H);
  game.camera.aspect = W / H;
  game.camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let last = 0;
function loop(ts) {
  const delta = Math.min((ts - last) / 1000, 0.05);
  last = ts;
  game.update(delta);
  renderer.render(game.threeScene, game.camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

export class HUD {
  constructor() {
    this._shakeTimer = null;
    this._flashTimer = null;
    this._waveBannerTimer = null;
    this._createDOM();
  }

  // ── DOM construction ──────────────────────────────────────────────────────

  _createDOM() {
    const S = (el, css) => Object.assign(el.style, css);
    const div = (css = {}, html = '') => {
      const el = document.createElement('div');
      S(el, css);
      el.innerHTML = html;
      return el;
    };

    // Root overlay — pointer-events none so Three.js canvas gets touch/mouse
    this.root = div({
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '50',
      fontFamily: '"Arial Black", Arial, sans-serif',
    });
    document.body.appendChild(this.root);

    // ── HUD layer (game running) ───────────────────────────────────────────
    this.hudLayer = div({ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', display: 'none' });
    this.root.appendChild(this.hudLayer);

    this.scoreTxt = div({ position: 'absolute', top: '10px', left: '10px', color: '#fff', fontSize: '18px', textShadow: '0 0 6px #000' }, 'SCORE: 0');
    this.hudLayer.appendChild(this.scoreTxt);

    this.waveTxt = div({ position: 'absolute', top: '10px', right: '10px', color: '#ffcc00', fontSize: '18px', textShadow: '0 0 6px #000' }, 'WAVE 1');
    this.hudLayer.appendChild(this.waveTxt);

    this.versionTxt = div({ position: 'absolute', top: '2px', left: '6px', color: 'rgba(255,255,255,0.45)', fontSize: '10px' }, 'v0.1.0-3D');
    this.hudLayer.appendChild(this.versionTxt);

    // Health bar
    this.hudLayer.appendChild(div({ position: 'absolute', top: '36px', left: '10px', color: '#aaa', fontSize: '13px' }, 'HP'));
    const hpTrack = div({ position: 'absolute', top: '43px', left: '36px', width: '160px', height: '12px', background: '#330000', borderRadius: '3px' });
    this.healthBar = div({ width: '100%', height: '100%', background: '#00ee44', borderRadius: '3px', transition: 'width 0.1s' });
    hpTrack.appendChild(this.healthBar);
    this.hudLayer.appendChild(hpTrack);

    // Rocket status
    this.rocketTxt = div({ position: 'absolute', top: '34px', right: '10px', color: '#ff8800', fontSize: '13px', textAlign: 'right' }, 'ROCKET: READY');
    this.hudLayer.appendChild(this.rocketTxt);

    // Boss bar
    this.bossBarWrap = div({ position: 'absolute', top: '64px', left: '12px', right: '12px', display: 'none' });
    const bossTrack = div({ width: '100%', height: '18px', background: '#110000', borderRadius: '3px', position: 'relative' });
    this.bossBarFill = div({ width: '100%', height: '100%', background: '#dd1100', borderRadius: '3px', transition: 'width 0.1s' });
    bossTrack.appendChild(this.bossBarFill);
    this.bossTxt = div({
      position: 'absolute', top: '1px', left: '0', width: '100%',
      textAlign: 'center', color: '#ff8800', fontSize: '11px', lineHeight: '16px',
    }, 'BOSS');
    bossTrack.appendChild(this.bossTxt);
    this.bossBarWrap.appendChild(bossTrack);
    this.hudLayer.appendChild(this.bossBarWrap);

    // Screen flash overlay
    this.flashEl = div({
      position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
      background: 'rgba(255,0,0,0)', pointerEvents: 'none',
    });
    this.hudLayer.appendChild(this.flashEl);

    // Wave banner
    this.waveBanner = div({
      position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%,-50%)',
      color: '#ffcc00', fontSize: '48px', textShadow: '0 0 12px #664400',
      display: 'none',
    });
    this.hudLayer.appendChild(this.waveBanner);

    // ── Menu overlay ──────────────────────────────────────────────────────
    this.menuLayer = div({
      position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'all',
    });
    this.root.appendChild(this.menuLayer);

    this.menuLayer.innerHTML = `
      <div style="color:#00ccff;font-size:64px;text-shadow:0 0 18px #002244">SWAT</div>
      <div style="color:#ff8800;font-size:64px;text-shadow:0 0 18px #442200;margin-top:-12px">CATS</div>
      <div style="color:#88ccff;font-size:18px;margin-top:8px">TurboCat Air Combat — 3D</div>
      <div id="menu-start-btn" style="margin-top:36px;color:#ffcc00;font-size:26px;cursor:pointer;
        text-shadow:0 0 10px #664400;padding:10px 28px;border:2px solid #664400;border-radius:4px;
        animation:blink 1.3s ease-in-out infinite alternate">[ TAP TO FLY ]</div>
      <div style="margin-top:36px;color:#668899;font-size:14px;font-family:monospace;text-align:center;line-height:1.8">
        WASD / Arrows — Move<br>Hold SPACE — Fire<br>R key — Rocket (5s cooldown)
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `@keyframes blink { from {opacity:1} to {opacity:0.15} }`;
    document.head.appendChild(style);

    // ── Game Over overlay ─────────────────────────────────────────────────
    this.gameOverLayer = div({
      position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
      display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'all',
    });
    this.root.appendChild(this.gameOverLayer);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  showMenu(onStart) {
    this.menuLayer.style.display = 'flex';
    this.hudLayer.style.display  = 'none';
    this.gameOverLayer.style.display = 'none';
    const btn = document.getElementById('menu-start-btn');
    if (btn) btn.onclick = onStart;
    document.addEventListener('keydown', function handler(e) {
      if (e.code === 'Space' || e.code === 'Enter') {
        document.removeEventListener('keydown', handler);
        onStart();
      }
    });
  }

  showGame(wave) {
    this.menuLayer.style.display    = 'none';
    this.gameOverLayer.style.display = 'none';
    this.hudLayer.style.display     = 'block';
    this.waveTxt.textContent = 'WAVE ' + wave;
    this.scoreTxt.textContent = 'SCORE: 0';
  }

  showGameOver(score, wave, onRestart) {
    this.gameOverLayer.style.display = 'flex';
    this.gameOverLayer.innerHTML = `
      <div style="background:rgba(0,0,0,0.88);padding:36px 48px;border-radius:8px;text-align:center">
        <div style="color:#ff2200;font-size:40px">GAME OVER</div>
        <div style="color:#fff;font-size:26px;margin-top:14px">SCORE: ${score}</div>
        <div style="color:#ffcc00;font-size:20px;margin-top:6px">WAVE: ${wave}</div>
        <div id="go-restart" style="margin-top:24px;color:#ffcc00;font-size:24px;cursor:pointer;
          padding:10px 24px;border:2px solid #664400;border-radius:4px;
          animation:blink 1.3s ease-in-out infinite alternate">[ PLAY AGAIN ]</div>
      </div>
    `;
    document.getElementById('go-restart').onclick = onRestart;
    document.addEventListener('keydown', function handler(e) {
      if (e.code === 'Space' || e.code === 'Enter') {
        document.removeEventListener('keydown', handler);
        onRestart();
      }
    });
  }

  hideGameOver() {
    this.gameOverLayer.style.display = 'none';
  }

  updateScore(score) {
    this.scoreTxt.textContent = 'SCORE: ' + score;
  }

  updateWave(wave) {
    this.waveTxt.textContent = 'WAVE ' + wave;
  }

  updateHealth(hp) {
    const pct = Math.max(0, hp / 100) * 100;
    this.healthBar.style.width = pct + '%';
    const col = hp > 50 ? '#00ee44' : hp > 25 ? '#ffaa00' : '#ff2200';
    this.healthBar.style.background = col;
  }

  updateRocketStatus(ready, remaining) {
    if (ready) {
      this.rocketTxt.textContent = 'ROCKET: READY';
      this.rocketTxt.style.color = '#ff8800';
    } else {
      this.rocketTxt.textContent = `ROCKET: ${Math.ceil(remaining / 1000)}s`;
      this.rocketTxt.style.color = '#555';
    }
  }

  showBossBar(label) {
    this.bossTxt.textContent = label;
    this.bossBarWrap.style.display = 'block';
    this.bossBarFill.style.width = '100%';
  }

  hideBossBar() {
    this.bossBarWrap.style.display = 'none';
  }

  updateBossBar(pct) {
    this.bossBarFill.style.width = Math.max(0, pct * 100) + '%';
    const col = pct > 0.5 ? '#dd1100' : pct > 0.25 ? '#ff5500' : '#ffaa00';
    this.bossBarFill.style.background = col;
  }

  showWaveBanner(wave) {
    this.waveBanner.textContent = 'WAVE ' + wave;
    this.waveBanner.style.display = 'block';
    clearTimeout(this._waveBannerTimer);
    this._waveBannerTimer = setTimeout(() => {
      this.waveBanner.style.display = 'none';
    }, 1600);
  }

  flashRed() {
    this.flashEl.style.background = 'rgba(255,0,0,0.35)';
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      this.flashEl.style.background = 'rgba(255,0,0,0)';
    }, 100);
  }

  screenShake() {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    canvas.style.transition = 'none';
    const frames = 6;
    let f = 0;
    const shake = () => {
      if (f++ >= frames) { canvas.style.transform = ''; return; }
      const dx = (Math.random() - 0.5) * 10;
      const dy = (Math.random() - 0.5) * 10;
      canvas.style.transform = `translate(${dx}px,${dy}px)`;
      requestAnimationFrame(shake);
    };
    shake();
  }

  // Boss special ability overlays (DOM elements shown during special)
  showBossSpecial(safeZones, canvasW, canvasH, onExpire) {
    if (this._specOverlay) this._specOverlay.remove();

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      background:rgba(200,0,0,0.42);pointer-events:none;
      animation:specFlicker 0.24s ease-in-out infinite alternate;
    `;

    const warnTxt = document.createElement('div');
    warnTxt.textContent = '⚡ DANGER — DODGE! ⚡';
    warnTxt.style.cssText = `
      position:absolute;top:42%;left:50%;transform:translate(-50%,-50%);
      color:#ff3300;font-size:26px;text-shadow:0 0 8px #000;
      animation:blink 0.18s ease-in-out infinite alternate;
    `;
    overlay.appendChild(warnTxt);

    // Safe zone markers — positioned relative to canvas coords
    safeZones.forEach(sz => {
      const r = sz.screenR;
      const marker = document.createElement('div');
      marker.style.cssText = `
        position:absolute;
        left:${sz.screenX - r}px;top:${sz.screenY - r}px;
        width:${r * 2}px;height:${r * 2}px;
        border-radius:50%;background:rgba(0,255,136,0.38);
        border:3px solid #00ffaa;
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:14px;font-weight:bold;
        animation:specFlicker 0.28s ease-in-out infinite alternate;
      `;
      marker.textContent = 'SAFE';
      overlay.appendChild(marker);
    });

    const styleTag = document.createElement('style');
    styleTag.textContent = `@keyframes specFlicker { from{opacity:1} to{opacity:0.45} }`;
    overlay.appendChild(styleTag);

    this.hudLayer.appendChild(overlay);
    this._specOverlay = overlay;

    clearTimeout(this._specTimer);
    this._specTimer = setTimeout(() => {
      overlay.remove();
      this._specOverlay = null;
      if (onExpire) onExpire();
    }, 1500);
  }

  hideBossSpecial() {
    if (this._specOverlay) { this._specOverlay.remove(); this._specOverlay = null; }
  }
}

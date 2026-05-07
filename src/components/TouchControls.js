import { SUB_ROCKET_WINDOW } from '../constants/gameConstants.js';

export class TouchControls {
  constructor(scene) {
    this.scene = scene;

    this.joy = { dx: 0, dy: 0, active: false, pointerId: null, baseX: 0, baseY: 0 };
    this.isFiring = false;

    this._subRocketTimer = null;
    this._onRocket = null;
    this._onIce    = null;
    this._onZap    = null;
    this._onPoison = null;

    this._createDOM();
    this._bindEvents();
  }

  // ── DOM construction ──────────────────────────────────────────────────────

  _createDOM() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      pointer-events:none;z-index:60;
    `;
    document.body.appendChild(this.container);

    this.joyBase  = this._circle(52, 'rgba(0,17,51,0.65)', 200);
    this.joyThumb = this._circle(22, 'rgba(0,85,170,0.9)',  201);

    this.fireBtn   = this._btn('FIRE',   '#00ddff', 'rgba(0,51,102,0.88)', '#00aaff');
    this.rocketBtn = this._btn('ROCKET', '#ffaa00', 'rgba(136,68,0,0.88)', '#ff8800');

    this.rocketCDOverlay = document.createElement('div');
    this.rocketCDOverlay.style.cssText = `
      position:absolute;width:115px;height:65px;
      background:rgba(0,0,0,0.55);border-radius:4px;
      display:none;align-items:center;justify-content:center;
      color:#fff;font-size:22px;font-family:"Arial Black",sans-serif;
      pointer-events:none;z-index:205;
    `;
    this.container.appendChild(this.rocketCDOverlay);

    // Sub-rocket buttons (hidden by default)
    this.iceBtn    = this._subBtn('ICE',  '#88eeff', 'rgba(0,34,85,0.92)',  '#00aaff');
    this.zapBtn    = this._subBtn('ZAP',  '#ffee44', 'rgba(51,34,0,0.92)',  '#ffdd00');
    this.poisonBtn = this._subBtn('PSN',  '#88ff44', 'rgba(10,34,0,0.92)',  '#55ff00');

    this._positionButtons();
  }

  _circle(r, bg, z) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute;width:${r*2}px;height:${r*2}px;border-radius:50%;
      background:${bg};pointer-events:none;z-index:${z};
      transform:translate(-50%,-50%);display:none;
    `;
    this.container.appendChild(el);
    return el;
  }

  _btn(label, color, bg, border) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute;width:115px;height:65px;border-radius:4px;
      background:${bg};border:2px solid ${border};
      display:flex;align-items:center;justify-content:center;
      color:${color};font-size:${label.length > 4 ? '18px' : '24px'};
      font-family:"Arial Black",sans-serif;cursor:pointer;
      pointer-events:all;z-index:200;user-select:none;
    `;
    el.textContent = label;
    this.container.appendChild(el);
    return el;
  }

  _subBtn(label, color, bg, border) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute;width:42px;height:30px;border-radius:3px;
      background:${bg};border:2px solid ${border};
      display:none;align-items:center;justify-content:center;
      color:${color};font-size:13px;font-family:"Arial Black",sans-serif;
      cursor:pointer;pointer-events:all;z-index:200;user-select:none;
    `;
    el.textContent = label;
    this.container.appendChild(el);
    return el;
  }

  _positionButtons() {
    const W = window.innerWidth, H = window.innerHeight;

    const fireBtnX = W - 65, fireBtnY = H - 80;
    this.fireBtn.style.left   = (fireBtnX - 57) + 'px';
    this.fireBtn.style.top    = (fireBtnY - 32) + 'px';

    const rktBtnX = W - 65, rktBtnY = H - 165;
    this.rocketBtn.style.left = (rktBtnX - 57) + 'px';
    this.rocketBtn.style.top  = (rktBtnY - 32) + 'px';

    this.rocketCDOverlay.style.left = (rktBtnX - 57) + 'px';
    this.rocketCDOverlay.style.top  = (rktBtnY - 32) + 'px';

    const subY = rktBtnY - 32 - 34;
    this.iceBtn.style.left    = (rktBtnX - 57 - 46) + 'px';
    this.iceBtn.style.top     = subY + 'px';
    this.zapBtn.style.left    = (rktBtnX - 21) + 'px';
    this.zapBtn.style.top     = subY + 'px';
    this.poisonBtn.style.left = (rktBtnX + 25) + 'px';
    this.poisonBtn.style.top  = subY + 'px';

    window.addEventListener('resize', () => this._positionButtons());
  }

  // ── Event binding ─────────────────────────────────────────────────────────

  _bindEvents() {
    // Fire button
    this.fireBtn.addEventListener('pointerdown',  () => { this.isFiring = true; });
    this.fireBtn.addEventListener('pointerup',    () => { this.isFiring = false; });
    this.fireBtn.addEventListener('pointerleave', () => { this.isFiring = false; });

    // Rocket button — assigned by init()
    this.rocketBtn.addEventListener('pointerdown', () => { if (this._onRocket) this._onRocket(); });
    this.iceBtn.addEventListener('pointerdown',    () => { if (this._onIce)    this._onIce(); });
    this.zapBtn.addEventListener('pointerdown',    () => { if (this._onZap)    this._onZap(); });
    this.poisonBtn.addEventListener('pointerdown', () => { if (this._onPoison) this._onPoison(); });

    // Joystick — left half of screen
    document.addEventListener('pointerdown', (e) => {
      if (e.clientX < window.innerWidth / 2 && !this.joy.active) {
        this.joy.active    = true;
        this.joy.pointerId = e.pointerId;
        this.joy.baseX     = e.clientX;
        this.joy.baseY     = e.clientY;
        this.joyBase.style.left = e.clientX + 'px';
        this.joyBase.style.top  = e.clientY + 'px';
        this.joyBase.style.display  = 'block';
        this.joyThumb.style.left = e.clientX + 'px';
        this.joyThumb.style.top  = e.clientY + 'px';
        this.joyThumb.style.display = 'block';
      }
    });

    document.addEventListener('pointermove', (e) => {
      if (!this.joy.active || e.pointerId !== this.joy.pointerId) return;
      const dx = e.clientX - this.joy.baseX;
      const dy = e.clientY - this.joy.baseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const max  = 42;
      const clamped = Math.min(dist, max);
      const angle   = Math.atan2(dy, dx);
      const tx = this.joy.baseX + Math.cos(angle) * clamped;
      const ty = this.joy.baseY + Math.sin(angle) * clamped;
      this.joyThumb.style.left = tx + 'px';
      this.joyThumb.style.top  = ty + 'px';
      this.joy.dx = (dx / (dist || 1)) * Math.min(1, dist / max);
      this.joy.dy = (dy / (dist || 1)) * Math.min(1, dist / max);
    });

    document.addEventListener('pointerup', (e) => {
      if (e.pointerId === this.joy.pointerId) {
        this.joy.active = false;
        this.joy.pointerId = null;
        this.joy.dx = 0;
        this.joy.dy = 0;
        this.joyBase.style.display  = 'none';
        this.joyThumb.style.display = 'none';
      }
    });
  }

  // ── Called by WeaponSystem / GameScene ────────────────────────────────────

  init(onRocket, onIce, onZap, onPoison) {
    this._onRocket = onRocket;
    this._onIce    = onIce;
    this._onZap    = onZap;
    this._onPoison = onPoison;
  }

  showSubRocketButtons() {
    [this.iceBtn, this.zapBtn, this.poisonBtn].forEach(b => b.style.display = 'flex');
    clearTimeout(this._subRocketTimer);
    this._subRocketTimer = setTimeout(() => this.hideSubRocketButtons(), SUB_ROCKET_WINDOW);
  }

  hideSubRocketButtons() {
    [this.iceBtn, this.zapBtn, this.poisonBtn].forEach(b => b.style.display = 'none');
    clearTimeout(this._subRocketTimer);
    this._subRocketTimer = null;
  }

  onRocketFired() {
    this.rocketCDOverlay.style.display = 'flex';
    this.rocketBtn.style.background = 'rgba(34,17,0,0.88)';
    this.showSubRocketButtons();
  }

  onRocketReady() {
    this.rocketCDOverlay.style.display = 'none';
    this.rocketCDOverlay.textContent = '';
    this.rocketBtn.style.background = 'rgba(136,68,0,0.88)';
  }

  updateCooldownText(remaining) {
    this.rocketCDOverlay.textContent = Math.ceil(remaining / 1000) + 's';
  }
}

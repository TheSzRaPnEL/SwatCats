class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicBuffer = null;
    this.musicSource = null;
    this._inited = false;
    this._lastShoot = 0;
  }

  async init() {
    if (this._inited) return;
    this._inited = true;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.35;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 1.0;
    this.sfxGain.connect(this.masterGain);

    this.musicBuffer = await this._renderMusic();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  startMusic() {
    if (!this.ctx || !this.musicBuffer) return;
    this.resume();
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch (e) {}
    }
    this.musicSource = this.ctx.createBufferSource();
    this.musicSource.buffer = this.musicBuffer;
    this.musicSource.loop = true;
    this.musicSource.connect(this.musicGain);
    this.musicSource.start(0);
  }

  stopMusic() {
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch (e) {}
      this.musicSource = null;
    }
  }

  // --- Music rendering ---

  async _renderMusic() {
    const BPM = 128;
    const BARS = 4;
    const beatsPerBar = 4;
    const beatLen = 60 / BPM;
    const totalLen = BARS * beatsPerBar * beatLen; // ~7.5s
    const sr = 44100;
    const off = new OfflineAudioContext(2, Math.ceil(sr * totalLen), sr);

    const masterOut = off.createGain();
    masterOut.gain.value = 0.85;
    masterOut.connect(off.destination);

    this._renderBass(off, masterOut, beatLen, totalLen);
    this._renderArpeggio(off, masterOut, beatLen, totalLen);
    this._renderPad(off, masterOut, totalLen);
    this._renderDrums(off, masterOut, beatLen, BARS * beatsPerBar);

    return off.startRendering();
  }

  // A minor pentatonic: A2, C3, E3, G3, A3
  _renderBass(off, out, beatLen, totalLen) {
    const bassNotes = [110, 130.81, 164.81, 196, 220]; // A2 C3 E3 G3 A3
    const pattern  = [0, 0, 2, 0, 1, 0, 3, 1]; // index into bassNotes
    const stepLen = beatLen / 2;
    const steps = Math.floor(totalLen / stepLen);

    const bassGain = off.createGain();
    bassGain.gain.value = 0.5;
    bassGain.connect(out);

    for (let i = 0; i < steps; i++) {
      const t = i * stepLen;
      const freq = bassNotes[pattern[i % pattern.length]];
      const dur = stepLen * 0.85;

      const osc = off.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      const env = off.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.9, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.4, t + dur * 0.5);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur);

      // Low-pass to keep it deep
      const lpf = off.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 400;
      lpf.Q.value = 2;

      osc.connect(lpf);
      lpf.connect(env);
      env.connect(bassGain);
      osc.start(t);
      osc.stop(t + dur);
    }
  }

  // A minor pentatonic arpeggio: A4, C5, E5, G5, A5
  _renderArpeggio(off, out, beatLen, totalLen) {
    const notes = [440, 523.25, 659.25, 783.99, 880];
    const pattern = [0, 2, 4, 3, 1, 4, 2, 0, 1, 3, 4, 2];
    const stepLen = beatLen / 4; // 16th notes
    const steps = Math.floor(totalLen / stepLen);

    const arpGain = off.createGain();
    arpGain.gain.value = 0.25;
    arpGain.connect(out);

    // Chorus-like effect via two slightly detuned oscs
    for (let detune of [-6, 6]) {
      for (let i = 0; i < steps; i++) {
        const t = i * stepLen;
        const freq = notes[pattern[i % pattern.length]];
        const dur = stepLen * 0.7;

        const osc = off.createOscillator();
        osc.type = 'square';
        osc.frequency.value = freq;
        osc.detune.value = detune;

        const env = off.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.5, t + 0.005);
        env.gain.exponentialRampToValueAtTime(0.001, t + dur);

        const lpf = off.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.value = 2200;

        osc.connect(lpf);
        lpf.connect(env);
        env.connect(arpGain);
        osc.start(t);
        osc.stop(t + dur);
      }
    }
  }

  // Cosmic pad — sustained chord A3 C4 E4 G4
  _renderPad(off, out, totalLen) {
    const padFreqs = [220, 261.63, 329.63, 392];
    const padGain = off.createGain();
    padGain.gain.value = 0.18;
    padGain.connect(out);

    const rev = this._makeOfflineReverb(off);
    if (rev) rev.connect(padGain);

    for (const freq of padFreqs) {
      for (const detune of [-8, 0, 8]) {
        const osc = off.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = detune;

        const env = off.createGain();
        env.gain.setValueAtTime(0, 0);
        env.gain.linearRampToValueAtTime(1, totalLen * 0.1);
        env.gain.setValueAtTime(1, totalLen * 0.85);
        env.gain.linearRampToValueAtTime(0, totalLen);

        osc.connect(env);
        if (rev) env.connect(rev);
        else env.connect(padGain);
        osc.start(0);
        osc.stop(totalLen);
      }
    }
  }

  _makeOfflineReverb(off) {
    try {
      const conv = off.createConvolver();
      const len = Math.floor(off.sampleRate * 1.5);
      const buf = off.createBuffer(2, len, off.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
        }
      }
      conv.buffer = buf;
      return conv;
    } catch (e) {
      return null;
    }
  }

  _renderDrums(off, out, beatLen, totalBeats) {
    const drumGain = off.createGain();
    drumGain.gain.value = 0.7;
    drumGain.connect(out);

    for (let beat = 0; beat < totalBeats; beat++) {
      const t = beat * beatLen;

      // Kick on beats 1 and 3 of each bar
      if (beat % 4 === 0 || beat % 4 === 2) {
        this._offlineKick(off, drumGain, t);
      }

      // Snare on beats 2 and 4
      if (beat % 4 === 1 || beat % 4 === 3) {
        this._offlineSnare(off, drumGain, t);
      }

      // Hi-hat every 8th note
      for (let sub = 0; sub < 2; sub++) {
        this._offlineHihat(off, drumGain, t + sub * beatLen * 0.5);
      }

      // Open hi-hat on upbeat of beat 2
      if (beat % 4 === 1) {
        this._offlineHihat(off, drumGain, t + beatLen * 0.75, true);
      }
    }
  }

  _offlineKick(off, out, t) {
    const osc = off.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);

    const env = off.createGain();
    env.gain.setValueAtTime(1.2, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(env);
    env.connect(out);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  _offlineSnare(off, out, t) {
    const bufSize = Math.floor(off.sampleRate * 0.15);
    const buf = off.createBuffer(1, bufSize, off.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

    const src = off.createBufferSource();
    src.buffer = buf;

    const hpf = off.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 1800;

    const env = off.createGain();
    env.gain.setValueAtTime(0.8, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    // Tone layer
    const tone = off.createOscillator();
    tone.type = 'triangle';
    tone.frequency.value = 200;
    const toneEnv = off.createGain();
    toneEnv.gain.setValueAtTime(0.3, t);
    toneEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    tone.connect(toneEnv);
    toneEnv.connect(out);
    tone.start(t);
    tone.stop(t + 0.1);

    src.connect(hpf);
    hpf.connect(env);
    env.connect(out);
    src.start(t);
  }

  _offlineHihat(off, out, t, open = false) {
    const bufSize = Math.floor(off.sampleRate * 0.04);
    const buf = off.createBuffer(1, bufSize, off.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

    const src = off.createBufferSource();
    src.buffer = buf;

    const hpf = off.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 7000;

    const dur = open ? 0.12 : 0.04;
    const env = off.createGain();
    env.gain.setValueAtTime(0.3, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(hpf);
    hpf.connect(env);
    env.connect(out);
    src.start(t);
  }

  // --- SFX helpers ---

  _tone(freq, endFreq, dur, type = 'square', vol = 0.4, dest = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t + dur);
    }
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env);
    env.connect(dest || this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  _noise(dur, hpFreq = 100, lpFreq = 8000, vol = 0.4, dest = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const sr = this.ctx.sampleRate;
    const bufLen = Math.ceil(sr * dur);
    const buf = this.ctx.createBuffer(1, bufLen, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const hpf = this.ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = hpFreq;

    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = lpFreq;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(hpf);
    hpf.connect(lpf);
    lpf.connect(env);
    env.connect(dest || this.sfxGain);
    src.start(t);
    return src;
  }

  // --- SFX ---

  sfxShoot() {
    if (!this.ctx) return;
    const now = Date.now();
    if (now - this._lastShoot < 100) return; // throttle: max 10/sec
    this._lastShoot = now;
    this._tone(880, 220, 0.07, 'square', 0.15);
  }

  sfxRocketLaunch() {
    if (!this.ctx) return;
    this._noise(0.35, 200, 4000, 0.5);
    this._tone(80, 40, 0.35, 'sawtooth', 0.4);
  }

  sfxRocketExplode() {
    if (!this.ctx) return;
    this._noise(0.6, 20, 1200, 0.7);
    this._tone(120, 25, 0.5, 'sine', 0.6);
  }

  sfxIceLaunch() {
    if (!this.ctx) return;
    this._noise(0.3, 4000, 18000, 0.35);
    this._tone(1800, 3600, 0.25, 'sine', 0.2);
    this._tone(2400, 1200, 0.25, 'sine', 0.15);
  }

  sfxIceExplode() {
    if (!this.ctx) return;
    // Deep thud
    this._tone(80, 20, 0.6, 'sine', 0.7);
    // Cold noise rush
    this._noise(1.0, 3000, 16000, 0.4);
    // Crystalline overtones
    for (const freq of [1047, 1568, 2093]) {
      this._tone(freq, freq * 0.5, 0.8, 'sine', 0.12);
    }
  }

  sfxZapLaunch() {
    if (!this.ctx) return;
    this._tone(180, 2400, 0.3, 'sawtooth', 0.35);
  }

  sfxZapHit() {
    if (!this.ctx) return;
    // AM-modulated sawtooth crackle
    const t = this.ctx.currentTime;
    const carrier = this.ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(800, t);
    carrier.frequency.exponentialRampToValueAtTime(200, t + 0.15);

    const mod = this.ctx.createOscillator();
    mod.type = 'square';
    mod.frequency.value = 60;

    const modGain = this.ctx.createGain();
    modGain.gain.value = 0.5;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.4, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    mod.connect(modGain);
    modGain.connect(env.gain);
    carrier.connect(env);
    env.connect(this.sfxGain);
    mod.start(t);
    mod.stop(t + 0.2);
    carrier.start(t);
    carrier.stop(t + 0.2);
  }

  sfxPlayerHit() {
    if (!this.ctx) return;
    this._noise(0.2, 300, 3000, 0.5);
    this._tone(220, 110, 0.2, 'triangle', 0.4);
  }

  sfxPlayerDie() {
    if (!this.ctx) return;
    this._noise(1.0, 100, 6000, 0.8);
    this._tone(440, 55, 1.2, 'sawtooth', 0.6);
    this._tone(220, 30, 0.9, 'square', 0.4);
  }

  sfxEnemyDie() {
    if (!this.ctx) return;
    this._tone(600, 150, 0.12, 'square', 0.25);
    this._noise(0.1, 1000, 8000, 0.2);
  }

  sfxBossDie() {
    if (!this.ctx) return;
    // Massive layered explosion
    this._tone(60, 15, 2.0, 'sine', 0.9);
    this._tone(40, 10, 2.5, 'sawtooth', 0.7);
    this._noise(2.0, 30, 8000, 0.9);
    this._noise(1.5, 500, 16000, 0.5);
    // Descending power-down
    this._tone(800, 50, 1.8, 'sawtooth', 0.5);
  }

  sfxWaveComplete() {
    if (!this.ctx) return;
    // Ascending A minor pentatonic jingle: A4 C5 E5 A5
    const notes = [440, 523.25, 659.25, 880];
    const t = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const env = this.ctx.createGain();
      const start = t + i * 0.18;
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(0.35, start + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(env);
      env.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  }
}

export const audioManager = new AudioManager();

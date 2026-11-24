import { computeAmbientAudioParams } from './kioscoLogic';
import type { AmbientAudioParams } from './types';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  // Dynamic horror supermarket ambient audio graph
  private ambientMaster: GainNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windLfo: OscillatorNode | null = null;
  private windLfoGain: GainNode | null = null;
  private fridgeOscA: OscillatorNode | null = null;
  private fridgeOscB: OscillatorNode | null = null;
  private fridgeGain: GainNode | null = null;
  private tensionOsc: OscillatorNode | null = null;
  private tensionGain: GainNode | null = null;
  private ambientSchedulerId: number | null = null;
  private lastCricketTime = 0;
  private lastBirdTime = 0;
  private latestAmbientParams: AmbientAudioParams = computeAmbientAudioParams(0, true, 0);
  private ambientActive = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureContext();
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ambientMaster && this.ctx) {
      const now = this.ctx.currentTime;
      this.ambientMaster.gain.setTargetAtTime(muted || !this.ambientActive ? 0 : 1, now, 0.12);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private ensureAmbientGraph(ctx: AudioContext) {
    if (this.ambientMaster) return;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.ambientMaster = master;

    // 1. Cold night air / exterior parking lot wind
    const length = Math.floor(ctx.sampleRate * 3.5);
    const noiseBuf = ctx.createBuffer(1, length, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.03 * white) / 1.03;
      ch[i] = lastOut * 3.2;
    }

    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuf;
    windSrc.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 1.4;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.06;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.14;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 95;

    lfo.connect(lfoGain).connect(windFilter.frequency);
    windSrc.connect(windFilter).connect(windGain).connect(master);

    windSrc.start();
    lfo.start();

    this.windSource = windSrc;
    this.windFilter = windFilter;
    this.windGain = windGain;
    this.windLfo = lfo;
    this.windLfoGain = lfoGain;

    // 2. Supermarket fluorescent ballast & freezer compressor hum (60Hz / 120Hz)
    const fridgeFilter = ctx.createBiquadFilter();
    fridgeFilter.type = 'lowpass';
    fridgeFilter.frequency.value = 240;

    const fridgeGain = ctx.createGain();
    fridgeGain.gain.value = 0.05;

    const oscA = ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 60;
    const oscB = ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.value = 120;

    const subGainB = ctx.createGain();
    subGainB.gain.value = 0.35;

    oscA.connect(fridgeFilter);
    oscB.connect(subGainB).connect(fridgeFilter);
    fridgeFilter.connect(fridgeGain).connect(master);

    oscA.start();
    oscB.start();

    this.fridgeOscA = oscA;
    this.fridgeOscB = oscB;
    this.fridgeGain = fridgeGain;

    // 3. Sub-bass horror dread drone (rises near 3 AM or critical empty shelves)
    const tensionFilter = ctx.createBiquadFilter();
    tensionFilter.type = 'lowpass';
    tensionFilter.frequency.value = 135;

    const tensionGain = ctx.createGain();
    tensionGain.gain.value = 0.03;

    const tensionOsc = ctx.createOscillator();
    tensionOsc.type = 'sawtooth';
    tensionOsc.frequency.value = 43.5;
    tensionOsc.connect(tensionFilter).connect(tensionGain).connect(master);
    tensionOsc.start();
    this.tensionOsc = tensionOsc;
    this.tensionGain = tensionGain;

    if (typeof window !== 'undefined') {
      this.ambientSchedulerId = window.setInterval(() => {
        this.tickAmbientCreatures();
      }, 280);
    }
  }

  private scheduleCricketChirp(ctx: AudioContext, master: GainNode, intensity: number) {
    const now = ctx.currentTime;
    const pulses = 3 + (Math.random() > 0.45 ? 1 : 0);
    const carrierFreq = 4150 + Math.random() * 520;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = carrierFreq;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = carrierFreq;
    bp.Q.value = 5.5;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);

    const peak = Math.min(0.045, 0.038 * intensity * (0.65 + Math.random() * 0.45));
    for (let i = 0; i < pulses; i++) {
      const start = now + i * 0.042;
      env.gain.linearRampToValueAtTime(peak, start + 0.009);
      env.gain.exponentialRampToValueAtTime(0.0002, start + 0.028);
    }

    osc.connect(bp).connect(env).connect(master);
    const totalDur = pulses * 0.045 + 0.04;
    osc.start(now);
    osc.stop(now + totalDur);
  }

  private scheduleDawnBird(ctx: AudioContext, master: GainNode, intensity: number) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const base = 1850 + Math.random() * 600;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.28, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(base * 0.94, now + 0.19);

    const env = ctx.createGain();
    const peak = Math.min(0.04, 0.036 * intensity);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peak, now + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(env).connect(master);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  private tickAmbientCreatures() {
    if (this.muted || !this.ambientActive || !this.ctx || !this.ambientMaster) return;
    if (this.ctx.state !== 'running') return;

    const nowMs = performance.now();
    const { cricketIntensity, birdIntensity } = this.latestAmbientParams;

    if (cricketIntensity > 0.04) {
      const intervalMs = Math.max(480, 1380 - cricketIntensity * 680) + Math.random() * 480;
      if (nowMs - this.lastCricketTime >= intervalMs) {
        this.lastCricketTime = nowMs;
        this.scheduleCricketChirp(this.ctx, this.ambientMaster, cricketIntensity);
      }
    }

    if (birdIntensity > 0.08) {
      const birdIntervalMs = 2600 + Math.random() * 2600;
      if (nowMs - this.lastBirdTime >= birdIntervalMs) {
        this.lastBirdTime = nowMs;
        this.scheduleDawnBird(this.ctx, this.ambientMaster, birdIntensity);
      }
    }
  }

  public updateAmbient(
    shiftSeconds: number,
    isIndoors: boolean,
    active: boolean,
    criticalCount = 0
  ): AmbientAudioParams {
    const params = computeAmbientAudioParams(shiftSeconds, isIndoors, criticalCount);
    this.latestAmbientParams = params;
    this.ambientActive = active;

    if (this.muted || !active) {
      if (this.ambientMaster && this.ctx) {
        this.ambientMaster.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      }
      return params;
    }

    if (!this.ctx) {
      return params;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.ensureAmbientGraph(this.ctx);
    const now = this.ctx.currentTime;
    this.ambientMaster?.gain.setTargetAtTime(1, now, 0.25);
    this.windGain?.gain.setTargetAtTime(params.windGain, now, 0.35);
    this.windFilter?.frequency.setTargetAtTime(params.windFreq, now, 0.45);
    this.fridgeGain?.gain.setTargetAtTime(params.fridgeHumGain, now, 0.3);
    this.tensionGain?.gain.setTargetAtTime(params.tensionGain, now, 0.4);

    return params;
  }

  public stopAmbient() {
    this.ambientActive = false;
    if (this.ambientSchedulerId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.ambientSchedulerId);
      this.ambientSchedulerId = null;
    }
    try {
      this.windSource?.stop();
      this.windLfo?.stop();
      this.fridgeOscA?.stop();
      this.fridgeOscB?.stop();
      this.tensionOsc?.stop();
    } catch {
      // Ignore already-stopped nodes
    }
    this.windSource = null;
    this.windFilter = null;
    this.windGain = null;
    this.windLfo = null;
    this.windLfoGain = null;
    this.fridgeOscA = null;
    this.fridgeOscB = null;
    this.fridgeGain = null;
    this.tensionOsc = null;
    this.tensionGain = null;
    this.ambientMaster = null;
  }

  public playPickup() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const pitch = 320 * (0.94 + Math.random() * 0.12);
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.45, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  public playRestock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [440, 587.33, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  public playPowerFlicker() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(118, now);
    osc.frequency.linearRampToValueAtTime(62, now + 0.14);
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playPoltergeistDrop() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [220, 145, 88].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      const t = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playShadowWhisper() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.9);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(520, now);
    bp.frequency.exponentialRampToValueAtTime(1150, now + 0.45);
    bp.frequency.exponentialRampToValueAtTime(340, now + 0.9);
    bp.Q.value = 3.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.28);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.88);
    noise.connect(bp).connect(gain).connect(ctx.destination);
    noise.start(now);

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(52, now);
    sub.frequency.linearRampToValueAtTime(36, now + 0.85);
    subGain.gain.setValueAtTime(0.14, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.88);
    sub.connect(subGain).connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.9);
  }

  public playFreezerSlam() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.28);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(640, now);
    lp.frequency.exponentialRampToValueAtTime(110, now + 0.26);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.27);
    noise.connect(lp).connect(gain).connect(ctx.destination);
    noise.start(now);

    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = 'triangle';
    boom.frequency.setValueAtTime(92, now);
    boom.frequency.exponentialRampToValueAtTime(28, now + 0.32);
    boomGain.gain.setValueAtTime(0.28, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    boom.connect(boomGain).connect(ctx.destination);
    boom.start(now);
    boom.stop(now + 0.36);
  }

  public playShiftBell3AM() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.14;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.68);
    });
  }

  public playDropImpact(velocity: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const strength = Math.min(1, Math.max(0.15, velocity / 5.5));
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = 115 * (0.9 + Math.random() * 0.2);
    osc.frequency.setValueAtTime(baseFreq + strength * 60, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.11);
    gain.gain.setValueAtTime(0.18 * strength, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playCashRegister() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [880, 1318.5, 1760];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'square' : 'triangle';
      const t = now + i * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.23);
    });
  }

  public playDoorChime() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [784, 587.33].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.15;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playWeaponCock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.08].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + offset;
      osc.frequency.setValueAtTime(idx === 0 ? 280 : 420, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.05);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.065);
    });
  }

  public playGunshot() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.07));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1900, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.3);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);

    const punch = ctx.createOscillator();
    const punchGain = ctx.createGain();
    punch.type = 'sine';
    punch.frequency.setValueAtTime(140, now);
    punch.frequency.exponentialRampToValueAtTime(34, now + 0.16);
    punchGain.gain.setValueAtTime(0.32, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    punch.connect(punchGain).connect(ctx.destination);
    punch.start(now);
    punch.stop(now + 0.19);
  }

  public playAlarmWarning() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.22].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + offset;
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.linearRampToValueAtTime(340, t + 0.15);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  public playSecretDiscovery() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.085;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.58);
    });
  }
}

export const soundEngine = new SoundEngine();

// BGM 합성 + 유틸 함수 (mirraRenderer.ts에서 분리)
// Web Audio API 기반 — 외부 파일 없이 합성

// ── 타입 ──
export interface MirraScene {
  duration: number;
  bg_type: "gradient" | "photo";
  bg_colors: [string, string];
  badge: string;
  title: string;
  subtitle: string;
  accent_color: string;
  animation: "slide_up" | "slide_left" | "zoom_in" | "fade_in";
  photo: string | null;
  narration: string;
}

export interface VoiceConfig {
  lang: string;
  pitch: number;
  rate: number;
  voiceNameHint: string[];
}

export type BgmType = "upbeat" | "calm" | "hiphop" | "emotional" | "corporate" | "none";

// ── 유틸 함수 ──
export function isIOSDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isRecordingSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

let _logoImg: HTMLImageElement | null = null;
export function preloadLogo(logoUrl: string) {
  if (!logoUrl) { _logoImg = null; return; }
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = logoUrl;
  _logoImg = img;
}

// ── BGM 내부 합성 핵심 함수 (preview/render 공용) ──
function _synthBgm(audioCtx: AudioContext, out: AudioNode, bgmType: BgmType, durationSec: number) {
  const master = audioCtx.createGain();
  master.gain.value = 0.20;
  master.connect(out);
  const t0 = audioCtx.currentTime;

  function kick(t: number, freq = 120, decay = 0.25, vol = 0.8) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(30, t + decay);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + decay + 0.05);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + decay + 0.1);
  }
  function snare(t: number, vol = 0.35) {
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / d.length * 6);
    const s = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
    f.type = "bandpass"; f.frequency.value = 2000; f.Q.value = 0.5;
    s.buffer = buf; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  function hihat(t: number, vol = 0.12, open = false) {
    const dur = open ? 0.12 : 0.03;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
    f.type = "highpass"; f.frequency.value = 9000;
    s.buffer = buf; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  function bass(t: number, freq: number, dur: number, vol = 0.5) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    const lp = audioCtx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 200;
    o.type = "sawtooth"; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.85);
    o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
  }
  function tone(t: number, freq: number, dur: number, vol = 0.2, type: OscillatorType = "triangle") {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.setValueAtTime(vol, t + dur - 0.08); g.gain.linearRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.1);
  }
  function metalHit(t: number, vol = 0.15) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "square"; o.frequency.value = 800 + Math.random() * 400;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.1);
  }

  if (bgmType === "upbeat") {
    const bpm = 130, beat = 60 / bpm;
    const beats = Math.ceil(durationSec / beat);
    const bassPattern = [41.2, 49.0, 55.0, 41.2];
    for (let b = 0; b < beats; b++) {
      const t = t0 + b * beat;
      if (t > t0 + durationSec) break;
      if (b % 4 === 0 || b % 4 === 2) kick(t, 140, 0.3, 0.9);
      if (b % 4 === 1 || b % 4 === 3) snare(t, 0.4);
      for (let s = 0; s < 4; s++) {
        const ht = t + s * beat * 0.25;
        hihat(ht, s % 2 === 0 ? 0.12 : 0.07, s === 2);
      }
      bass(t, bassPattern[b % 4], beat * 0.9, 0.55);
      if (b % 4 === 0) metalHit(t + beat * 0.5, 0.1);
      if (b % 8 === 0) {
        [220, 277, 330, 440].forEach((f, i) => {
          tone(t + i * beat * 0.5, f, beat * 0.4, 0.15, "square");
        });
      }
    }
  } else if (bgmType === "hiphop") {
    const bpm = 85, beat = 60 / bpm;
    const beats = Math.ceil(durationSec / beat);
    const bassSeq = [43.65, 43.65, 55.0, 43.65];
    for (let b = 0; b < beats; b++) {
      const t = t0 + b * beat;
      if (t > t0 + durationSec) break;
      if (b % 4 === 0) kick(t, 180, 0.5, 1.0);
      if (b % 4 === 2) kick(t, 160, 0.35, 0.8);
      if (b % 4 === 1 || b % 4 === 3) snare(t, 0.45);
      for (let s = 0; s < 8; s++) {
        const ht = t + s * beat * 0.125;
        const vel = [0.18, 0.06, 0.14, 0.06, 0.18, 0.08, 0.10, 0.04][s] || 0.06;
        hihat(ht, vel, s === 4);
      }
      bass(t, bassSeq[b % 4], beat * 0.95, 0.6);
      if (b % 2 === 1) hihat(t + beat * 0.75, 0.2, true);
    }
  } else if (bgmType === "corporate") {
    const bpm = 100, beat = 60 / bpm;
    const beats = Math.ceil(durationSec / beat);
    const chordSeq = [
      [130.81, 164.81, 196.00],
      [146.83, 185.00, 220.00],
      [174.61, 220.00, 261.63],
      [130.81, 164.81, 196.00],
    ];
    for (let b = 0; b < beats; b++) {
      const t = t0 + b * beat;
      if (t > t0 + durationSec) break;
      if (b % 4 === 0) kick(t, 100, 0.2, 0.7);
      if (b % 4 === 2) kick(t, 100, 0.15, 0.55);
      if (b % 4 === 1 || b % 4 === 3) snare(t, 0.25);
      if (b % 2 === 0) hihat(t, 0.1); else hihat(t, 0.07);
      if (b % 4 === 0) {
        chordSeq[Math.floor(b / 4) % chordSeq.length].forEach(f => {
          tone(t, f, beat * 3.8, 0.12, "sine");
        });
      }
      bass(t, chordSeq[Math.floor(b / 4) % chordSeq.length][0] / 2, beat * 0.85, 0.45);
    }
  } else if (bgmType === "emotional") {
    const bpm = 76, beat = 60 / bpm;
    const beats = Math.ceil(durationSec / beat);
    const melody = [220.00, 246.94, 261.63, 293.66, 329.63, 293.66, 261.63, 246.94,
                    261.63, 293.66, 329.63, 392.00, 440.00, 392.00, 349.23, 329.63];
    const chords = [
      [220.00, 261.63, 329.63],
      [174.61, 220.00, 261.63],
      [130.81, 164.81, 196.00],
      [196.00, 246.94, 293.66],
    ];
    for (let b = 0; b < beats; b++) {
      const t = t0 + b * beat;
      if (t > t0 + durationSec) break;
      if (b % 4 === 0 || b % 4 === 2) kick(t, 80, 0.15, 0.5);
      if (b % 4 === 1 || b % 4 === 3) snare(t, 0.15);
      hihat(t, 0.06, b % 4 === 2);
      tone(t, melody[b % melody.length] * 0.5, beat * 0.8, 0.22, "triangle");
      if (b % 4 === 0) {
        chords[Math.floor(b / 4) % chords.length].forEach(f => {
          tone(t, f, beat * 3.5, 0.10, "sine");
          tone(t + 0.03, f * 2, beat * 3.5, 0.06, "sine");
        });
      }
      bass(t, chords[Math.floor(b / 4) % chords.length][0] / 2, beat * 0.9, 0.4);
    }
  } else if (bgmType === "calm") {
    const bpm = 90, beat = 60 / bpm;
    const beats = Math.ceil(durationSec / beat);
    const pattern = [130.81, 164.81, 196.00, 130.81];
    for (let b = 0; b < beats; b++) {
      const t = t0 + b * beat;
      if (t > t0 + durationSec) break;
      if (b % 4 === 0) kick(t, 90, 0.12, 0.45);
      if (b % 4 === 2) kick(t, 90, 0.10, 0.3);
      if (b % 4 === 1 || b % 4 === 3) snare(t, 0.12);
      if (b % 2 === 0) hihat(t, 0.07);
      const noteT = t;
      pattern.forEach((f, i) => {
        tone(noteT + i * beat * 0.25, f, beat * 0.22, 0.15, "sine");
      });
      if (b % 2 === 0) bass(t, 65.41 * (b % 8 < 4 ? 1 : 1.5), beat * 1.8, 0.35);
    }
  }
}

// ── 미리듣기용 (스피커 직접 출력, 6초) ──
export function previewBgm(bgmType: BgmType): AudioContext | null {
  if (bgmType === "none") return null;
  const ctx = new AudioContext();
  // 브라우저 autoplay 정책: 사용자 제스처 후 resume 필요
  if (ctx.state === "suspended") ctx.resume();
  _synthBgm(ctx, ctx.destination, bgmType, 6);
  return ctx;
}

// ── 영상 믹싱용 ──
export async function createBgmTrack(
  audioCtx: AudioContext,
  dest: MediaStreamAudioDestinationNode,
  bgmType: BgmType,
  durationSec: number,
): Promise<void> {
  if (bgmType === "none") return;
  _synthBgm(audioCtx, dest, bgmType, durationSec);
}

// Canvas Video Renderer — mirra.my style text animation engine
// Quality-enhanced version: 30fps, full-screen photo, text bg box, shadow, Ken Burns+

const W = 1080, H = 1920;
const FPS = 30;

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

function easeOut(t: number): number { return 1 - Math.pow(1 - t, 3); }
function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function drawGradientBg(ctx: CanvasRenderingContext2D, colors: [string, string]) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawGridPattern(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.03})`;
  ctx.lineWidth = 1;
  const spacing = 80;
  for (let x = 0; x < W; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function drawGlow(ctx: CanvasRenderingContext2D, accentColor: string, t: number) {
  const pulse = 0.25 + 0.12 * Math.sin(t * Math.PI * 2);
  const grad = ctx.createRadialGradient(W * 0.5, H * 0.25, 0, W * 0.5, H * 0.25, 500);
  grad.addColorStop(0, hexToRgba(accentColor, pulse));
  grad.addColorStop(1, hexToRgba(accentColor, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// ── 전체화면 사진 + Ken Burns + 강한 그라데이션 오버레이 ──
function drawFullScreenPhoto(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  bgColors: [string, string], t: number,
) {
  const imgRatio = img.width / img.height;
  const slotRatio = W / H;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (imgRatio > slotRatio) {
    sw = img.height * slotRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / slotRatio;
    sy = (img.height - sh) / 2;
  }

  // Ken Burns: 1.0 → 1.12 줌인
  const scale = 1.0 + 0.12 * easeInOut(t);
  const dw = W * scale;
  const dh = H * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;

  ctx.save();
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

  // 상단 그라데이션 오버레이 (텍스트 가독성)
  const topOverlay = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  topOverlay.addColorStop(0, hexToRgba(bgColors[0], 0.9));
  topOverlay.addColorStop(0.5, hexToRgba(bgColors[0], 0.6));
  topOverlay.addColorStop(1, hexToRgba(bgColors[0], 0));
  ctx.fillStyle = topOverlay;
  ctx.fillRect(0, 0, W, H);

  // 하단 그라데이션 오버레이
  const botOverlay = ctx.createLinearGradient(0, H * 0.7, 0, H);
  botOverlay.addColorStop(0, hexToRgba(bgColors[1], 0));
  botOverlay.addColorStop(1, hexToRgba(bgColors[1], 0.85));
  ctx.fillStyle = botOverlay;
  ctx.fillRect(0, H * 0.7, W, H * 0.3);

  ctx.restore();
}

// ── 배지 (알약형 태그) ──
function drawBadge(
  ctx: CanvasRenderingContext2D, text: string, accentColor: string,
  y: number, animProgress: number,
) {
  if (!text) return;
  const p = easeOut(Math.min(animProgress, 1));
  const slideY = y - 40 * (1 - p);
  ctx.save();
  ctx.globalAlpha = p;
  ctx.font = 'bold 30px "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  const tw = ctx.measureText(text).width + 56;
  const bx = (W - tw) / 2;
  const bh = 58;

  // 배지 배경
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.roundRect(bx, slideY, tw, bh, 29);
  ctx.fill();

  // 배지 광택
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath();
  ctx.roundRect(bx + 4, slideY + 4, tw - 8, bh / 2 - 4, [24, 24, 0, 0]);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 6;
  ctx.fillText(text, W / 2, slideY + bh / 2);
  ctx.restore();
}

// ── 메인 타이틀 (텍스트 배경박스 + 그림자) ──
function drawTitle(
  ctx: CanvasRenderingContext2D, text: string,
  y: number, anim: string, progress: number,
) {
  if (!text) return;
  const p = easeOut(Math.min(progress * 1.5, 1));
  ctx.save();
  ctx.globalAlpha = p;
  ctx.font = 'bold 72px "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let dx = 0, dy = 0, scale = 1;
  switch (anim) {
    case "slide_up":   dy = 70 * (1 - p); break;
    case "slide_left": dx = 90 * (1 - p); break;
    case "zoom_in":    scale = 0.65 + 0.35 * p; break;
    case "fade_in":    break;
  }
  ctx.translate(W / 2 + dx, y + dy);
  ctx.scale(scale, scale);

  // 줄바꿈 처리
  const maxW = W - 100;
  let line = "";
  const lines: string[] = [];
  for (const ch of text.split("")) {
    if (ctx.measureText(line + ch).width > maxW) {
      lines.push(line); line = ch;
    } else { line += ch; }
  }
  if (line) lines.push(line);
  const lineH = 84;
  const totalH = lines.length * lineH;
  const startY = -totalH / 2 + lineH / 2;

  // 텍스트 배경 박스
  const maxLineW = Math.max(...lines.map(l => ctx.measureText(l).width));
  const padX = 40, padY = 24;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.roundRect(-maxLineW / 2 - padX, startY - lineH / 2 - padY, maxLineW + padX * 2, totalH + padY * 2, 16);
  ctx.fill();

  // 텍스트 그림자 + 본문
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#FFFFFF";
  lines.forEach((l, i) => ctx.fillText(l, 0, startY + i * lineH));
  ctx.restore();
}

// ── 서브타이틀 타이핑 효과 (배경박스 포함) ──
function drawSubtitleTyping(
  ctx: CanvasRenderingContext2D, text: string, accentColor: string,
  y: number, typingProgress: number,
) {
  if (!text) return;
  const visibleLen = Math.floor(text.length * Math.min(typingProgress * 0.75, 1));
  const visible = text.slice(0, visibleLen);
  if (!visible) return;

  ctx.save();
  ctx.font = 'bold 44px "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const tw = ctx.measureText(visible).width;
  const pad = 32;
  const bh = 64;

  // 배경박스
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.roundRect(W / 2 - tw / 2 - pad, y - bh / 2, tw + pad * 2, bh, 14);
  ctx.fill();

  // 텍스트
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = accentColor;
  ctx.fillText(visible, W / 2, y);

  // 커서
  if (typingProgress < 0.9 && Math.floor(typingProgress * 12) % 2 === 0) {
    ctx.fillStyle = accentColor;
    ctx.fillRect(W / 2 + tw / 2 + 8, y - 20, 4, 40);
  }
  ctx.restore();
}

// ── 구분선 ──
function drawDividerLine(ctx: CanvasRenderingContext2D, y: number, accentColor: string, progress: number) {
  const p = easeOut(Math.min(progress * 2, 1));
  const lineW = (W - 160) * p;
  ctx.save();
  ctx.strokeStyle = hexToRgba(accentColor, 0.6);
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(W / 2 - lineW / 2, y);
  ctx.lineTo(W / 2 + lineW / 2, y);
  ctx.stroke();
  ctx.restore();
}

// ── 엔딩 카드 ──
function drawEndingCard(
  ctx: CanvasRenderingContext2D, company: string, phone: string,
  accentColor: string, progress: number,
) {
  const p = easeOut(progress);
  ctx.save();
  ctx.globalAlpha = p;

  // 회사명 배경박스
  ctx.font = 'bold 80px "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  const cw = ctx.measureText(company).width;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.roundRect(W / 2 - cw / 2 - 40, H / 2 - 120, cw + 80, 100, 16);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 20;
  ctx.fillText(company, W / 2, H / 2 - 70);

  // 전화번호
  ctx.font = 'bold 52px "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  const pw = ctx.measureText(phone).width;
  ctx.fillStyle = hexToRgba(accentColor, 0.25);
  ctx.beginPath();
  ctx.roundRect(W / 2 - pw / 2 - 32, H / 2 + 10, pw + 64, 72, 36);
  ctx.fill();
  ctx.fillStyle = accentColor;
  ctx.shadowBlur = 12;
  ctx.fillText(phone, W / 2, H / 2 + 46);

  // SMS 브랜드
  ctx.font = '28px "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.shadowBlur = 0;
  ctx.fillText("SMS 셀프마케팅서비스", W / 2, H - 140);

  ctx.restore();
}

// ── 크로스브라우저 MIME 감지 ──
function getBestMimeType(): string {
  const types = [
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const type of types) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function getFileExtension(mimeType: string): string {
  if (mimeType.startsWith("video/mp4")) return "mp4";
  return "webm";
}

export function isIOSDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isRecordingSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

export interface VoiceConfig {
  lang: string;
  pitch: number;
  rate: number;
  voiceNameHint: string[];
}

function speakNarration(text: string, voiceConfig: VoiceConfig): Promise<void> {
  return new Promise((resolve) => {
    if (!text || !window.speechSynthesis) { resolve(); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voiceConfig.lang;
    utterance.pitch = voiceConfig.pitch;
    utterance.rate = voiceConfig.rate;
    const voices = speechSynthesis.getVoices();
    const koVoices = voices.filter(v => v.lang.startsWith("ko"));
    for (const hint of voiceConfig.voiceNameHint) {
      const match = koVoices.find(v => v.name.includes(hint));
      if (match) { utterance.voice = match; break; }
    }
    if (!utterance.voice && koVoices[0]) utterance.voice = koVoices[0];
    const timeout = setTimeout(() => resolve(), 10000);
    utterance.onend = () => { clearTimeout(timeout); resolve(); };
    utterance.onerror = () => { clearTimeout(timeout); resolve(); };
    speechSynthesis.speak(utterance);
  });
}

export async function renderMirraVideo(
  photos: { dataUrl: string }[],
  scenes: MirraScene[],
  companyName: string,
  phoneNumber: string,
  narrationEnabled: boolean,
  onProgress: (current: number, total: number) => void,
  narrationAudios?: (string | null)[],
  voiceConfig?: VoiceConfig,
  bgmDest?: MediaStreamAudioDestinationNode, // ✅ 외부 BGM 스트림
): Promise<{ blob: Blob; narrationTexts: string[] }> {
  if (!isRecordingSupported()) throw new Error("UNSUPPORTED");

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false })!;

  // 이미지 프리로드
  const imageMap: Record<string, HTMLImageElement> = {};
  await Promise.all(
    photos.map((p, i) => new Promise<void>((resolve) => {
      const img = new Image();
      // base64 dataUrl은 crossOrigin 불필요 — 설정 시 오히려 로드 실패
      img.onload = () => { imageMap[`photo_${i + 1}`] = img; resolve(); };
      img.onerror = (e) => { console.warn(`photo_${i+1} load error`, e); resolve(); };
      img.src = p.dataUrl;
    }))
  );

  const stream = canvas.captureStream(FPS);

  let audioCtx: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  try {
    audioCtx = new AudioContext();
    audioDest = audioCtx.createMediaStreamDestination();
    audioDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  } catch { /* no audio */ }

  // ✅ 외부 BGM 트랙을 메인 스트림에 믹싱
  if (bgmDest) {
    bgmDest.stream.getAudioTracks().forEach(t => {
      try { stream.addTrack(t); } catch {}
    });
  }

  const mimeType = getBestMimeType();
  const ext = getFileExtension(mimeType);
  const recorderOptions: MediaRecorderOptions = { videoBitsPerSecond: 6_000_000 };
  if (mimeType) recorderOptions.mimeType = mimeType;

  const recorder = new MediaRecorder(stream, recorderOptions);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const cleanupRecording = () => {
    stream.getTracks().forEach(t => t.stop());
    if (audioCtx && audioCtx.state !== "closed") void audioCtx.close().catch(() => {});
  };

  const recordingDone = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      cleanupRecording();
      resolve(new Blob(chunks, { type: mimeType || `video/${ext}` }));
    };
    recorder.onerror = () => { cleanupRecording(); reject(new Error("RECORDING_FAILED")); };
  });

  recorder.start(); // timeslice 없음 — stop() 시 전체 데이터 한번에

  // 나레이션 오디오 디코딩
  const narrationBuffers: (AudioBuffer | null)[] = [];
  if (narrationAudios && audioCtx) {
    for (const base64 of narrationAudios) {
      if (!base64) { narrationBuffers.push(null); continue; }
      try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        narrationBuffers.push(await audioCtx.decodeAudioData(bytes.buffer));
      } catch { narrationBuffers.push(null); }
    }
  }

  const narrationTexts: string[] = [];

  // 총 프레임 수 계산
  const totalAllFrames = scenes.reduce((s, sc) => s + (sc.duration || 100), 0);
  const FRAME_MS = Math.floor(1000 / FPS); // 33ms

  console.log(`[mirra] 총 ${scenes.length}장면, ${totalAllFrames}프레임, 예상 ${Math.round(totalAllFrames * FRAME_MS / 1000)}초`);

  // setInterval 기반 렌더링 — 실제 벽시계 시간 보장
  await new Promise<void>((resolve) => {
    let si = 0;
    let fi = 0;
    let audioStarted = new Set<number>();

    const interval = setInterval(() => {
      if (si >= scenes.length) {
        clearInterval(interval);
        resolve();
        return;
      }

      const scene = scenes[si];
      const totalFrames = scene.duration || 100;
      const isEnding = si === scenes.length - 1 && !scene.photo;
      const photoImg = scene.photo ? imageMap[scene.photo] : null;
      const t = fi / totalFrames;

      // 최초 진입 시 처리
      if (fi === 0) {
        narrationTexts.push(narrationEnabled && scene.narration ? scene.narration : "");
        onProgress(si, scenes.length);

        // 나레이션 오디오 재생
        if (!audioStarted.has(si)) {
          audioStarted.add(si);
          const narrationBuffer = narrationBuffers[si] || null;
          if (narrationBuffer && audioCtx && audioDest) {
            try {
              const source = audioCtx.createBufferSource();
              source.buffer = narrationBuffer;
              source.connect(audioDest);
              source.start();
            } catch {}
          }
        }
      }

      // 프레임 드로잉
      drawGradientBg(ctx, scene.bg_colors || ["#001130", "#0d2847"]);
      if (photoImg && scene.bg_type === "photo") {
        drawFullScreenPhoto(ctx, photoImg, scene.bg_colors || ["#001130", "#0d2847"], t);
      } else {
        drawGridPattern(ctx, Math.min(t * 3, 1));
        drawGlow(ctx, scene.accent_color || "#237FFF", t);
      }

      if (isEnding) {
        drawEndingCard(ctx, companyName || "SMS", phoneNumber || "", scene.accent_color || "#237FFF", t);
      } else {
        const textCenterY = photoImg ? H * 0.20 : H * 0.38;
        drawBadge(ctx, scene.badge, scene.accent_color || "#237FFF", textCenterY - 100, Math.max(0, (t - 0.05) / 0.18));
        drawTitle(ctx, scene.title, textCenterY + 30, scene.animation, Math.max(0, (t - 0.18) / 0.25));
        drawDividerLine(ctx, textCenterY + 110, scene.accent_color || "#237FFF", Math.max(0, (t - 0.28) / 0.25));
        drawSubtitleTyping(ctx, scene.subtitle, scene.accent_color || "#237FFF", textCenterY + 175, Math.max(0, (t - 0.38) / 0.5));
      }

      fi++;
      if (fi >= totalFrames) {
        si++;
        fi = 0;
      }
    }, FRAME_MS);
  });

  onProgress(scenes.length, scenes.length);
  console.log(`[mirra] 렌더링 완료 — recorder 정지`);

  if (recorder.state !== "inactive") {
    try { recorder.requestData(); } catch {}
    recorder.stop();
  }

  // 렌더링 완료 후 최대 8초 대기
  const blob = await Promise.race([
    recordingDone,
    new Promise<Blob>((resolve) => setTimeout(() => {
      console.warn("[mirra] recorder.onstop 타임아웃 — 강제 종료");
      cleanupRecording();
      resolve(new Blob(chunks, { type: mimeType || `video/${ext}` }));
    }, 8000)),
  ]);

  return { blob, narrationTexts };
}

// ── BGM 생성기 (Web Audio API 기반 — 외부 파일 없이 합성) ──
export type BgmType = "upbeat" | "calm" | "none";

export async function createBgmTrack(
  audioCtx: AudioContext,
  dest: MediaStreamAudioDestinationNode,
  bgmType: BgmType,
  durationSec: number,
): Promise<void> {
  if (bgmType === "none") return;

  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.18; // 나레이션보다 낮게
  masterGain.connect(dest);

  if (bgmType === "upbeat") {
    // 경쾌한 — 4/4박자 아르페지오 + 킥드럼 패턴
    const bpm = 120;
    const beatSec = 60 / bpm;
    const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63]; // C E G C G E
    const totalBeats = Math.ceil(durationSec / beatSec);

    for (let b = 0; b < totalBeats; b++) {
      const t = audioCtx.currentTime + b * beatSec * 0.5;

      // 아르페지오 음표
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.value = notes[b % notes.length];
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + beatSec * 0.45);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + beatSec * 0.5);

      // 킥 드럼 (짝수 박)
      if (b % 4 === 0) {
        const kick = audioCtx.createOscillator();
        const kg = audioCtx.createGain();
        kick.type = "sine";
        kick.frequency.setValueAtTime(150, t);
        kick.frequency.exponentialRampToValueAtTime(40, t + 0.1);
        kg.gain.setValueAtTime(0.6, t);
        kg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        kick.connect(kg); kg.connect(masterGain);
        kick.start(t); kick.stop(t + 0.2);
      }

      // 하이햇 (8분음표)
      if (b % 2 === 1) {
        const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.05, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
        const noise = audioCtx.createBufferSource();
        const hg = audioCtx.createGain();
        const hf = audioCtx.createBiquadFilter();
        hf.type = "highpass"; hf.frequency.value = 8000;
        noise.buffer = buf;
        hg.gain.setValueAtTime(0.25, t); hg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        noise.connect(hf); hf.connect(hg); hg.connect(masterGain);
        noise.start(t);
      }
    }

  } else if (bgmType === "calm") {
    // 잔잔한 — 느린 코드 패드
    const chords = [
      [261.63, 329.63, 392.00], // C maj
      [293.66, 369.99, 440.00], // D maj
      [246.94, 311.13, 369.99], // B min
      [220.00, 277.18, 329.63], // A min
    ];
    const chordDur = 3.0;
    const totalChords = Math.ceil(durationSec / chordDur);

    for (let ci = 0; ci < totalChords; ci++) {
      const t = audioCtx.currentTime + ci * chordDur;
      const chord = chords[ci % chords.length];

      chord.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq * (i === 2 ? 0.5 : 1); // 베이스 옥타브 다운
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.3, t + 0.8);
        g.gain.setValueAtTime(0.3, t + chordDur - 0.8);
        g.gain.linearRampToValueAtTime(0.001, t + chordDur);
        osc.connect(g); g.connect(masterGain);
        osc.start(t); osc.stop(t + chordDur + 0.1);
      });
    }
  }
}

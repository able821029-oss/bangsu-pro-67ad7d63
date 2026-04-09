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
let _logoImg: HTMLImageElement | null = null;

function drawEndingCard(
  ctx: CanvasRenderingContext2D, company: string, phone: string,
  accentColor: string, progress: number,
) {
  const p = easeOut(progress);
  ctx.save();
  ctx.globalAlpha = p;

  // 로고 (프리로드된 경우)
  if (_logoImg && _logoImg.complete && _logoImg.naturalWidth > 0) {
    const logoSize = 120;
    const lx = W / 2 - logoSize / 2;
    const ly = H / 2 - 250;
    ctx.beginPath();
    ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(_logoImg, lx, ly, logoSize, logoSize);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = p;
  }

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

/** 로고 이미지를 프리로드 (엔딩 카드에 표시) */
export function preloadLogo(logoUrl: string) {
  if (!logoUrl) { _logoImg = null; return; }
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = logoUrl;
  _logoImg = img;
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
      resolve(new Blob(chunks, { type: mimeType || ("video/" + ext) }));
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

  // 나레이션 오디오 길이에 맞춰 장면 duration 확장 (겹침 방지)
  for (let i = 0; i < scenes.length; i++) {
    const buf = narrationBuffers[i];
    if (buf) {
      const audioDurationFrames = Math.ceil(buf.duration * FPS) + 15; // 오디오 길이 + 0.5초 여유
      if (audioDurationFrames > (scenes[i].duration || 100)) {
        scenes[i].duration = audioDurationFrames;
      }
    }
  }

  // 2분(3600프레임) 제한
  let totalFrameCount = scenes.reduce((s, sc) => s + (sc.duration || 100), 0);
  const MAX_FRAMES = FPS * 120; // 2분
  if (totalFrameCount > MAX_FRAMES) {
    const ratio = MAX_FRAMES / totalFrameCount;
    for (const sc of scenes) sc.duration = Math.max(30, Math.floor((sc.duration || 100) * ratio));
  }

  const totalAllFrames = scenes.reduce((s, sc) => s + (sc.duration || 100), 0);
  // FRAME_MS는 requestAnimationFrame 방식에서는 브라우저가 자동 관리

  // setTimeout 기반 정밀 타이밍 렌더링 — 정확히 1000/FPS ms 간격 보장
  const FRAME_INTERVAL = 1000 / FPS; // 33.33ms
  let currentNarrationSource: AudioBufferSourceNode | null = null;

  const renderStartTime = performance.now();
  let globalFrameIdx = 0;

  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    const totalFrames = scene.duration || 100;
    const isEnding = si === scenes.length - 1 && !scene.photo;
    const photoImg = scene.photo ? imageMap[scene.photo] : null;

    narrationTexts.push(narrationEnabled && scene.narration ? scene.narration : "");
    onProgress(si, scenes.length);

    // 나레이션 재생
    const narrationBuffer = narrationBuffers[si] || null;
    if (narrationBuffer && audioCtx && audioDest) {
      try {
        if (currentNarrationSource) { try { currentNarrationSource.stop(); } catch {} }
        const source = audioCtx.createBufferSource();
        source.buffer = narrationBuffer;
        source.connect(audioDest);
        source.start();
        currentNarrationSource = source;
        source.onended = () => { if (currentNarrationSource === source) currentNarrationSource = null; };
      } catch {}
    }

    for (let fi = 0; fi < totalFrames; fi++, globalFrameIdx++) {
      // 정확한 타이밍 대기
      const targetTime = renderStartTime + globalFrameIdx * FRAME_INTERVAL;
      const now = performance.now();
      if (now < targetTime) {
        await new Promise<void>(r => setTimeout(r, targetTime - now));
      }

      const t = fi / totalFrames;
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
    }
  }

  const actualDuration = (performance.now() - renderStartTime) / 1000;
  console.warn(`[mirra] 렌더링 완료: ${scenes.length}장면, ${globalFrameIdx}프레임, ${actualDuration.toFixed(1)}초`);

  onProgress(scenes.length, scenes.length);
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
      resolve(new Blob(chunks, { type: mimeType || ("video/" + ext) }));
    }, 8000)),
  ]);

  return { blob, narrationTexts };
}

// ── BGM 생성기 (Web Audio API 기반 — 외부 파일 없이 합성) ──
export type BgmType = "upbeat" | "calm" | "hiphop" | "emotional" | "corporate" | "none";

// ── BGM 내부 합성 핵심 함수 (preview/render 공용) ──
function _synthBgm(audioCtx: AudioContext, out: AudioNode, bgmType: BgmType, durationSec: number) {
  const master = audioCtx.createGain();
  master.gain.value = 0.20;
  master.connect(out);
  const t0 = audioCtx.currentTime;

  // ── 공통 유틸 ──
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
    // 🔨 파워 현장 — 묵직한 산업 드럼 + 힘차고 반복되는 베이스라인
    // 건설 현장의 강함과 역동성 표현
    const bpm = 130, beat = 60 / bpm;
    const beats = Math.ceil(durationSec / beat);
    // 베이스 패턴 (E2-G2-A2-E2)
    const bassPattern = [41.2, 49.0, 55.0, 41.2];
    for (let b = 0; b < beats; b++) {
      const t = t0 + b * beat;
      if (t > t0 + durationSec) break;
      // 강한 킥 (1,3박)
      if (b % 4 === 0 || b % 4 === 2) kick(t, 140, 0.3, 0.9);
      // 스네어 (2,4박)
      if (b % 4 === 1 || b % 4 === 3) snare(t, 0.4);
      // 하이햇 16분
      for (let s = 0; s < 4; s++) {
        const ht = t + s * beat * 0.25;
        hihat(ht, s % 2 === 0 ? 0.12 : 0.07, s === 2);
      }
      // 파워 베이스라인
      bass(t, bassPattern[b % 4], beat * 0.9, 0.55);
      // 강조 금속음 (4박 시작마다)
      if (b % 4 === 0) metalHit(t + beat * 0.5, 0.1);
      // 상승 리드 (8박마다)
      if (b % 8 === 0) {
        [220, 277, 330, 440].forEach((f, i) => {
          tone(t + i * beat * 0.5, f, beat * 0.4, 0.15, "square");
        });
      }
    }

  } else if (bgmType === "hiphop") {
    // 🔥 트렌디 — 현장 직워커 틱톡 스타일 트랩 비트
    // 젊고 파워풀, SNS에 어울리는 현대적 비트
    const bpm = 85, beat = 60 / bpm;
    const beats = Math.ceil(durationSec / beat);
    const bassSeq = [43.65, 43.65, 55.0, 43.65]; // F2 F2 A2 F2
    for (let b = 0; b < beats; b++) {
      const t = t0 + b * beat;
      if (t > t0 + durationSec) break;
      // 808 스타일 묵직한 킥 + 피치 다운
      if (b % 4 === 0) kick(t, 180, 0.5, 1.0);
      if (b % 4 === 2) kick(t, 160, 0.35, 0.8);
      // 클랩/스네어
      if (b % 4 === 1 || b % 4 === 3) snare(t, 0.45);
      // 트랩 하이햇 롤 (16분 + 32분)
      for (let s = 0; s < 8; s++) {
        const ht = t + s * beat * 0.125;
        const vel = [0.18, 0.06, 0.14, 0.06, 0.18, 0.08, 0.10, 0.04][s] || 0.06;
        hihat(ht, vel, s === 4);
      }
      // 저음 808 베이스
      bass(t, bassSeq[b % 4], beat * 0.95, 0.6);
      // 오픈 하이햇 악센트
      if (b % 2 === 1) hihat(t + beat * 0.75, 0.2, true);
    }

  } else if (bgmType === "corporate") {
    // 🏗️ 전문 업체 — 신뢰감 있고 안정적인 현장 프로 이미지
    // 체계적이고 믿음직한 느낌의 현장 음악
    const bpm = 100, beat = 60 / bpm;
    const beats = Math.ceil(durationSec / beat);
    // C major 진행으로 신뢰감
    const chordSeq = [
      [130.81, 164.81, 196.00], // C3 E3 G3
      [146.83, 185.00, 220.00], // D3 F#3 A3
      [174.61, 220.00, 261.63], // F3 A3 C4
      [130.81, 164.81, 196.00], // C3 반복
    ];
    for (let b = 0; b < beats; b++) {
      const t = t0 + b * beat;
      if (t > t0 + durationSec) break;
      // 안정적인 킥 패턴
      if (b % 4 === 0) kick(t, 100, 0.2, 0.7);
      if (b % 4 === 2) kick(t, 100, 0.15, 0.55);
      // 부드러운 스네어
      if (b % 4 === 1 || b % 4 === 3) snare(t, 0.25);
      // 하이햇 (8분)
      if (b % 2 === 0) hihat(t, 0.1); else hihat(t, 0.07);
      // 코드 패드 (4박마다)
      if (b % 4 === 0) {
        chordSeq[Math.floor(b / 4) % chordSeq.length].forEach(f => {
          tone(t, f, beat * 3.8, 0.12, "sine");
        });
      }
      // 베이스 워킹
      bass(t, chordSeq[Math.floor(b / 4) % chordSeq.length][0] / 2, beat * 0.85, 0.45);
    }

  } else if (bgmType === "emotional") {
    // ✨ 완공 감동 — 시공 완료의 성취감과 뿌듯함
    // 고객이 보고 감동받는 완성의 느낌
    const bpm = 76, beat = 60 / bpm;
    const beats = Math.ceil(durationSec / beat);
    // 상승 진행 (Am→F→C→G 감성)
    const melody = [220.00, 246.94, 261.63, 293.66, 329.63, 293.66, 261.63, 246.94,
                    261.63, 293.66, 329.63, 392.00, 440.00, 392.00, 349.23, 329.63];
    const chords = [
      [220.00, 261.63, 329.63], // Am
      [174.61, 220.00, 261.63], // F
      [130.81, 164.81, 196.00], // C
      [196.00, 246.94, 293.66], // G
    ];
    for (let b = 0; b < beats; b++) {
      const t = t0 + b * beat;
      if (t > t0 + durationSec) break;
      // 부드러운 킥 (1,3박만)
      if (b % 4 === 0 || b % 4 === 2) kick(t, 80, 0.15, 0.5);
      if (b % 4 === 1 || b % 4 === 3) snare(t, 0.15);
      hihat(t, 0.06, b % 4 === 2);
      // 멜로디 (반음씩 올라가는 감성)
      tone(t, melody[b % melody.length] * 0.5, beat * 0.8, 0.22, "triangle");
      // 풍성한 코드 패드
      if (b % 4 === 0) {
        chords[Math.floor(b / 4) % chords.length].forEach(f => {
          tone(t, f, beat * 3.5, 0.10, "sine");
          tone(t + 0.03, f * 2, beat * 3.5, 0.06, "sine"); // 옥타브 배음
        });
      }
      // 베이스
      bass(t, chords[Math.floor(b / 4) % chords.length][0] / 2, beat * 0.9, 0.4);
    }

  } else if (bgmType === "calm") {
    // 🪟 깔끔 마감 — 완성된 시공의 깔끔하고 정돈된 느낌
    // 인테리어/마감재 시공에 어울리는 차분하고 세련된 분위기
    const bpm = 90, beat = 60 / bpm;
    const beats = Math.ceil(durationSec / beat);
    const pattern = [130.81, 164.81, 196.00, 130.81]; // C E G C
    for (let b = 0; b < beats; b++) {
      const t = t0 + b * beat;
      if (t > t0 + durationSec) break;
      // 최소한의 드럼
      if (b % 4 === 0) kick(t, 90, 0.12, 0.45);
      if (b % 4 === 2) kick(t, 90, 0.10, 0.3);
      if (b % 4 === 1 || b % 4 === 3) snare(t, 0.12);
      if (b % 2 === 0) hihat(t, 0.07);
      // 아르페지오 (깔끔한 분위기)
      const noteT = t;
      pattern.forEach((f, i) => {
        tone(noteT + i * beat * 0.25, f, beat * 0.22, 0.15, "sine");
      });
      // 부드러운 베이스
      if (b % 2 === 0) bass(t, 65.41 * (b % 8 < 4 ? 1 : 1.5), beat * 1.8, 0.35);
    }
  }
}
// ── 미리듣기용 (스피커 직접 출력, 6초) ──
export function previewBgm(bgmType: BgmType): AudioContext | null {
  if (bgmType === "none") return null;
  const ctx = new AudioContext();
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

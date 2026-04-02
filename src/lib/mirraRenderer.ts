// Canvas Video Renderer — mirra.my style text animation engine
// Cross-browser compatible (Android Chrome, iOS Safari, Desktop)

const W = 1080, H = 1920;
const FPS = 25;

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

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function drawGradientBg(ctx: CanvasRenderingContext2D, colors: [string, string]) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawGridPattern(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.04})`;
  ctx.lineWidth = 1;
  const spacing = 60;
  for (let x = 0; x < W; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function drawGlow(ctx: CanvasRenderingContext2D, accentColor: string, t: number) {
  const pulse = 0.3 + 0.15 * Math.sin(t * Math.PI * 2);
  const grad = ctx.createRadialGradient(W * 0.7, H * 0.3, 0, W * 0.7, H * 0.3, 400);
  grad.addColorStop(0, hexToRgba(accentColor, pulse));
  grad.addColorStop(1, hexToRgba(accentColor, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawBadge(
  ctx: CanvasRenderingContext2D, text: string, accentColor: string,
  y: number, animProgress: number,
) {
  if (!text) return;
  const slideY = y - 30 * (1 - easeOut(animProgress));
  const alpha = easeOut(animProgress);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 28px "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  const tw = ctx.measureText(text).width + 48;
  const bx = (W - tw) / 2;
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.roundRect(bx, slideY, tw, 52, 26);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, slideY + 26);
  ctx.restore();
}

function drawTitle(
  ctx: CanvasRenderingContext2D, text: string,
  y: number, anim: string, progress: number,
) {
  if (!text) return;
  const p = easeOut(Math.min(progress * 1.5, 1));
  ctx.save();
  ctx.globalAlpha = p;
  ctx.font = 'bold 64px "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let dx = 0, dy = 0, scale = 1;
  switch (anim) {
    case "slide_up": dy = 60 * (1 - p); break;
    case "slide_left": dx = 80 * (1 - p); break;
    case "zoom_in": scale = 0.7 + 0.3 * p; break;
    case "fade_in": break;
  }

  ctx.translate(W / 2 + dx, y + dy);
  ctx.scale(scale, scale);

  const maxW = W - 120;
  const words = text.split("");
  let line = "";
  const lines: string[] = [];
  for (const ch of words) {
    if (ctx.measureText(line + ch).width > maxW) {
      lines.push(line); line = ch;
    } else { line += ch; }
  }
  if (line) lines.push(line);

  const lineH = 68;
  const startY = -(lines.length - 1) * lineH / 2;
  lines.forEach((l, i) => ctx.fillText(l, 0, startY + i * lineH));
  ctx.restore();
}

function drawSubtitleTyping(
  ctx: CanvasRenderingContext2D, text: string, accentColor: string,
  y: number, typingProgress: number,
) {
  if (!text) return;
  const visibleLen = Math.floor(text.length * Math.min(typingProgress * 0.7, 1));
  const visible = text.slice(0, visibleLen);
  if (!visible) return;

  ctx.save();
  ctx.font = '38px "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  ctx.fillStyle = accentColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(visible, W / 2, y);

  if (typingProgress < 1 && Math.floor(typingProgress * 10) % 2 === 0) {
    const cursorX = W / 2 + ctx.measureText(visible).width / 2 + 4;
    ctx.fillRect(cursorX, y - 16, 3, 32);
  }
  ctx.restore();
}

function drawDividerLine(ctx: CanvasRenderingContext2D, y: number, accentColor: string, progress: number) {
  const p = easeOut(Math.min(progress * 2, 1));
  const lineW = (W - 200) * p;
  ctx.save();
  ctx.strokeStyle = hexToRgba(accentColor, 0.5);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - lineW / 2, y);
  ctx.lineTo(W / 2 + lineW / 2, y);
  ctx.stroke();
  ctx.restore();
}

function drawPhotoWithOverlay(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  bgColors: [string, string], progress: number,
) {
  const photoH = H * 0.55;
  const photoY = H - photoH;

  const imgRatio = img.width / img.height;
  const slotRatio = W / photoH;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (imgRatio > slotRatio) {
    sw = img.height * slotRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / slotRatio;
    sy = (img.height - sh) / 2;
  }

  const scale = 1.0 + 0.05 * progress;
  const dw = W * scale;
  const dh = photoH * scale;
  const dx = (W - dw) / 2;
  const dy = photoY + (photoH - dh) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, photoY, W, photoH);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

  const overlay = ctx.createLinearGradient(0, photoY, 0, photoY + 200);
  overlay.addColorStop(0, bgColors[0]);
  overlay.addColorStop(1, hexToRgba(bgColors[0], 0));
  ctx.fillStyle = overlay;
  ctx.fillRect(0, photoY, W, 200);
  ctx.restore();
}

function drawEndingCard(
  ctx: CanvasRenderingContext2D, company: string, phone: string,
  accentColor: string, progress: number,
) {
  const p = easeOut(progress);
  ctx.save();
  ctx.globalAlpha = p;

  ctx.font = 'bold 72px "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(company, W / 2, H / 2 - 60);

  ctx.font = 'bold 44px "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  ctx.fillStyle = accentColor;
  ctx.fillText(phone, W / 2, H / 2 + 30);

  ctx.font = '24px "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  ctx.fillStyle = "#AB5EBE";
  ctx.fillText("SMS 셀프마케팅서비스", W / 2, H - 160);

  ctx.restore();
}

// ─── Cross-browser MIME type detection ───
function getBestMimeType(): string {
  const types = [
    'video/mp4;codecs=h264',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function getFileExtension(mimeType: string): string {
  if (mimeType.startsWith('video/mp4')) return 'mp4';
  return 'webm';
}

export function isIOSDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isRecordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function';
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

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    // Safety timeout
    const timeout = setTimeout(() => resolve(), 10000);
    utterance.onend = () => { clearTimeout(timeout); resolve(); };

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
): Promise<Blob> {
  // Pre-flight checks
  if (!isRecordingSupported()) {
    throw new Error("UNSUPPORTED");
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Load photos
  const imageMap: Record<string, HTMLImageElement> = {};
  await Promise.all(
    photos.map((p, i) => new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { imageMap[`photo_${i + 1}`] = img; resolve(); };
      img.onerror = () => resolve();
      img.src = p.dataUrl;
    }))
  );

  // Recording setup — cross-browser MIME detection
  const stream = canvas.captureStream(FPS);

  let audioCtx: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  try {
    audioCtx = new AudioContext();
    audioDest = audioCtx.createMediaStreamDestination();
    audioDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  } catch { /* no audio support */ }

  const mimeType = getBestMimeType();
  const ext = getFileExtension(mimeType);

  const recorderOptions: MediaRecorderOptions = { videoBitsPerSecond: 4_000_000 };
  if (mimeType) recorderOptions.mimeType = mimeType;

  const recorder = new MediaRecorder(stream, recorderOptions);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const recordingDone = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const blobType = mimeType || `video/${ext}`;
      resolve(new Blob(chunks, { type: blobType }));
    };
  });

  // Start with timeslice for iOS compatibility
  recorder.start(100);

  // Decode narration audio buffers
  const narrationBuffers: (AudioBuffer | null)[] = [];
  if (narrationAudios && audioCtx) {
    for (const base64 of narrationAudios) {
      if (!base64) { narrationBuffers.push(null); continue; }
      try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const buffer = await audioCtx.decodeAudioData(bytes.buffer);
        narrationBuffers.push(buffer);
      } catch { narrationBuffers.push(null); }
    }
  }

  // Render each scene
  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    let totalFrames = scene.duration || 90;
    const isEnding = si === scenes.length - 1 && !scene.photo;
    const photoImg = scene.photo ? imageMap[scene.photo] : null;

    // Pre-rendered audio narration (ElevenLabs path)
    const narrationBuffer = narrationBuffers[si] || null;
    if (narrationBuffer && audioCtx) {
      const audioFrames = Math.ceil(narrationBuffer.duration * FPS) + 15;
      totalFrames = Math.max(totalFrames, audioFrames);
      try {
        const source = audioCtx.createBufferSource();
        source.buffer = narrationBuffer;
        if (audioDest) source.connect(audioDest);
        source.start();
      } catch { /* audio playback error */ }
    }

    // Web Speech API narration (browser TTS path)
    if (!narrationBuffer && narrationEnabled && voiceConfig && scene.narration) {
      // Fire and forget — speech plays in background while frames render
      speakNarration(scene.narration, voiceConfig);
      // Extend scene to give time for speech (~5 chars/sec for Korean)
      const estimatedSpeechFrames = Math.ceil((scene.narration.length / 5) * FPS) + 15;
      totalFrames = Math.max(totalFrames, estimatedSpeechFrames);
    }

    onProgress(si, scenes.length);

    for (let f = 0; f < totalFrames; f++) {
      const t = f / totalFrames;

      drawGradientBg(ctx, scene.bg_colors || ["#001130", "#0d2847"]);
      drawGridPattern(ctx, Math.min(t * 3, 1));
      drawGlow(ctx, scene.accent_color || "#237FFF", t);

      if (photoImg && scene.bg_type === "photo") {
        drawPhotoWithOverlay(ctx, photoImg, scene.bg_colors || ["#001130", "#0d2847"], t);
      }

      if (isEnding) {
        drawEndingCard(ctx, companyName || "SMS", phoneNumber || "", scene.accent_color || "#237FFF", t);
      } else {
        const badgeStart = 0.05;
        const titleStart = 0.15;
        const subtitleStart = 0.35;
        const dividerStart = 0.25;

        const badgeProgress = Math.max(0, (t - badgeStart) / 0.2);
        const titleProgress = Math.max(0, (t - titleStart) / 0.25);
        const subtitleProgress = Math.max(0, (t - subtitleStart) / 0.5);
        const dividerProgress = Math.max(0, (t - dividerStart) / 0.3);

        const textCenterY = photoImg ? H * 0.22 : H * 0.4;

        drawBadge(ctx, scene.badge, scene.accent_color || "#237FFF", textCenterY - 80, badgeProgress);
        drawTitle(ctx, scene.title, textCenterY + 20, scene.animation, titleProgress);
        drawDividerLine(ctx, textCenterY + 80, scene.accent_color || "#237FFF", dividerProgress);
        drawSubtitleTyping(ctx, scene.subtitle, scene.accent_color || "#237FFF", textCenterY + 130, subtitleProgress);
      }

      await new Promise(r => setTimeout(r, 1000 / FPS));
    }
  }

  onProgress(scenes.length, scenes.length);
  recorder.stop();
  if (audioCtx) audioCtx.close();
  return recordingDone;
}

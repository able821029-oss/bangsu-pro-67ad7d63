// SMS 영상 렌더러 — Remotion renderMedia() 기반
const { renderMedia, selectComposition } = require("@remotion/renderer");
const path = require("path");

// 2026-04-20 속도 최적화
// - FPS 30 → 24 (시네마틱 톤 유지 + 프레임 수 20% 감소 → 렌더 시간 20% 단축)
// - ENDING_FRAMES 60(2초) → 48(2초@24fps) 유지
const FPS = 24;
const W = 1080;
const H = 1920;
const ENDING_FRAMES = 48;

// Remotion 번들 경로 (Docker 빌드 시 사전 생성)
const bundlePath = path.join(__dirname, "remotion-bundle");

/**
 * 원본 장면 → Remotion SmsScene 변환
 */
function convertScenes(scenes) {
  return scenes.map((s, i) => ({
    id: String(i),
    durationInFrames: s.duration || 100,
    photo: s.photo || null,
    badge: s.badge || "",
    title: s.title || "",
    subtitle: s.subtitle || "",
    accentColor: s.accent_color || "#237FFF",
    animation: s.animation || "fade_in",
    narration: s.narration || "",
  }));
}

/**
 * Remotion으로 영상 렌더링
 * @param {Object} opts
 * @param {Array} opts.scenes - 원본 장면 배열
 * @param {Array} opts.photos - base64 data URL 배열
 * @param {string} opts.companyName
 * @param {string} opts.phoneNumber
 * @param {string} opts.bgmType
 * @param {string} opts.outputPath - 출력 mp4 경로
 * @param {Function} [opts.onProgress] - 진행률 콜백 (0~1)
 */
async function renderVideo({
  scenes,
  photos,
  companyName,
  phoneNumber,
  bgmType,
  outputPath,
  onProgress,
}) {
  const remotionScenes = convertScenes(scenes);
  const totalFrames =
    remotionScenes.reduce((sum, s) => sum + s.durationInFrames, 0) + ENDING_FRAMES;

  const inputProps = {
    scenes: remotionScenes,
    photos,
    companyName,
    phoneNumber,
    bgmType: bgmType || "none",
  };

  const composition = await selectComposition({
    serveUrl: bundlePath,
    id: "SmsShorts",
    inputProps,
  });

  // durationInFrames, fps, width, height 오버라이드
  composition.durationInFrames = totalFrames;
  composition.fps = FPS;
  composition.width = W;
  composition.height = H;

  await renderMedia({
    composition,
    serveUrl: bundlePath,
    codec: "h264",
    outputLocation: outputPath,
    inputProps,
    // Railway Hobby 대응 — 속도 우선 최적화
    concurrency: 3, // 병렬 프레임 렌더링 (메모리 허용 범위 내 최대)
    jpegQuality: 62,
    imageFormat: "jpeg",
    scale: 0.40, // 432x768 — 렌더 시간 ~20% 단축 (2026-04-20 최적화)
    muted: true, // Remotion 오디오는 사용 안 함 (ffmpeg로 후처리)
    logLevel: "warn",
    chromiumOptions: {
      gl: "swangle",
      disableWebSecurity: true,
      headless: true,
    },
    browserExecutable: process.env.CHROMIUM_PATH || undefined,
    onProgress: ({ progress }) => {
      if (onProgress) onProgress(progress);
    },
  });

  return { totalFrames, durationSec: totalFrames / FPS };
}

module.exports = { renderVideo, FPS, W, H };

// SMS 영상 렌더러 — Remotion renderMedia() 기반
const { renderMedia, selectComposition } = require("@remotion/renderer");
const path = require("path");

const FPS = 30;
const W = 1080;
const H = 1920;
const ENDING_FRAMES = 150;

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
    // Railway Hobby (8GB RAM) — full quality 1080x1920
    concurrency: 2,
    jpegQuality: 90,
    chromiumOptions: {
      gl: "angle",
      disableWebSecurity: true,
    },
    browserExecutable: process.env.CHROMIUM_PATH || undefined,
    onProgress: ({ progress }) => {
      if (onProgress) onProgress(progress);
    },
  });

  return { totalFrames, durationSec: totalFrames / FPS };
}

module.exports = { renderVideo, FPS, W, H };

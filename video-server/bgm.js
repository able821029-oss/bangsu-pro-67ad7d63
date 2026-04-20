// BGM 생성 — ffmpeg sine 필터 기반 (서버사이드)
// v5.2: 마스터(180초) 프리셋 캐싱 도입. 첫 호출은 생성, 이후 동일 타입은 MP3 stream copy로 trim만 수행.

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");

const CACHE_DIR = process.env.BGM_CACHE_DIR || "/tmp/bgm-cache";
const MASTER_DURATION_SEC = 180;

// BPM 및 주파수 설정 — 프리셋
const CONFIGS = {
  upbeat:    { bpm: 130, notes: [82.41, 110.0, 130.81, 164.81], vol: 0.18 },
  hiphop:    { bpm: 85,  notes: [43.65, 43.65, 55.0,  43.65],  vol: 0.18 },
  corporate: { bpm: 100, notes: [65.41, 82.41, 98.0,  65.41],  vol: 0.15 },
  emotional: { bpm: 76,  notes: [110.0, 130.81, 146.83, 110.0], vol: 0.14 },
  calm:      { bpm: 90,  notes: [65.41, 82.41, 98.0,  123.47], vol: 0.13 },
};

function cachePath(bgmType) {
  return path.join(CACHE_DIR, `${bgmType}.mp3`);
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/** 캐시 안 뒤에 180초 마스터 mp3를 생성(이미 있으면 재사용). */
function ensureMaster(bgmType) {
  const cfg = CONFIGS[bgmType];
  if (!cfg) return null;
  ensureCacheDir();
  const master = cachePath(bgmType);
  if (fs.existsSync(master) && fs.statSync(master).size > 1000) return master;

  const sineFilters = cfg.notes
    .map((freq, i) => `sine=frequency=${freq}:duration=${MASTER_DURATION_SEC}[s${i}]`)
    .join(";");
  const mixInputs = cfg.notes.map((_, i) => `[s${i}]`).join("");
  const filterComplex = `${sineFilters};${mixInputs}amix=inputs=${cfg.notes.length}:normalize=0,volume=${cfg.vol}[bgm]`;

  execSync(
    `${ffmpegPath} -y -filter_complex "${filterComplex}" -map "[bgm]" -c:a libmp3lame -b:a 128k "${master}"`,
    { maxBuffer: 1024 * 1024 * 64 }
  );
  console.log(`[bgm] 마스터 생성: ${bgmType} (${MASTER_DURATION_SEC}s)`);
  return master;
}

/**
 * BGM 파일을 outputPath에 생성.
 * 캐시 hit 시 MP3 stream copy(-c:a copy)로 초고속 trim (수십~수백 ms).
 *
 * @param {string} bgmType - upbeat | hiphop | corporate | emotional | calm | none
 * @param {number} durationSec - 요구 길이(초). 1 이하면 1로 clamp, 180 초과면 180으로 clamp
 * @param {string} outputPath - 출력 mp3 경로
 * @returns {boolean} 성공 여부
 */
function generateBgm(bgmType, durationSec, outputPath) {
  if (bgmType === "none") return false;
  if (!CONFIGS[bgmType]) {
    console.warn(`[bgm] 알 수 없는 타입: ${bgmType} → calm으로 대체`);
    bgmType = "calm";
  }

  try {
    const master = ensureMaster(bgmType);
    if (!master) return false;
    const clamped = Math.min(Math.max(Number(durationSec) || 1, 1), MASTER_DURATION_SEC);
    // -c:a copy: MP3 frame 단위 stream copy. 무손실·고속. ~0.1초 경계 오차는 영상 합체 시 -shortest로 무시.
    execSync(
      `${ffmpegPath} -y -i "${master}" -t ${clamped.toFixed(2)} -c:a copy "${outputPath}"`,
      { maxBuffer: 1024 * 1024 * 64 }
    );
    return true;
  } catch (e) {
    console.warn("BGM 생성 실패:", e.message);
    return false;
  }
}

/** 캐시 초기화 — 테스트 용도. */
function clearBgmCache() {
  if (!fs.existsSync(CACHE_DIR)) return;
  for (const f of fs.readdirSync(CACHE_DIR)) {
    try {
      fs.unlinkSync(path.join(CACHE_DIR, f));
    } catch {
      /* ignore */
    }
  }
}

module.exports = { generateBgm, clearBgmCache, CACHE_DIR, MASTER_DURATION_SEC };

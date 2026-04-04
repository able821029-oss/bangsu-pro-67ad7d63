// BGM 생성 — ffmpeg 오디오 필터 기반 (서버사이드)
const { execSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');

/**
 * BGM 타입별 ffmpeg sine 필터로 오디오 생성
 * @param {string} bgmType - upbeat | hiphop | corporate | emotional | calm | none
 * @param {number} durationSec - 영상 길이(초)
 * @param {string} outputPath - 출력 mp3 경로
 */
function generateBgm(bgmType, durationSec, outputPath) {
  if (bgmType === 'none') return false;

  // BPM 및 주파수 설정
  const configs = {
    upbeat:    { bpm: 130, notes: [82.41, 110.0, 130.81, 164.81], vol: 0.18 },
    hiphop:    { bpm: 85,  notes: [43.65, 43.65, 55.0,  43.65],  vol: 0.18 },
    corporate: { bpm: 100, notes: [65.41, 82.41, 98.0,  65.41],  vol: 0.15 },
    emotional: { bpm: 76,  notes: [110.0, 130.81, 146.83, 110.0], vol: 0.14 },
    calm:      { bpm: 90,  notes: [65.41, 82.41, 98.0,  123.47], vol: 0.13 },
  };

  const cfg = configs[bgmType] || configs.calm;
  const beatSec = 60 / cfg.bpm;

  // sine 웨이브 조합으로 간단한 BGM 생성
  // ffmpeg의 sine 필터 + amix로 화음 생성
  const sineFilters = cfg.notes.map((freq, i) =>
    `sine=frequency=${freq}:duration=${durationSec}[s${i}]`
  ).join(';');

  const mixInputs = cfg.notes.map((_, i) => `[s${i}]`).join('');

  const filterComplex = `${sineFilters};${mixInputs}amix=inputs=${cfg.notes.length}:normalize=0,volume=${cfg.vol}[bgm]`;

  const cmd = [
    ffmpegPath,
    '-y',
    `-filter_complex "${filterComplex}"`,
    '-map "[bgm]"',
    '-c:a libmp3lame -b:a 128k',
    `"${outputPath}"`
  ].join(' ');

  try {
    execSync(cmd, { maxBuffer: 1024 * 1024 * 64 });
    return true;
  } catch (e) {
    console.warn('BGM 생성 실패:', e.message);
    return false;
  }
}

module.exports = { generateBgm };

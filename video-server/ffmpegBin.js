// ffmpeg 바이너리 경로 결정 — 한 곳에서 정해 4개 모듈(ffmpegRenderer/audioMixer/bgm/worker)이 공유.
//
// 우선순위:
//   1. FFMPEG_PATH env (운영자가 명시적 override)
//   2. /usr/bin/ffmpeg, /usr/local/bin/ffmpeg (Docker apt-get 설치본)
//   3. ffmpeg-static 패키지 (로컬 Windows/Mac 개발)
//
// 배경: ffmpeg-static@5.2.0 바이너리에서 -filter_complex 옵션 파서가 일부 형식을
// "Filter not found"로 거부하는 사례 발견. Dockerfile의 시스템 ffmpeg(Debian slim
// fonts-noto-cjk와 함께 설치된 안정 빌드)로 우회하기 위한 분리.

const fs = require("fs");

function resolve() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  for (const p of ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    if (fs.existsSync(p)) return p;
  }
  return require("ffmpeg-static");
}

module.exports = resolve();

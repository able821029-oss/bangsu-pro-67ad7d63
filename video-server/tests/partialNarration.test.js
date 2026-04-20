// 부분 실패 나레이션 시나리오 — Redis 불필요, audioMixer 직접 테스트
//
// 검증 목표:
//   - narrationAudios 일부 null일 때 mixAudio가 나머지로 오디오 합성 완료
//   - 전부 null + BGM 없음이면 오디오 없이 영상 그대로 반환
//
// 실행: node --test tests/partialNarration.test.js

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync, spawnSync } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { mixAudio } = require("../audioMixer");

function makeTestVideo(outPath, durationSec = 5) {
  execSync(
    `"${ffmpegPath}" -f lavfi -t ${durationSec} -i color=c=red:s=1080x1920:r=24 ` +
      `-c:v libx264 -preset veryfast -pix_fmt yuv420p -y "${outPath}"`
  );
}

function makeTestAudioBase64(durationSec = 1, freq = 440) {
  const tmp = path.join(os.tmpdir(), `test_audio_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`);
  execSync(
    `"${ffmpegPath}" -f lavfi -t ${durationSec} -i "sine=frequency=${freq}:sample_rate=44100" ` +
      `-c:a libmp3lame -y "${tmp}"`
  );
  const b64 = fs.readFileSync(tmp).toString("base64");
  fs.unlinkSync(tmp);
  return b64;
}

function hasAudioStream(filePath) {
  const proc = spawnSync(ffmpegPath, ["-hide_banner", "-i", filePath, "-f", "null", "-"], { encoding: "utf8" });
  return /Stream\s+#\d+:\d+[^\n]*Audio:/.test((proc.stderr || "") + (proc.stdout || ""));
}

// 워커가 정리 책임. 여기선 테스트 내에서 직접 정리
function cleanup(result) {
  for (const p of result?.tempFiles || []) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  }
}

test("7씬 중 2·4번 null — 나머지 5씬으로 오디오 합성 성공", async () => {
  const jobId = "partial-" + Date.now();
  const videoPath = path.join(os.tmpdir(), `test_vid_${jobId}.mp4`);
  makeTestVideo(videoPath, 5);

  const narrationAudios = [
    makeTestAudioBase64(0.5, 440),
    makeTestAudioBase64(0.5, 500),
    null,
    makeTestAudioBase64(0.5, 600),
    null,
    makeTestAudioBase64(0.5, 700),
    makeTestAudioBase64(0.5, 800),
  ];

  let result;
  try {
    result = await mixAudio({
      videoPath,
      narrationAudios,
      bgmType: "none",
      durationSec: 5,
      jobId,
    });

    assert.strictEqual(result.hasNarration, true, "일부 null이어도 hasNarration=true");
    assert.strictEqual(result.hasAudio, true);
    assert.ok(fs.existsSync(result.finalPath), "최종 파일 존재");
    assert.ok(hasAudioStream(result.finalPath), "최종 영상에 오디오 스트림 존재");
  } finally {
    try { fs.unlinkSync(videoPath); } catch { /* ignore */ }
    if (result) cleanup(result);
  }
});

test("전부 null + BGM 없음 → 원본 영상 그대로 (오디오 없음)", async () => {
  const jobId = "all-null-" + Date.now();
  const videoPath = path.join(os.tmpdir(), `test_vid2_${jobId}.mp4`);
  makeTestVideo(videoPath, 3);

  let result;
  try {
    result = await mixAudio({
      videoPath,
      narrationAudios: [null, null, null],
      bgmType: "none",
      durationSec: 3,
      jobId,
    });

    assert.strictEqual(result.hasNarration, false);
    assert.strictEqual(result.hasBgm, false);
    assert.strictEqual(result.hasAudio, false);
    assert.strictEqual(result.finalPath, videoPath, "원본 영상 경로 그대로");
  } finally {
    try { fs.unlinkSync(videoPath); } catch { /* ignore */ }
    if (result) cleanup(result);
  }
});

test("일부 null + BGM은 있는 경우 → BGM만 나레이션과 믹스 없이 단독 재생", async () => {
  const jobId = "partial-bgm-" + Date.now();
  const videoPath = path.join(os.tmpdir(), `test_vid3_${jobId}.mp4`);
  makeTestVideo(videoPath, 4);

  const narrationAudios = [
    makeTestAudioBase64(0.5, 440),
    null,
    makeTestAudioBase64(0.5, 600),
  ];

  let result;
  try {
    result = await mixAudio({
      videoPath,
      narrationAudios,
      bgmType: "calm",
      durationSec: 4,
      jobId,
    });

    assert.strictEqual(result.hasNarration, true, "유효한 나레이션 있음");
    assert.strictEqual(result.hasBgm, true, "BGM 정상 생성");
    assert.strictEqual(result.hasAudio, true);
    assert.ok(hasAudioStream(result.finalPath));
  } finally {
    try { fs.unlinkSync(videoPath); } catch { /* ignore */ }
    if (result) cleanup(result);
  }
});

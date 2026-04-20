// FFmpeg 렌더러 통합 테스트 — 샘플 사진 3장 + 자막 + 나레이션 없이 렌더
//
// 실행 전제:
//   - ffmpeg-static (설치됨)
//   - 한글 폰트: FONT_PATH env 또는 Noto CJK / malgun 등 fallback 경로 중 하나
//   - Redis 불필요 (BullMQ 의존 없음)
//
// 실행: node --test tests/ffmpegRenderer.test.js
//       또는 npm run test:ffmpeg (package.json scripts 참고)

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { renderFfmpegVideo, resolveFontPath, FPS, W, H } = require("../ffmpegRenderer");

function makeTestPhoto(color, idx, jobId) {
  const tmp = path.join(os.tmpdir(), `sms_test_${jobId}_${idx}.jpg`);
  execSync(
    `"${ffmpegPath}" -f lavfi -i color=c=${color}:s=${W}x${H}:d=1 -frames:v 1 -y "${tmp}"`
  );
  const buf = fs.readFileSync(tmp);
  fs.unlinkSync(tmp);
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

function probeDuration(filePath) {
  const proc = spawnSync(
    ffmpegPath,
    ["-hide_banner", "-i", filePath, "-f", "null", "-"],
    { encoding: "utf8" }
  );
  const stderr = (proc.stderr || "") + (proc.stdout || "");
  const m = stderr.match(/Duration:\s+(\d+):(\d+):(\d+\.\d+)/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
}

function probeHasVideo(filePath) {
  const proc = spawnSync(
    ffmpegPath,
    ["-hide_banner", "-i", filePath, "-f", "null", "-"],
    { encoding: "utf8" }
  );
  const stderr = (proc.stderr || "") + (proc.stdout || "");
  return /Stream\s+#\d+:\d+[^\n]*Video:/.test(stderr);
}

test("폰트 경로 resolve — Windows 또는 Linux 환경에서 성공", () => {
  const fp = resolveFontPath();
  assert.ok(fp, `한글 폰트를 찾지 못함. FONT_PATH를 설정하세요. (현재: ${process.env.FONT_PATH || "미설정"})`);
  assert.ok(fs.existsSync(fp), `폰트 파일 존재 확인: ${fp}`);
});

test("3개 씬(사진) + 2개 색상 씬(인트로/엔딩) 렌더 → 파일 생성 + duration 일치", async () => {
  const jobId = "ffrender-" + Date.now();
  const outputPath = path.join(os.tmpdir(), `sms_test_out_${jobId}.mp4`);
  const photos = [
    makeTestPhoto("red", 1, jobId),
    makeTestPhoto("green", 2, jobId),
    makeTestPhoto("blue", 3, jobId),
  ];

  // 인트로(color) → 사진3장 → 엔딩(color)
  // 짧게 테스트 위해 씬당 24프레임 = 1초
  const scenes = [
    { duration: 24, photo: null, bg_colors: ["#0a1628"], title: "인트로", subtitle: "테스트 시작" },
    { duration: 24, photo: "photo_1", title: "", subtitle: "빨간 씬 자막" },
    { duration: 24, photo: "photo_2", title: "", subtitle: "녹색 씬 자막" },
    { duration: 24, photo: "photo_3", title: "", subtitle: "파란 씬 자막" },
    { duration: 24, photo: null, bg_colors: ["#001130"], title: "테스트 업체", subtitle: "010-1234-5678" },
  ];

  const t0 = Date.now();
  let lastPct = 0;
  const result = await renderFfmpegVideo({
    scenes,
    photos,
    companyName: "테스트 업체",
    phoneNumber: "010-1234-5678",
    style: "basic",
    jobId,
    outputPath,
    onProgress: (p) => {
      lastPct = p;
    },
  });
  const elapsedMs = Date.now() - t0;

  console.log(`[test] 렌더 시간: ${elapsedMs}ms (최종 진행률: ${(lastPct * 100).toFixed(1)}%)`);

  try {
    assert.ok(fs.existsSync(outputPath), "출력 파일 존재");
    assert.strictEqual(result.videoPath, outputPath, "videoPath 반환");

    const stat = fs.statSync(outputPath);
    assert.ok(stat.size > 10_000, `파일 크기 > 10KB (실제: ${stat.size})`);

    assert.ok(probeHasVideo(outputPath), "비디오 스트림 존재");

    const actualDur = probeDuration(outputPath);
    // 예상: 5씬 × 1s - 4*0.5s (xfade) = 5 - 2 = 3초
    const expectedDur = 5 * 1 - 4 * 0.5;
    assert.ok(
      Math.abs(actualDur - expectedDur) < 0.7,
      `duration 일치 (expected ~${expectedDur}s, actual ${actualDur.toFixed(2)}s)`
    );

    assert.ok(lastPct > 0.5, `진행률이 정상 보고됨 (최종: ${lastPct})`);
  } finally {
    try { fs.unlinkSync(outputPath); } catch { /* ignore */ }
  }
});

test("사진만 3장 · 인트로/엔딩 없음 → 순수 사진 렌더", async () => {
  const jobId = "ffrender-photos-" + Date.now();
  const outputPath = path.join(os.tmpdir(), `sms_test_photos_${jobId}.mp4`);
  const photos = [
    makeTestPhoto("orange", 1, jobId),
    makeTestPhoto("purple", 2, jobId),
    makeTestPhoto("yellow", 3, jobId),
  ];
  const scenes = [
    { duration: 24, photo: "photo_1", subtitle: "첫 번째 컷" },
    { duration: 24, photo: "photo_2", subtitle: "두 번째 컷" },
    { duration: 24, photo: "photo_3", subtitle: "세 번째 컷" },
  ];

  const t0 = Date.now();
  const result = await renderFfmpegVideo({
    scenes,
    photos,
    style: "photo",
    jobId,
    outputPath,
    onProgress: () => {},
  });
  const elapsedMs = Date.now() - t0;
  console.log(`[test] 사진 전용 렌더 시간: ${elapsedMs}ms`);

  try {
    assert.ok(fs.existsSync(outputPath));
    assert.ok(probeHasVideo(outputPath));

    const actualDur = probeDuration(outputPath);
    // 3씬 × 1s - 2*0.5s = 2초
    assert.ok(Math.abs(actualDur - 2) < 0.7, `duration ~2s (actual ${actualDur.toFixed(2)}s)`);
    assert.strictEqual(result.totalFrames, Math.round(2 * FPS));
  } finally {
    try { fs.unlinkSync(outputPath); } catch { /* ignore */ }
  }
});

test("한글 자막이 filter_complex 파싱을 깨뜨리지 않는다", async () => {
  const jobId = "ffrender-hangul-" + Date.now();
  const outputPath = path.join(os.tmpdir(), `sms_test_hangul_${jobId}.mp4`);
  const photos = [makeTestPhoto("skyblue", 1, jobId)];

  // 특수문자 포함 — single quote, colon, comma
  const scenes = [
    {
      duration: 24,
      photo: "photo_1",
      title: "시공 현장 '베스트'",
      subtitle: "안녕하세요: 오늘도, 정성껏 작업합니다.",
    },
  ];

  const result = await renderFfmpegVideo({
    scenes,
    photos,
    style: "basic",
    jobId,
    outputPath,
    onProgress: () => {},
  });

  try {
    assert.ok(fs.existsSync(outputPath), "한글+특수문자 자막도 렌더 성공");
    assert.ok(probeHasVideo(outputPath));
    assert.ok(result.totalFrames > 0);
  } finally {
    try { fs.unlinkSync(outputPath); } catch { /* ignore */ }
  }
});

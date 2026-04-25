// SMS 쇼츠 렌더 워커 — BullMQ Worker로 큐에서 잡을 꺼내 실제 렌더링 수행
//
// v5.1: 렌더 엔진 이원화
//   - ffmpegRenderer: 기본 (basic/photo/simple 또는 지정 없음) — 15~30s, Chromium 없음
//   - renderer (Remotion): premium/animated 또는 FORCE_REMOTION=1 — 기존 품질 유지
//
// 오디오 믹싱은 audioMixer로 공통화했다. 사후 게이트 ③(ffprobe)는 엔진 무관하게 적용.

const { Worker } = require("bullmq");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { createClient } = require("@supabase/supabase-js");
const ffmpegPath = require("./ffmpegBin");
const { renderVideo: renderRemotionVideo } = require("./renderer");
const { renderFfmpegVideo } = require("./ffmpegRenderer");
const { mixAudio } = require("./audioMixer");
const { QUEUE_NAME, createConnection } = require("./queue");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "2", 10);

/** 스타일 문자열 → 사용할 렌더 엔진 */
function selectEngine(style) {
  if (process.env.FORCE_REMOTION === "1") return "remotion";
  const s = String(style || "").toLowerCase();
  if (s === "premium" || s === "animated" || s === "remotion") return "remotion";
  // basic, photo, simple, "시공일지형", "홍보형", "Before/After형" 등 전부 ffmpeg
  return "ffmpeg";
}

// ── 영상 메타데이터 검증 (ffprobe 대체) — 사후 게이트 ③ ──
function probeMedia(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: "파일 없음", hasAudio: false, hasVideo: false, durationSec: 0 };
  }
  const stat = fs.statSync(filePath);
  const proc = spawnSync(
    ffmpegPath,
    ["-hide_banner", "-i", filePath, "-f", "null", "-"],
    { encoding: "utf8" }
  );
  const stderr = (proc.stderr || "") + (proc.stdout || "");
  const hasAudio = /Stream\s+#\d+:\d+[^\n]*Audio:/.test(stderr);
  const hasVideo = /Stream\s+#\d+:\d+[^\n]*Video:/.test(stderr);
  const dm = stderr.match(/Duration:\s+(\d+):(\d+):(\d+\.\d+)/);
  const durationSec = dm
    ? parseInt(dm[1], 10) * 3600 + parseInt(dm[2], 10) * 60 + parseFloat(dm[3])
    : 0;
  return { ok: true, hasAudio, hasVideo, durationSec, fileSize: stat.size };
}

async function processShortsJob(job) {
  const jobId = job.id;
  const videoPath = `/tmp/sms_${jobId}.mp4`;
  const startTime = Date.now();
  const elapsed = () => `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

  const setProgress = (progress, stage, subStatus) =>
    job.updateProgress({ progress, stage, subStatus });

  let audioMixerResult = null;

  try {
    const {
      scenes,
      photos,
      narrationAudios,
      companyName,
      phoneNumber,
      bgmType = "none",
      narrationExpected = false,
      videoStyle, // Edge Function / 클라이언트가 보내는 스토리 스타일 이름
      style, // 호환 — 대체 키
    } = job.data;

    if (!scenes?.length || !photos?.length) {
      throw new Error("scenes, photos 필수");
    }

    // ── 사전 게이트 ②: 전부 null일 때만 차단 (부분 실패는 허용) ──
    const validAudioCount = (narrationAudios || []).filter(Boolean).length;
    const totalNarrationSlots = (narrationAudios || []).length;
    if (narrationExpected && validAudioCount === 0 && totalNarrationSlots > 0) {
      throw new Error(
        "나레이션 음성 생성이 전부 실패했습니다 — ElevenLabs 서비스를 확인하고 다시 시도해 주세요."
      );
    }
    const missingCount = totalNarrationSlots - validAudioCount;
    if (narrationExpected && missingCount > 0 && validAudioCount > 0) {
      console.log(
        `[${jobId}] 부분 실패 허용 — ${missingCount}/${totalNarrationSlots}개 씬 음성 없음 (무음으로 진행)`
      );
    }

    const chosenStyle = videoStyle || style;
    const engine = selectEngine(chosenStyle);
    console.log(
      `[${jobId}] 시작 — ${scenes.length}장면 ${photos.length}사진 bgm:${bgmType} ` +
        `나레이션:${validAudioCount}/${(narrationAudios || []).length} 엔진:${engine} (style=${chosenStyle || "기본"})`
    );
    await setProgress(5, "렌더링 시작", "rendering");

    // Step 1: 렌더 엔진 실행 (오디오 없는 mp4)
    const renderOnProgress = (p) => {
      const mapped = 5 + Math.round(p * 70); // 5~75
      job
        .updateProgress({
          progress: mapped,
          stage: engine === "ffmpeg" ? "FFmpeg 렌더" : "Remotion 렌더",
          subStatus: "rendering",
        })
        .catch(() => {});
      if (p % 0.1 < 0.02) {
        console.log(`[${jobId}] 렌더링 ${Math.round(p * 100)}% (${elapsed()})`);
      }
    };

    let durationSec;
    let totalFrames;

    if (engine === "ffmpeg") {
      const r = await renderFfmpegVideo({
        scenes,
        photos: photos.slice(0, 6),
        companyName,
        phoneNumber,
        style: chosenStyle,
        jobId,
        outputPath: videoPath,
        onProgress: renderOnProgress,
      });
      durationSec = r.durationSec;
      totalFrames = r.totalFrames;
    } else {
      const r = await renderRemotionVideo({
        scenes,
        photos: photos.slice(0, 6),
        companyName,
        phoneNumber,
        bgmType,
        outputPath: videoPath,
        onProgress: renderOnProgress,
      });
      durationSec = r.durationSec;
      totalFrames = r.totalFrames;
    }

    console.log(`[${jobId}] ${engine} 렌더 완료: ${totalFrames}프레임 (${elapsed()})`);
    await setProgress(78, "오디오 합성", "mixing");

    // Step 2~4: 오디오 믹싱 (공통)
    audioMixerResult = await mixAudio({
      videoPath,
      narrationAudios,
      bgmType,
      durationSec,
      jobId,
    });

    const uploadPath = audioMixerResult.finalPath;
    const hasNarration = audioMixerResult.hasNarration;
    const hasBgm = audioMixerResult.hasBgm;

    console.log(`[${jobId}] 오디오 처리 완료 (${elapsed()})`);
    await setProgress(90, "출력 검증 중", "verifying");

    // Step 5: 사후 게이트 ③ (엔진 무관 동일 검증)
    const probe = probeMedia(uploadPath);
    console.log(
      `[${jobId}] 검증: video=${probe.hasVideo} audio=${probe.hasAudio} dur=${probe.durationSec}s size=${probe.fileSize}B`
    );
    if (!probe.hasVideo) throw new Error("출력 파일에 영상 스트림이 없습니다");
    if (probe.durationSec < 1)
      throw new Error(`출력 파일 길이가 비정상입니다 (${probe.durationSec}초)`);
    if (probe.fileSize < 10_000)
      throw new Error(`출력 파일 크기가 비정상입니다 (${probe.fileSize} bytes)`);
    if (narrationExpected && !probe.hasAudio)
      throw new Error("최종 영상에 음성이 들어가지 않았습니다 — 다시 시도해 주세요");
    if ((hasNarration || hasBgm) && !probe.hasAudio)
      throw new Error(
        "오디오 합성은 성공했지만 최종 영상에 반영되지 않았습니다 — 다시 시도해 주세요"
      );

    await setProgress(94, "Supabase 업로드", "uploading");

    // Step 6: Supabase Storage 업로드
    const videoBuffer = fs.readFileSync(uploadPath);
    const storagePath = `videos/${jobId}.mp4`;

    try {
      await supabase.storage.createBucket("sms-videos", {
        public: true,
        fileSizeLimit: 104857600,
      });
    } catch {
      /* 이미 존재 — 무시 */
    }

    const { error: uploadErr } = await supabase.storage
      .from("sms-videos")
      .upload(storagePath, videoBuffer, { contentType: "video/mp4", cacheControl: "3600" });

    if (uploadErr) throw new Error(`Storage 업로드 실패: ${uploadErr.message}`);

    const {
      data: { publicUrl: url },
    } = supabase.storage.from("sms-videos").getPublicUrl(storagePath);

    console.log(`[${jobId}] 완료! (${elapsed()}) engine=${engine} → ${url}`);
    await setProgress(100, "완료", "done");

    return {
      videoUrl: url,
      durationSec: Math.round(durationSec),
      frames: totalFrames,
      engine,
    };
  } finally {
    // 전체 임시 파일 정리 — /tmp 누수 방지
    const toCleanup = [videoPath];
    if (audioMixerResult?.tempFiles) toCleanup.push(...audioMixerResult.tempFiles);
    for (const p of toCleanup) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
}

const worker = new Worker(QUEUE_NAME, processShortsJob, {
  connection: createConnection(),
  concurrency: WORKER_CONCURRENCY,
});

worker.on("completed", (job, result) => {
  console.log(`[worker] 완료 jobId=${job.id} engine=${result?.engine} videoUrl=${result?.videoUrl}`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] 실패 jobId=${job?.id}: ${err?.message || err}`);
});

worker.on("error", (err) => {
  console.error(`[worker] 내부 오류: ${err?.message || err}`);
});

async function shutdown(signal) {
  console.log(`[worker] ${signal} 수신, graceful shutdown 시작`);
  try {
    await worker.close();
  } catch (e) {
    console.error("[worker] close 실패:", e?.message || e);
  }
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

console.log(
  `SMS Video Worker v5.1 (BullMQ + 이원화 렌더) — queue="${QUEUE_NAME}" concurrency=${WORKER_CONCURRENCY}`
);
console.log(`  Redis: ${process.env.REDIS_URL ? "연결됨" : "기본 127.0.0.1:6379"}`);
console.log(`  Supabase: ${process.env.SUPABASE_URL ? "연결됨" : "미설정"}`);
console.log(`  FORCE_REMOTION: ${process.env.FORCE_REMOTION === "1" ? "ON (롤백 모드)" : "OFF"}`);

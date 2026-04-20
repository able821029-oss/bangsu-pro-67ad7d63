// SMS 쇼츠 렌더 워커 — BullMQ Worker로 큐에서 잡을 꺼내 실제 렌더링 수행
const { Worker } = require("bullmq");
const fs = require("fs");
const { execSync, spawnSync } = require("child_process");
const { createClient } = require("@supabase/supabase-js");
const ffmpegPath = require("ffmpeg-static");
const { renderVideo } = require("./renderer");
const { generateBgm } = require("./bgm");
const { QUEUE_NAME, createConnection } = require("./queue");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "2", 10);

// ── 영상 메타데이터 검증 (ffprobe 대체) ──
// ffmpeg -i stderr 파싱으로 오디오·비디오 스트림 + 길이 확인.
// 업로드 직전 최종 게이트: "음성 없는 영상 출력" 사고를 차단한다.
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

/**
 * 쇼츠 렌더 잡 처리기.
 * BullMQ가 동시성(WORKER_CONCURRENCY) 만큼 병렬로 호출한다.
 * job.updateProgress({ progress, stage, subStatus }) 로 클라이언트 폴링 응답 필드를 채운다.
 */
async function processShortsJob(job) {
  const jobId = job.id;
  const videoPath = `/tmp/sms_${jobId}.mp4`;
  const audioPath = `/tmp/sms_${jobId}_audio.mp3`;
  const bgmPath = `/tmp/sms_${jobId}_bgm.mp3`;
  const mixedPath = `/tmp/sms_${jobId}_mixed.mp3`;
  const finalPath = `/tmp/sms_${jobId}_final.mp4`;
  const listFile = `/tmp/sms_${jobId}_list.txt`;
  const narrationFiles = [];

  const startTime = Date.now();
  const elapsed = () => `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

  const setProgress = (progress, stage, subStatus) =>
    job.updateProgress({ progress, stage, subStatus });

  try {
    const {
      scenes,
      photos,
      narrationAudios,
      companyName,
      phoneNumber,
      bgmType = "none",
      narrationExpected = false,
    } = job.data;

    if (!scenes?.length || !photos?.length) {
      throw new Error("scenes, photos 필수");
    }

    // ── 사전 게이트 ②: 나레이션 요청했는데 ElevenLabs 오디오가 0개면 Remotion 시작 전 실패 ──
    const validAudioCount = (narrationAudios || []).filter(Boolean).length;
    if (narrationExpected && validAudioCount === 0) {
      throw new Error(
        "나레이션 음성 생성 실패 — ElevenLabs 응답이 비어있어 영상을 만들지 않았습니다. 다시 시도해 주세요."
      );
    }

    console.log(
      `[${jobId}] 시작 — ${scenes.length}장면 ${photos.length}사진 bgm:${bgmType} 나레이션:${validAudioCount}/${(narrationAudios || []).length}`
    );
    await setProgress(5, "렌더링 시작", "rendering");

    // Step 1: Remotion 렌더 (5~75% 구간)
    const { totalFrames, durationSec } = await renderVideo({
      scenes,
      photos: photos.slice(0, 6),
      companyName,
      phoneNumber,
      bgmType,
      outputPath: videoPath,
      onProgress: (p) => {
        const mapped = 5 + Math.round(p * 70);
        // onProgress는 fire-and-forget — 리포팅 실패가 렌더를 막지 않도록
        job
          .updateProgress({ progress: mapped, stage: "장면 렌더링", subStatus: "rendering" })
          .catch(() => {});
        if (p % 0.1 < 0.02) {
          console.log(`[${jobId}] 렌더링 ${Math.round(p * 100)}% (${elapsed()})`);
        }
      },
    });
    console.log(`[${jobId}] Remotion 완료: ${totalFrames}프레임 (${elapsed()})`);
    await setProgress(78, "오디오 합성", "mixing");

    // Step 2: 나레이션 concat
    let hasNarration = false;
    const validAudios = (narrationAudios || []).filter(Boolean);
    if (validAudios.length > 0) {
      for (let i = 0; i < validAudios.length; i++) {
        const ap = `/tmp/sms_${jobId}_nar_${i}.mp3`;
        fs.writeFileSync(ap, Buffer.from(validAudios[i], "base64"));
        narrationFiles.push(ap);
      }
      if (narrationFiles.length === 1) {
        fs.copyFileSync(narrationFiles[0], audioPath);
      } else {
        fs.writeFileSync(listFile, narrationFiles.map((f) => `file '${f}'`).join("\n"));
        execSync(`${ffmpegPath} -y -f concat -safe 0 -i "${listFile}" -c copy "${audioPath}"`);
      }
      hasNarration = true;
    }

    // Step 3: BGM
    let hasBgm = false;
    if (bgmType && bgmType !== "none") {
      hasBgm = generateBgm(bgmType, durationSec + 1, bgmPath);
    }
    await setProgress(85, "오디오 믹싱", "mixing");

    // Step 4: 믹싱 + 영상과 합체
    let uploadPath = videoPath;
    let finalAudioPath = null;

    if (hasNarration && hasBgm) {
      execSync(
        `${ffmpegPath} -y -i "${audioPath}" -i "${bgmPath}" ` +
          `-filter_complex "[0:a]volume=1.0[nar];[1:a]volume=0.25[bgm];[nar][bgm]amix=inputs=2:normalize=0[out]" ` +
          `-map "[out]" -c:a libmp3lame -b:a 192k "${mixedPath}"`
      );
      finalAudioPath = mixedPath;
    } else if (hasNarration) {
      finalAudioPath = audioPath;
    } else if (hasBgm) {
      finalAudioPath = bgmPath;
    }

    if (finalAudioPath) {
      execSync(
        `${ffmpegPath} -y -i "${videoPath}" -i "${finalAudioPath}" ` +
          `-c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "${finalPath}"`
      );
      uploadPath = finalPath;
    }

    console.log(`[${jobId}] 오디오 처리 완료 (${elapsed()})`);
    await setProgress(90, "출력 검증 중", "verifying");

    // ── 사후 게이트 ③: ffmpeg probe로 최종 MP4 검증 ──
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

    // Step 5: Supabase Storage 업로드
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

    console.log(`[${jobId}] 완료! (${elapsed()}) → ${url}`);
    await setProgress(100, "완료", "done");

    return {
      videoUrl: url,
      durationSec: Math.round(durationSec),
      frames: totalFrames,
    };
  } finally {
    // /tmp 누수 방지 — 나레이션 개별 파일까지 정리
    const toCleanup = [videoPath, audioPath, bgmPath, mixedPath, finalPath, listFile, ...narrationFiles];
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
  console.log(`[worker] 완료 jobId=${job.id} videoUrl=${result?.videoUrl}`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] 실패 jobId=${job?.id}: ${err?.message || err}`);
});

worker.on("error", (err) => {
  console.error(`[worker] 내부 오류: ${err?.message || err}`);
});

// Graceful shutdown — Railway redeploy/scale-down 시 현재 잡을 마무리한 뒤 종료
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
  `SMS Video Worker v5.0 (BullMQ) — queue="${QUEUE_NAME}" concurrency=${WORKER_CONCURRENCY}`
);
console.log(`  Redis: ${process.env.REDIS_URL ? "연결됨" : "기본 127.0.0.1:6379"}`);
console.log(`  Supabase: ${process.env.SUPABASE_URL ? "연결됨" : "미설정"}`);

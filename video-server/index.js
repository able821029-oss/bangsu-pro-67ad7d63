const express = require("express");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
const ffmpegPath = require("ffmpeg-static");
const { renderVideo, FPS } = require("./renderer");
const { generateBgm } = require("./bgm");

const app = express();

// ── CORS ──
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: "200mb" }));

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── API 시크릿 인증 ──
const API_SECRET = process.env.VIDEO_API_SECRET || "";
const authMiddleware = (req, res, next) => {
  const token = req.headers["x-api-secret"] || req.headers.authorization?.replace("Bearer ", "");
  if (!API_SECRET) return next();
  if (token !== API_SECRET) return res.status(401).json({ error: "인증 실패" });
  next();
};

// ── 헬스체크 ──
app.get("/health", (_, res) => {
  res.json({ ok: true, ts: Date.now(), version: "4.0-async", activeJobs: jobs.size });
});

// ── 비동기 잡 저장소 ──
// Railway 게이트웨이 504(통상 100~180초) 회피를 위해 렌더를 백그라운드로 돌리고
// 클라이언트는 짧은 HTTP 호출을 폴링해서 상태를 받아간다.
const jobs = new Map();

// 1시간 이상 된 잡 정리
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > 60 * 60 * 1000) jobs.delete(id);
  }
}, 10 * 60 * 1000);

function setJob(id, patch) {
  const prev = jobs.get(id);
  if (!prev) return;
  jobs.set(id, { ...prev, ...patch, updatedAt: Date.now() });
}

async function runRender(jobId, body) {
  const videoPath = `/tmp/sms_${jobId}.mp4`;
  const audioPath = `/tmp/sms_${jobId}_audio.mp3`;
  const bgmPath = `/tmp/sms_${jobId}_bgm.mp3`;
  const mixedPath = `/tmp/sms_${jobId}_mixed.mp3`;
  const finalPath = `/tmp/sms_${jobId}_final.mp4`;

  const startTime = Date.now();
  const elapsed = () => `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

  try {
    const {
      scenes,
      photos,
      narrationAudios,
      companyName,
      phoneNumber,
      bgmType = "none",
    } = body;

    if (!scenes?.length || !photos?.length) {
      setJob(jobId, { status: "error", error: "scenes, photos 필수" });
      return;
    }

    console.log(`[${jobId}] 시작 — ${scenes.length}장면 ${photos.length}사진 bgm:${bgmType}`);
    setJob(jobId, { status: "rendering", progress: 5, stage: "렌더링 시작" });

    // Step 1: Remotion 렌더링 — 진행률 5% → 75% 구간 매핑
    const { totalFrames, durationSec } = await renderVideo({
      scenes,
      photos: photos.slice(0, 6),
      companyName,
      phoneNumber,
      bgmType,
      outputPath: videoPath,
      onProgress: (p) => {
        const mapped = 5 + Math.round(p * 70); // 5~75
        setJob(jobId, { status: "rendering", progress: mapped, stage: "장면 렌더링" });
        if (p % 0.1 < 0.02) console.log(`[${jobId}] 렌더링 ${Math.round(p * 100)}% (${elapsed()})`);
      },
    });
    console.log(`[${jobId}] Remotion 완료: ${totalFrames}프레임 (${elapsed()})`);
    setJob(jobId, { status: "mixing", progress: 78, stage: "오디오 합성" });

    // Step 2: 나레이션 오디오
    let hasNarration = false;
    const validAudios = (narrationAudios || []).filter(Boolean);
    if (validAudios.length > 0) {
      const audioFiles = [];
      for (let i = 0; i < validAudios.length; i++) {
        const ap = `/tmp/sms_${jobId}_nar_${i}.mp3`;
        fs.writeFileSync(ap, Buffer.from(validAudios[i], "base64"));
        audioFiles.push(ap);
      }
      if (audioFiles.length === 1) {
        fs.copyFileSync(audioFiles[0], audioPath);
      } else {
        const listFile = `/tmp/sms_${jobId}_list.txt`;
        fs.writeFileSync(listFile, audioFiles.map((f) => `file '${f}'`).join("\n"));
        execSync(`${ffmpegPath} -y -f concat -safe 0 -i "${listFile}" -c copy "${audioPath}"`);
        fs.unlinkSync(listFile);
      }
      audioFiles.forEach((f) => { try { fs.unlinkSync(f); } catch {} });
      hasNarration = true;
    }

    // Step 3: BGM
    let hasBgm = false;
    if (bgmType && bgmType !== "none") {
      hasBgm = generateBgm(bgmType, durationSec + 1, bgmPath);
    }
    setJob(jobId, { progress: 85, stage: "오디오 믹싱" });

    // Step 4: 오디오 믹싱 + 영상 합체
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
    setJob(jobId, { status: "uploading", progress: 92, stage: "Supabase 업로드" });

    // Step 5: Supabase Storage 업로드
    const videoBuffer = fs.readFileSync(uploadPath);
    const storagePath = `videos/${jobId}.mp4`;

    try {
      await supabase.storage.createBucket("sms-videos", { public: true, fileSizeLimit: 104857600 });
    } catch {}

    const { error: uploadErr } = await supabase.storage
      .from("sms-videos")
      .upload(storagePath, videoBuffer, { contentType: "video/mp4", cacheControl: "3600" });

    if (uploadErr) throw new Error(`Storage 업로드 실패: ${uploadErr.message}`);

    const { data: { publicUrl: url } } = supabase.storage.from("sms-videos").getPublicUrl(storagePath);

    console.log(`[${jobId}] 완료! (${elapsed()}) → ${url}`);
    setJob(jobId, {
      status: "done",
      progress: 100,
      stage: "완료",
      videoUrl: url,
      durationSec: Math.round(durationSec),
      frames: totalFrames,
    });
  } catch (err) {
    console.error(`[${jobId}] 오류:`, err.stack || err.message);
    setJob(jobId, {
      status: "error",
      error: err.message?.slice(0, 300) || "unknown",
    });
  } finally {
    [videoPath, audioPath, bgmPath, mixedPath, finalPath].forEach((p) => {
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
    });
  }
}

// ── POST /render-start — 즉시 jobId 반환, 백그라운드 실행 ──
app.post("/render-start", authMiddleware, (req, res) => {
  const jobId = uuidv4();
  jobs.set(jobId, {
    jobId,
    status: "pending",
    progress: 0,
    stage: "대기 중",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  console.log(`[${jobId}] 큐 등록 (activeJobs=${jobs.size})`);
  runRender(jobId, req.body).catch((err) => {
    console.error(`[${jobId}] runRender unhandled:`, err.message);
    setJob(jobId, { status: "error", error: err.message?.slice(0, 300) || "unknown" });
  });
  res.json({ ok: true, jobId });
});

// ── GET /render-status/:jobId ──
app.get("/render-status/:jobId", authMiddleware, (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "job not found" });
  res.json(job);
});

// ── POST /render-video (레거시 동기식, 호환 유지) ──
// 기존 클라이언트가 업데이트되기 전까지 작동하도록 유지. Railway 504 발생 가능.
app.post("/render-video", authMiddleware, async (req, res) => {
  const jobId = uuidv4();
  jobs.set(jobId, {
    jobId, status: "pending", progress: 0, stage: "대기 중",
    createdAt: Date.now(), updatedAt: Date.now(),
  });
  await runRender(jobId, req.body);
  const final = jobs.get(jobId);
  if (final?.status === "done") {
    res.json({
      ok: true,
      videoUrl: final.videoUrl,
      jobId,
      durationSec: final.durationSec,
      frames: final.frames,
    });
  } else {
    res.status(500).json({ error: final?.error || "렌더 실패" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`SMS Video Server v4.0 (async polling) — :${PORT}`);
  console.log(`  FFmpeg: ${ffmpegPath}`);
  console.log(`  Supabase: ${process.env.SUPABASE_URL ? "연결됨" : "미설정"}`);
});

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

// env var trim (줄바꿈·공백 제거)
const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── API 시크릿 인증 미들웨어 (Edge Function → Railway 서버간 통신) ──
const API_SECRET = process.env.VIDEO_API_SECRET || "";
const authMiddleware = (req, res, next) => {
  const token = req.headers["x-api-secret"] || req.headers.authorization?.replace("Bearer ", "");
  if (!API_SECRET) {
    // 시크릿 미설정 시 통과 (개발 환경)
    return next();
  }
  if (token !== API_SECRET) {
    return res.status(401).json({ error: "인증 실패" });
  }
  next();
};

// ── 헬스체크 ──
app.get("/health", (_, res) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  // JWT payload 디코딩 (role, ref, exp 확인)
  let jwtInfo = null;
  try {
    const parts = key.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
      jwtInfo = {
        role: payload.role,
        ref: payload.ref,
        iat: payload.iat,
        exp: payload.exp,
      };
    }
  } catch {}

  res.json({
    ok: true,
    ts: Date.now(),
    version: "3.2-remotion",
    envCheck: {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      supabaseUrl: process.env.SUPABASE_URL,
      hasServiceKey: !!key,
      serviceKeyLength: key.length,
      serviceKeyTail: key.slice(-20),
      jwt: jwtInfo,
    },
  });
});

// ── 영상 렌더링 (인증 필수) ──
app.post("/render-video", authMiddleware, async (req, res) => {
  const jobId = uuidv4();
  const videoPath = `/tmp/sms_${jobId}.mp4`;
  const audioPath = `/tmp/sms_${jobId}_audio.mp3`;
  const bgmPath = `/tmp/sms_${jobId}_bgm.mp3`;
  const mixedPath = `/tmp/sms_${jobId}_mixed.mp3`;
  const finalPath = `/tmp/sms_${jobId}_final.mp4`;

  console.log(`[${jobId}] 요청 수신`);

  try {
    const {
      scenes,
      photos,
      narrationAudios,
      companyName,
      phoneNumber,
      bgmType = "none",
    } = req.body;

    if (!scenes?.length || !photos?.length) {
      return res.status(400).json({ error: "scenes, photos 필수" });
    }

    const startTime = Date.now();
    const elapsed = () => `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

    console.log(`[${jobId}] 시작 — ${scenes.length}장면 ${photos.length}사진 bgm:${bgmType}`);

    // Step 1: Remotion 렌더링 (영상만, 오디오 없이)
    const { totalFrames, durationSec } = await renderVideo({
      scenes,
      photos: photos.slice(0, 6),
      companyName,
      phoneNumber,
      bgmType,
      outputPath: videoPath,
      onProgress: (p) => {
        if (p % 0.1 < 0.02) console.log(`[${jobId}] 렌더링 ${Math.round(p * 100)}% (${elapsed()})`);
      },
    });
    console.log(`[${jobId}] Remotion 렌더링 완료: ${totalFrames}프레임 (${elapsed()})`);

    // Step 2: 나레이션 오디오 처리
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

    // Step 3: BGM 생성
    let hasBgm = false;
    if (bgmType && bgmType !== "none") {
      hasBgm = generateBgm(bgmType, durationSec + 1, bgmPath);
    }

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
    res.json({
      ok: true,
      videoUrl: url,
      jobId,
      durationSec: Math.round(durationSec),
      frames: totalFrames,
    });
  } catch (err) {
    console.error(`[${jobId}] 오류:`, err.stack || err.message);
    res.status(500).json({
      error: "영상 생성에 실패했습니다. 다시 시도해주세요.",
      detail: err.message?.slice(0, 300) || "unknown",
      step: err.step || "unknown",
    });
  } finally {
    [videoPath, audioPath, bgmPath, mixedPath, finalPath].forEach((p) => {
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`SMS Video Server v3.0 (Remotion) — :${PORT}`);
  console.log(`  FFmpeg: ${ffmpegPath}`);
  console.log(`  Supabase: ${process.env.SUPABASE_URL ? "연결됨" : "미설정"}`);
});

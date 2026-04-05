const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const ffmpegPath = require('ffmpeg-static');
const { renderFramesToDir, FPS } = require('./renderer');
const { generateBgm } = require('./bgm');

const app = express();
app.use(cors());
app.use(express.json({ limit: '200mb' }));

// Supabase 클라이언트
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── 헬스체크 ──
app.get('/health', (_, res) => {
  res.json({ ok: true, ts: Date.now(), version: '2.0' });
});

// ── 영상 렌더링 ──
app.post('/render-video', async (req, res) => {
  const jobId = uuidv4();
  const tmpDir = `/tmp/sms_${jobId}`;
  const videoPath = `/tmp/sms_${jobId}.mp4`;
  const audioPath = `/tmp/sms_${jobId}_audio.mp3`;
  const bgmPath = `/tmp/sms_${jobId}_bgm.mp3`;
  const mixedPath = `/tmp/sms_${jobId}_mixed.mp3`;

  console.log(`[${jobId}] 요청 수신`);

  try {
    const {
      scenes,
      photos,
      narrationAudios,
      companyName,
      phoneNumber,
      bgmType = 'none',
    } = req.body;

    if (!scenes?.length || !photos?.length) {
      return res.status(400).json({ error: 'scenes, photos 필수' });
    }

    const startTime = Date.now();
    const elapsed = () => `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

    console.log(`[${jobId}] 시작 — ${scenes.length}장면 ${photos.length}사진 bgm:${bgmType}`);

    // ── Step 1: 프레임 렌더링 ──
    const totalFrames = await renderFramesToDir(
      scenes, photos, companyName, phoneNumber, tmpDir,
      (si, total) => console.log(`[${jobId}] 장면 ${si + 1}/${total} (${elapsed()})`)
    );
    const durationSec = totalFrames / FPS;
    console.log(`[${jobId}] 프레임 완료: ${totalFrames}개 (${durationSec.toFixed(1)}초) ${elapsed()}`);

    // ── Step 2: 나레이션 오디오 처리 ──
    let hasNarration = false;
    const validAudios = (narrationAudios || []).filter(Boolean);
    if (validAudios.length > 0) {
      const audioFiles = [];
      for (let i = 0; i < validAudios.length; i++) {
        const ap = `/tmp/sms_${jobId}_nar_${i}.mp3`;
        fs.writeFileSync(ap, Buffer.from(validAudios[i], 'base64'));
        audioFiles.push(ap);
      }
      if (audioFiles.length === 1) {
        fs.copyFileSync(audioFiles[0], audioPath);
      } else {
        const listFile = `/tmp/sms_${jobId}_list.txt`;
        fs.writeFileSync(listFile, audioFiles.map(f => `file '${f}'`).join('\n'));
        execSync(`${ffmpegPath} -y -f concat -safe 0 -i "${listFile}" -c copy "${audioPath}"`);
        fs.unlinkSync(listFile);
      }
      audioFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
      hasNarration = true;
      console.log(`[${jobId}] 나레이션 오디오 준비 완료 ${elapsed()}`);
    }

    // ── Step 3: BGM 생성 ──
    let hasBgm = false;
    if (bgmType && bgmType !== 'none') {
      hasBgm = generateBgm(bgmType, durationSec + 1, bgmPath);
      console.log(`[${jobId}] BGM ${hasBgm ? '생성 완료' : '생성 실패'} ${elapsed()}`);
    }

    // ── Step 4: 오디오 믹싱 (나레이션 + BGM) ──
    let finalAudioPath = null;
    if (hasNarration && hasBgm) {
      // 나레이션 + BGM 믹싱 (나레이션 우선, BGM 볼륨 낮춤)
      execSync(
        `${ffmpegPath} -y -i "${audioPath}" -i "${bgmPath}" ` +
        `-filter_complex "[0:a]volume=1.0[nar];[1:a]volume=0.25[bgm];[nar][bgm]amix=inputs=2:normalize=0[out]" ` +
        `-map "[out]" -c:a libmp3lame -b:a 192k "${mixedPath}"`
      );
      finalAudioPath = mixedPath;
      console.log(`[${jobId}] 오디오 믹싱 완료 ${elapsed()}`);
    } else if (hasNarration) {
      finalAudioPath = audioPath;
    } else if (hasBgm) {
      finalAudioPath = bgmPath;
    }

    // ── Step 5: FFmpeg 영상 합성 ──
    const framePattern = path.join(tmpDir, 'f%06d.jpg');
    let ffCmd;

    if (finalAudioPath) {
      ffCmd = [
        ffmpegPath, '-y',
        `-framerate ${FPS}`,
        `-i "${framePattern}"`,
        `-i "${finalAudioPath}"`,
        `-c:v libx264 -preset fast -crf 18`,
        `-pix_fmt yuv420p`,
        `-c:a aac -b:a 192k`,
        `-shortest`,
        `-movflags +faststart`,
        `"${videoPath}"`
      ].join(' ');
    } else {
      ffCmd = [
        ffmpegPath, '-y',
        `-framerate ${FPS}`,
        `-i "${framePattern}"`,
        `-c:v libx264 -preset fast -crf 18`,
        `-pix_fmt yuv420p`,
        `-movflags +faststart`,
        `"${videoPath}"`
      ].join(' ');
    }

    execSync(ffCmd, { maxBuffer: 1024 * 1024 * 512 });
    console.log(`[${jobId}] 영상 합성 완료 ${elapsed()}`);

    // ── Step 6: Supabase Storage 업로드 ──
    const videoBuffer = fs.readFileSync(videoPath);
    const storagePath = `videos/${jobId}.mp4`;

    let publicUrl = '';
    try {
      const { error: uploadErr } = await supabase.storage
        .from('sms-videos')
        .upload(storagePath, videoBuffer, {
          contentType: 'video/mp4',
          cacheControl: '3600',
        });

      if (uploadErr) {
        console.warn(`[${jobId}] Storage 업로드 실패:`, uploadErr.message);
        // 버킷 없으면 생성 시도
        if (uploadErr.message.includes('Bucket not found') || uploadErr.message.includes('not found')) {
          console.log(`[${jobId}] sms-videos 버킷 생성 시도...`);
          await supabase.storage.createBucket('sms-videos', { public: true, fileSizeLimit: 104857600 });
          const { error: retryErr } = await supabase.storage
            .from('sms-videos')
            .upload(storagePath, videoBuffer, { contentType: 'video/mp4', cacheControl: '3600' });
          if (retryErr) throw new Error(`Storage 재업로드 실패: ${retryErr.message}`);
        } else {
          throw new Error(`Storage 업로드 실패: ${uploadErr.message}`);
        }
      }

      const { data: { publicUrl: url } } = supabase.storage
        .from('sms-videos')
        .getPublicUrl(storagePath);
      publicUrl = url;
    } catch (storageErr) {
      console.error(`[${jobId}] Storage 오류:`, storageErr.message);
      throw storageErr;
    }

    console.log(`[${jobId}] 🎬 완료! (총 ${elapsed()}) → ${publicUrl}`);

    res.json({
      ok: true,
      videoUrl: publicUrl,
      jobId,
      durationSec: Math.round(durationSec),
      frames: totalFrames,
    });

  } catch (err) {
    console.error(`[${jobId}] 오류:`, err.message);
    res.status(500).json({ error: err.message });
  } finally {
    [tmpDir, videoPath, audioPath, bgmPath, mixedPath].forEach(p => {
      try {
        if (fs.existsSync(p)) {
          if (fs.statSync(p).isDirectory()) fs.rmSync(p, { recursive: true });
          else fs.unlinkSync(p);
        }
      } catch {}
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 SMS Video Server v2.0 — :${PORT}`);
  console.log(`  FFmpeg: ${ffmpegPath}`);
  console.log(`  Supabase: ${process.env.SUPABASE_URL ? '연결됨' : '⚠️ 미설정'}`);
});

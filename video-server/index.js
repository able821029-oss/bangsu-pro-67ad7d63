const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const ffmpegPath = require('ffmpeg-static');
const { renderFramesToDir, FPS } = require('./renderer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '150mb' }));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 헬스체크
app.get('/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

// ── 영상 렌더링 엔드포인트 ──
app.post('/render-video', async (req, res) => {
  const jobId = uuidv4();
  const tmpDir = `/tmp/sms_${jobId}`;
  const videoPath = `/tmp/sms_${jobId}.mp4`;
  const audioPath = `/tmp/sms_${jobId}_audio.mp3`;

  try {
    const {
      scenes,
      photos,           // base64 dataUrl[]
      narrationAudios,  // base64 mp3[] | null[]
      companyName,
      phoneNumber,
      bgmType = 'none',
    } = req.body;

    if (!scenes || !photos) {
      return res.status(400).json({ error: 'scenes, photos 필수' });
    }

    console.log(`[${jobId}] 렌더링 시작 — ${scenes.length}장면, ${photos.length}장`);
    const startTime = Date.now();

    // 1. 프레임 렌더링
    const totalFrames = await renderFramesToDir(
      scenes, photos, companyName, phoneNumber, tmpDir,
      (si, total) => console.log(`[${jobId}] 장면 ${si+1}/${total}`)
    );
    console.log(`[${jobId}] 프레임 ${totalFrames}개 완료 (${Date.now()-startTime}ms)`);

    // 2. 오디오 준비 (ElevenLabs narration 믹싱)
    let hasAudio = false;
    const validAudios = (narrationAudios || []).filter(Boolean);
    if (validAudios.length > 0) {
      // 개별 MP3를 연결
      const audioFiles = [];
      for (let i = 0; i < validAudios.length; i++) {
        const ap = `/tmp/sms_${jobId}_nar_${i}.mp3`;
        fs.writeFileSync(ap, Buffer.from(validAudios[i], 'base64'));
        audioFiles.push(ap);
      }
      // concat filter로 합치기
      if (audioFiles.length === 1) {
        fs.copyFileSync(audioFiles[0], audioPath);
      } else {
        const listFile = `/tmp/sms_${jobId}_list.txt`;
        fs.writeFileSync(listFile, audioFiles.map(f => `file '${f}'`).join('\n'));
        execSync(`${ffmpegPath} -y -f concat -safe 0 -i "${listFile}" -c copy "${audioPath}"`);
        fs.unlinkSync(listFile);
      }
      audioFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
      hasAudio = true;
    }

    // 3. FFmpeg로 영상 합성
    const framePattern = path.join(tmpDir, 'f%06d.jpg');

    let ffCmd;
    if (hasAudio) {
      ffCmd = [
        ffmpegPath,
        `-y -framerate ${FPS}`,
        `-i "${framePattern}"`,
        `-i "${audioPath}"`,
        `-c:v libx264 -preset fast -crf 20`,
        `-pix_fmt yuv420p`,
        `-c:a aac -b:a 192k`,
        `-shortest`,
        `-movflags +faststart`,
        `"${videoPath}"`
      ].join(' ');
    } else {
      ffCmd = [
        ffmpegPath,
        `-y -framerate ${FPS}`,
        `-i "${framePattern}"`,
        `-c:v libx264 -preset fast -crf 20`,
        `-pix_fmt yuv420p`,
        `-movflags +faststart`,
        `"${videoPath}"`
      ].join(' ');
    }

    console.log(`[${jobId}] FFmpeg 시작`);
    execSync(ffCmd, { maxBuffer: 1024 * 1024 * 512 });
    console.log(`[${jobId}] FFmpeg 완료 (${Date.now()-startTime}ms)`);

    // 4. Supabase Storage 업로드
    const videoBuffer = fs.readFileSync(videoPath);
    const storagePath = `videos/${jobId}.mp4`;

    const { error: uploadErr } = await supabase.storage
      .from('sms-videos')
      .upload(storagePath, videoBuffer, {
        contentType: 'video/mp4',
        cacheControl: '3600',
      });

    if (uploadErr) throw new Error(`Storage 업로드 실패: ${uploadErr.message}`);

    const { data: { publicUrl } } = supabase.storage
      .from('sms-videos')
      .getPublicUrl(storagePath);

    console.log(`[${jobId}] 완료! ${publicUrl} (총 ${Date.now()-startTime}ms)`);

    res.json({ ok: true, videoUrl: publicUrl, jobId });

  } catch (err) {
    console.error(`[${jobId}] 오류:`, err.message);
    res.status(500).json({ error: err.message });
  } finally {
    // 임시 파일 정리
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
    try { fs.unlinkSync(videoPath); } catch {}
    try { fs.unlinkSync(audioPath); } catch {}
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SMS Video Server 실행 중 :${PORT}`));

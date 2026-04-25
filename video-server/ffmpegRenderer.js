// FFmpeg 네이티브 렌더러 — Remotion(Chromium) 우회로 렌더 시간 60~120s → 15~30s 단축
//
// 파이프라인:
//   1. 각 씬의 사진(or color source)을 -loop 1 -framerate 24 로 input
//   2. filter_complex에서 씬별로 scale+crop+zoompan(Ken Burns)+drawtext
//   3. xfade fade 트랜지션으로 씬을 순차 연결
//   4. H.264(libx264 veryfast, crf=23), 1080x1920, 24fps, yuv420p, faststart
//   5. 오디오 없는 mp4 (audioMixer가 후속 단계에서 합성)
//
// 한글 폰트: FONT_PATH env → fallback (Noto CJK/malgun). 둘 다 없으면 throw.

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ffmpegPath = require("./ffmpegBin");

const FPS = 24;
const W = 1080;
const H = 1920;
const TRANSITION_SEC = 0.5;

// Dockerfile의 fonts-noto-cjk + Windows 로컬 테스트용 폰트 경로
const FONT_FALLBACKS = [
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
  "/usr/share/fonts/truetype/noto/NotoSansKR-Bold.otf",
  "C:\\Windows\\Fonts\\malgunbd.ttf",
  "C:\\Windows\\Fonts\\malgun.ttf",
  "/System/Library/Fonts/AppleSDGothicNeo.ttc",
];

function resolveFontPath() {
  if (process.env.FONT_PATH && fs.existsSync(process.env.FONT_PATH)) {
    return process.env.FONT_PATH;
  }
  for (const p of FONT_FALLBACKS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * drawtext text='...' 내부에서 안전하도록 이스케이프.
 *
 * 관측 사례:
 *   1. `'` 포함 시 quote 조기 종료 → 곡선따옴표(U+2019) 치환으로 우회
 *   2. `:` 포함 시 single-quote 안이라도 옵션 구분자로 해석돼 다음 토큰이 잘려나감
 *      (예: scene.badge="시공:완료" → ffmpeg가 fontsize=40을 새 필터 이름으로 착각 → "Filter not found")
 *   3. `%`는 drawtext 변수 expansion(%{n}, %{pts}) 트리거 — 의도치 않은 치환 방지
 *
 * 순서 중요: 백슬래시 이중화를 가장 먼저 수행해 후속 `\:`, `\%`가 다시 escape되는 일을 막는다.
 */
function escapeText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\u2019")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%")
    .replace(/\n/g, "\\n");
}

/** fontfile=… 값에서 Windows path의 ':' 를 이스케이프해 ffmpeg param separator와 충돌 방지 */
function escapeFontPath(p) {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}

/** Edge Function에서 오는 "photo_N" 키 → photos 배열 인덱스 */
function resolvePhotoIndex(photoKey, fallbackIdx, photoCount) {
  if (!photoKey || !photoCount) return -1;
  const m = String(photoKey).match(/photo_(\d+)/);
  if (m) {
    const idx = parseInt(m[1], 10) - 1;
    return idx >= 0 && idx < photoCount ? idx : Math.min(fallbackIdx, photoCount - 1);
  }
  return -1;
}

/**
 * 단일 씬용 filter chain — 입력 인덱스는 항상 0 (각 씬을 자체 ffmpeg 호출로 렌더하므로).
 * 끝에 fade in/out을 추가해 분할 렌더 + concat 시 트랜지션 부재를 시각적으로 보정.
 */
function buildPhotoSceneFilter(scene, frames, durationSec, fontPath) {
  const fp = escapeFontPath(fontPath);
  let f = `[0:v]`;
  f += `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
  // Ken Burns — 전체 씬 동안 1.0 → 1.3배까지 천천히 확대
  f += `,zoompan=z='min(zoom+0.0015\\,1.3)':d=${frames}:s=${W}x${H}:fps=${FPS}`;
  f += `,format=yuv420p`;

  if (scene.title) {
    f += `,drawtext=fontfile=${fp}:text='${escapeText(scene.title)}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=h*0.08:box=1:boxcolor=black@0.5:boxborderw=16`;
  }
  if (scene.subtitle) {
    f += `,drawtext=fontfile=${fp}:text='${escapeText(scene.subtitle)}':fontcolor=white:fontsize=56:x=(w-text_w)/2:y=h*0.78:box=1:boxcolor=black@0.6:boxborderw=20`;
  }

  // 분할 렌더 트랜지션 보정 — 시작 0.3s fade in + 끝 0.3s fade out
  const fadeOutStart = Math.max(0, durationSec - TRANSITION_SEC).toFixed(3);
  f += `,fade=t=in:st=0:d=${TRANSITION_SEC}`;
  f += `,fade=t=out:st=${fadeOutStart}:d=${TRANSITION_SEC}`;

  f += `,setsar=1,fps=${FPS}[vout]`;
  return f;
}

function buildColorSceneFilter(scene, durationSec, fontPath) {
  const fp = escapeFontPath(fontPath);
  let f = `[0:v]format=yuv420p`;

  if (scene.title) {
    f += `,drawtext=fontfile=${fp}:text='${escapeText(scene.title)}':fontcolor=white:fontsize=80:x=(w-text_w)/2:y=h*0.42:box=0`;
  }
  if (scene.subtitle) {
    f += `,drawtext=fontfile=${fp}:text='${escapeText(scene.subtitle)}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=h*0.55:box=0`;
  }
  if (scene.badge) {
    f += `,drawtext=fontfile=${fp}:text='${escapeText(scene.badge)}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h*0.32:box=1:boxcolor=#237FFF@0.9:boxborderw=14`;
  }

  const fadeOutStart = Math.max(0, durationSec - TRANSITION_SEC).toFixed(3);
  f += `,fade=t=in:st=0:d=${TRANSITION_SEC}`;
  f += `,fade=t=out:st=${fadeOutStart}:d=${TRANSITION_SEC}`;

  f += `,setsar=1,fps=${FPS}[vout]`;
  return f;
}

/** 단일 씬 ffmpeg args 빌드 — 사진 또는 color 소스 → drawtext + zoompan + fade → mp4 */
function buildSingleSceneArgs(meta, photoFile, fontPath, scenePath, companyName, phoneNumber, isLast) {
  const args = [
    "-hide_banner", "-loglevel", "error", "-progress", "pipe:1", "-y",
    "-threads", "2", "-filter_complex_threads", "1",
  ];

  let filter;
  if (photoFile && fs.existsSync(photoFile)) {
    args.push("-loop", "1", "-framerate", "1", "-t", "1", "-i", photoFile);
    filter = buildPhotoSceneFilter(meta.scene, meta.frames, meta.durationSec, fontPath);
  } else {
    const useBgColor = pickBgColor(meta.scene);
    args.push(
      "-f", "lavfi",
      "-t", meta.durationSec.toFixed(3),
      "-i", `color=c=${useBgColor}:s=${W}x${H}:r=${FPS}`
    );
    const enriched = { ...meta.scene };
    if (!enriched.title && companyName) enriched.title = companyName;
    if (!enriched.subtitle && phoneNumber && isLast) enriched.subtitle = phoneNumber;
    filter = buildColorSceneFilter(enriched, meta.durationSec, fontPath);
  }

  args.push("-filter_complex", filter);
  args.push("-map", "[vout]");
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23");
  args.push("-pix_fmt", "yuv420p");
  args.push("-r", String(FPS));
  args.push("-t", meta.durationSec.toFixed(3));
  args.push(scenePath);
  return args;
}

/**
 * FFmpeg로 쇼츠 영상을 렌더한다.
 *
 * @param {Object} opts
 * @param {Array}  opts.scenes   - Edge Function 원본 형식 또는 Remotion 변환본 모두 지원 (duration | durationInFrames)
 * @param {string[]} opts.photos - data:image/...;base64,... URL 배열
 * @param {string} [opts.companyName]
 * @param {string} [opts.phoneNumber]
 * @param {string} [opts.style]
 * @param {string} opts.jobId
 * @param {string} opts.outputPath
 * @param {Function} [opts.onProgress] - (0~1) 진행률 콜백
 * @returns {Promise<{ videoPath, totalFrames, durationSec }>}
 */
async function renderFfmpegVideo({
  scenes,
  photos,
  companyName,
  phoneNumber,
  style,
  jobId,
  outputPath,
  onProgress,
}) {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error("scenes가 비어 있습니다");
  }
  const fontPath = resolveFontPath();
  if (!fontPath) {
    throw new Error(
      "한글 폰트를 찾을 수 없습니다. FONT_PATH 환경변수로 경로를 지정하거나 fonts-noto-cjk를 설치하세요"
    );
  }

  // base64 사진 → 임시 jpg 파일
  const tmpDir = os.tmpdir();
  const tmpPhotos = [];
  for (let i = 0; i < (photos || []).length; i++) {
    const dataUrl = photos[i];
    const m = typeof dataUrl === "string" && dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
    if (!m) {
      tmpPhotos.push(null);
      continue;
    }
    const ext = m[1] === "jpeg" ? "jpg" : m[1].replace(/[^a-z0-9]/gi, "") || "jpg";
    const p = path.join(tmpDir, `sms_${jobId}_in_${i}.${ext}`);
    fs.writeFileSync(p, Buffer.from(m[2], "base64"));
    tmpPhotos.push(p);
  }

  // 씬 메타 구성
  const sceneMeta = scenes.map((s, i) => {
    const frames = s.durationInFrames || s.duration || 84;
    const durationSec = frames / FPS;
    const photoIdx = resolvePhotoIndex(s.photo, i, tmpPhotos.filter(Boolean).length);
    return { scene: s, frames, durationSec, photoIdx };
  });

  // 분할 렌더 전략 — Railway 컨테이너 메모리 한계(Trial ~512MB) 안에서 안전 실행.
  // 모든 씬 input을 한 번의 ffmpeg 호출에 담으면 zoompan + xfade chain이 모든 stream을
  // 동시에 메모리에 올려 OOM(SIGKILL) 발생. 씬을 1개씩 따로 mp4로 만든 뒤 concat 하면
  // 동시 메모리 사용이 1/N로 평탄화된다. 트랜지션은 각 씬 시작·끝 fade로 보정.
  const totalSec = sceneMeta.reduce((a, m) => a + m.durationSec, 0);
  const totalFrames = Math.round(totalSec * FPS);

  console.log(
    `[ffmpegRenderer] style=${style || "기본"} 씬=${sceneMeta.length} 총 ${totalSec.toFixed(2)}s ` +
      `(${totalFrames}프레임) 전략=분할렌더+concat`
  );

  const sceneVideos = [];
  const cleanupPaths = [...tmpPhotos.filter(Boolean)];

  try {
    // Step 1: 각 씬을 개별 ffmpeg 호출로 mp4 렌더 — 동시 메모리는 1개 씬 분량만
    for (let i = 0; i < sceneMeta.length; i++) {
      const m = sceneMeta[i];
      const photoFile = m.photoIdx >= 0 ? tmpPhotos[m.photoIdx] : null;
      const scenePath = path.join(tmpDir, `sms_${jobId}_scene_${i}.mp4`);
      const isLast = i === sceneMeta.length - 1;

      const args = buildSingleSceneArgs(m, photoFile, fontPath, scenePath, companyName, phoneNumber, isLast);

      // 진행률 — 씬별 0~85% 구간을 N등분, concat은 85~100%
      const sceneStartPct = (i / sceneMeta.length) * 0.85;
      const sceneEndPct = ((i + 1) / sceneMeta.length) * 0.85;
      await runFfmpeg(args, m.durationSec, (p) => {
        if (onProgress) onProgress(sceneStartPct + (sceneEndPct - sceneStartPct) * p);
      });

      sceneVideos.push(scenePath);
      cleanupPaths.push(scenePath);
      console.log(`[ffmpegRenderer] 씬 ${i + 1}/${sceneMeta.length} 완료 (${m.durationSec.toFixed(2)}s)`);
    }

    // Step 2: concat demuxer로 합치기 — stream copy라 메모리 거의 안 씀
    const listFile = path.join(tmpDir, `sms_${jobId}_concat.txt`);
    const listContent = sceneVideos.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
    fs.writeFileSync(listFile, listContent);
    cleanupPaths.push(listFile);

    const concatArgs = [
      "-hide_banner", "-loglevel", "error", "-progress", "pipe:1", "-y",
      "-f", "concat", "-safe", "0",
      "-i", listFile,
      "-c", "copy",
      "-movflags", "+faststart",
      outputPath,
    ];

    await runFfmpeg(concatArgs, totalSec, (p) => {
      if (onProgress) onProgress(0.85 + p * 0.15);
    });

    console.log(`[ffmpegRenderer] concat 완료 → ${outputPath}`);
  } finally {
    // 모든 임시 파일 정리 — 실패 시에도 /tmp 누수 방지
    for (const p of cleanupPaths) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }

  return {
    videoPath: outputPath,
    totalFrames,
    durationSec: totalSec,
  };
}

function pickBgColor(scene) {
  if (Array.isArray(scene.bg_colors) && scene.bg_colors[0]) {
    // ffmpeg color= 필터는 #RGB 그대로 받음
    return String(scene.bg_colors[0]);
  }
  return "#0B1535";
}

function runFfmpeg(args, totalSec, onProgress) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let stderrBuf = "";
    let progressBuf = "";

    proc.stdout.on("data", (chunk) => {
      progressBuf += chunk.toString();
      const lines = progressBuf.split("\n");
      progressBuf = lines.pop() || "";
      for (const line of lines) {
        const kv = line.match(/^([a-z_]+)=(.+)$/i);
        if (!kv) continue;
        // out_time_us (ffmpeg >=4.x) 또는 out_time_ms (일부 빌드)
        if (kv[1] === "out_time_us" || kv[1] === "out_time_ms") {
          const us = parseInt(kv[2], 10);
          if (Number.isFinite(us) && us > 0 && totalSec > 0) {
            // out_time_us는 마이크로초, out_time_ms는 예전 명명이지만 실제론 ms가 아닌 us일 수 있음 (ffmpeg 변동)
            const sec = us / 1_000_000;
            const pct = Math.min(1, Math.max(0, sec / totalSec));
            if (onProgress) onProgress(pct);
          }
        }
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString();
    });

    proc.on("error", reject);
    proc.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        // 실패 시 진단 정보를 stderr에 전체 덤프 — Railway 로그에서 원인 추적용.
        // code=null + signal!=null = 외부 시그널로 죽음 (SIGKILL은 OOM kill 가능성 높음)
        const fcIdx = args.indexOf("-filter_complex");
        const fc = fcIdx >= 0 ? args[fcIdx + 1] : "<없음>";
        const sigHint = signal === "SIGKILL"
          ? " ← OOM kill 의심 (메모리 한도 초과)"
          : signal === "SIGSEGV"
          ? " ← segfault (ffmpeg 빌드 또는 인자 문제)"
          : "";
        console.error(`[ffmpeg] exit code=${code} signal=${signal}${sigHint}`);
        console.error(`[ffmpeg] ───── stderr 전체 (${stderrBuf.length} chars) ─────`);
        console.error(stderrBuf || "<비어있음>");
        console.error(`[ffmpeg] ───── -filter_complex 인자 (${fc.length} chars) ─────`);
        console.error(fc);
        console.error(`[ffmpeg] ───── 끝 ─────`);
        const tail = stderrBuf.slice(-500) || `signal=${signal}${sigHint}`;
        reject(new Error(`ffmpeg exit ${code}: ${tail}`));
      }
    });
  });
}

/**
 * ffmpeg 바이너리의 버전 + 핵심 필터(xfade, drawtext, zoompan) 가용성 점검.
 * startup에서 한 번 호출해 결과를 로그로 남기면 "Filter not found" 에러가 났을 때
 * 진짜 빌드 옵션 문제인지, 아니면 args escape 문제인지 즉시 구분 가능.
 */
function diagnoseFfmpeg() {
  const result = { binPath: ffmpegPath, version: "?", filters: {} };
  try {
    const v = spawnSync(ffmpegPath, ["-hide_banner", "-version"], { encoding: "utf8" });
    const m = (v.stdout || "").match(/ffmpeg version (\S+)/);
    result.version = m ? m[1] : (v.stdout || "").split("\n")[0];
  } catch {
    /* ignore */
  }
  for (const name of ["xfade", "drawtext", "zoompan", "scale", "concat"]) {
    try {
      const r = spawnSync(ffmpegPath, ["-hide_banner", "-h", `filter=${name}`], { encoding: "utf8" });
      const out = (r.stdout || "") + (r.stderr || "");
      result.filters[name] = !/Unknown filter|No such filter/i.test(out) && /Filter\s+/i.test(out);
    } catch {
      result.filters[name] = false;
    }
  }
  return result;
}

module.exports = {
  renderFfmpegVideo,
  resolveFontPath,
  diagnoseFfmpeg,
  FPS,
  W,
  H,
  TRANSITION_SEC,
};

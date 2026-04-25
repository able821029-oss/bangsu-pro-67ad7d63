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
const ffmpegPath = require("ffmpeg-static");

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

function buildPhotoSceneFilter(inputIdx, scene, frames, fontPath) {
  const label = `v${inputIdx}`;
  const fp = escapeFontPath(fontPath);
  let f = `[${inputIdx}:v]`;
  f += `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
  // Ken Burns — 전체 씬 동안 1.0 → 1.3배까지 천천히 확대
  f += `,zoompan=z='min(zoom+0.0015\\,1.3)':d=${frames}:s=${W}x${H}:fps=${FPS}`;
  f += `,format=yuv420p`;

  // 상단 타이틀 (있을 때만)
  if (scene.title) {
    f += `,drawtext=fontfile=${fp}:text='${escapeText(scene.title)}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=h*0.08:box=1:boxcolor=black@0.5:boxborderw=16`;
  }
  // 하단 자막 (subtitle) — 하단 20% 영역 · 반투명 박스
  if (scene.subtitle) {
    f += `,drawtext=fontfile=${fp}:text='${escapeText(scene.subtitle)}':fontcolor=white:fontsize=56:x=(w-text_w)/2:y=h*0.78:box=1:boxcolor=black@0.6:boxborderw=20`;
  }

  f += `,setsar=1,fps=${FPS}[${label}]`;
  return { filter: f, label };
}

function buildColorSceneFilter(inputIdx, scene, fontPath) {
  const label = `v${inputIdx}`;
  const fp = escapeFontPath(fontPath);
  let f = `[${inputIdx}:v]format=yuv420p`;

  // photo=null 씬은 보통 인트로/엔딩 — title + subtitle 둘 다 표시
  if (scene.title) {
    f += `,drawtext=fontfile=${fp}:text='${escapeText(scene.title)}':fontcolor=white:fontsize=80:x=(w-text_w)/2:y=h*0.42:box=0`;
  }
  if (scene.subtitle) {
    f += `,drawtext=fontfile=${fp}:text='${escapeText(scene.subtitle)}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=h*0.55:box=0`;
  }
  if (scene.badge) {
    f += `,drawtext=fontfile=${fp}:text='${escapeText(scene.badge)}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h*0.32:box=1:boxcolor=#237FFF@0.9:boxborderw=14`;
  }

  f += `,setsar=1,fps=${FPS}[${label}]`;
  return { filter: f, label };
}

function buildXfadeChain(labels, durations) {
  if (labels.length === 0) return { filter: "", outLabel: null };
  if (labels.length === 1) return { filter: "", outLabel: labels[0] };

  const parts = [];
  let currentLabel = labels[0];
  let currentOffset = durations[0] - TRANSITION_SEC;

  for (let i = 1; i < labels.length; i++) {
    const outLabel = i === labels.length - 1 ? "vout" : `xf${i}`;
    parts.push(
      `[${currentLabel}][${labels[i]}]xfade=transition=fade:duration=${TRANSITION_SEC}:offset=${currentOffset.toFixed(3)}[${outLabel}]`
    );
    currentLabel = outLabel;
    currentOffset += durations[i] - TRANSITION_SEC;
  }

  return { filter: parts.join(";"), outLabel: currentLabel };
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

  // ffmpeg args 조립
  const args = ["-hide_banner", "-loglevel", "error", "-progress", "pipe:1", "-y"];
  const sceneFilters = [];
  const sceneLabels = [];
  let inputIdx = 0;

  for (let i = 0; i < sceneMeta.length; i++) {
    const m = sceneMeta[i];
    const photoFile = m.photoIdx >= 0 ? tmpPhotos[m.photoIdx] : null;
    const useBgColor = pickBgColor(m.scene);

    if (photoFile && fs.existsSync(photoFile)) {
      // zoompan은 각 input 프레임마다 d개 출력 프레임을 만든다.
      // 따라서 input을 1프레임으로 엄격 제한하고 씬 길이는 zoompan d/fps로 제어.
      // `-framerate 1 -t 1` → 1 input frame 생성.
      args.push("-loop", "1", "-framerate", "1", "-t", "1", "-i", photoFile);
      const { filter, label } = buildPhotoSceneFilter(inputIdx, m.scene, m.frames, fontPath);
      sceneFilters.push(filter);
      sceneLabels.push(label);
    } else {
      // 사진 없는 씬 → lavfi color 소스
      args.push(
        "-f", "lavfi",
        "-t", m.durationSec.toFixed(3),
        "-i", `color=c=${useBgColor}:s=${W}x${H}:r=${FPS}`
      );
      const scene = { ...m.scene };
      // 엔딩/인트로 씬에서 title이 비어있으면 업체명으로 보강
      if (!scene.title && companyName) scene.title = companyName;
      if (!scene.subtitle && phoneNumber && isLastScene(i, sceneMeta)) scene.subtitle = phoneNumber;
      const { filter, label } = buildColorSceneFilter(inputIdx, scene, fontPath);
      sceneFilters.push(filter);
      sceneLabels.push(label);
    }
    inputIdx++;
  }

  const { filter: xfadeFilter, outLabel } = buildXfadeChain(
    sceneLabels,
    sceneMeta.map((m) => m.durationSec)
  );

  const filterComplex = [
    ...sceneFilters,
    ...(xfadeFilter ? [xfadeFilter] : []),
  ].join(";");

  args.push("-filter_complex", filterComplex);
  args.push("-map", `[${outLabel}]`);
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23");
  args.push("-pix_fmt", "yuv420p");
  args.push("-r", String(FPS));
  args.push("-movflags", "+faststart");
  args.push(outputPath);

  const totalSec =
    sceneMeta.reduce((a, m) => a + m.durationSec, 0) -
    Math.max(0, sceneMeta.length - 1) * TRANSITION_SEC;
  const totalFrames = Math.round(totalSec * FPS);

  console.log(`[ffmpegRenderer] style=${style || "기본"} 씬=${sceneMeta.length} 총 ${totalSec.toFixed(2)}s (${totalFrames}프레임)`);

  await runFfmpeg(args, totalSec, onProgress);

  // 임시 입력 파일 정리
  for (const p of tmpPhotos) {
    if (!p) continue;
    try { fs.unlinkSync(p); } catch { /* ignore */ }
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

function isLastScene(i, sceneMeta) {
  return i === sceneMeta.length - 1;
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
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        // 실패 시 진단 정보를 stderr에 전체 덤프 — Railway 로그에서 원인 추적용.
        // -filter_complex 인자는 단일 토큰이라 매우 길지만, escape 실수 등을 잡으려면 전체가 필요.
        const fcIdx = args.indexOf("-filter_complex");
        const fc = fcIdx >= 0 ? args[fcIdx + 1] : "<없음>";
        console.error(`[ffmpeg] exit=${code} ───── stderr 전체 ─────`);
        console.error(stderrBuf);
        console.error(`[ffmpeg] ───── -filter_complex 인자 (${fc.length} chars) ─────`);
        console.error(fc);
        console.error(`[ffmpeg] ───── 끝 ─────`);
        reject(new Error(`ffmpeg exit ${code}: ${stderrBuf.slice(-500)}`));
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
  const result = { version: "?", filters: {} };
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

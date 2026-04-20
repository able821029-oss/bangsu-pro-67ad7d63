// SMS 쇼츠 영상 API 서버 (v5.0) — BullMQ 큐에 잡을 쌓고 상태를 조회하는 얇은 게이트웨이
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { shortsQueue, queueEvents } = require("./queue");

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

// ── API 시크릿 인증 ──
const API_SECRET = process.env.VIDEO_API_SECRET || "";
const authMiddleware = (req, res, next) => {
  const token =
    req.headers["x-api-secret"] ||
    req.headers.authorization?.replace("Bearer ", "");
  if (!API_SECRET) return next();
  if (token !== API_SECRET) return res.status(401).json({ error: "인증 실패" });
  next();
};

// ── 헬스체크 ──
app.get("/health", async (_, res) => {
  try {
    const counts = await shortsQueue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed"
    );
    res.json({ ok: true, ts: Date.now(), version: "5.0-bullmq", queue: counts });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * BullMQ state → 기존 클라이언트 폴링 스키마의 status 필드
 *  - "completed" → "done"
 *  - "failed"    → "error"
 *  - "waiting"/"delayed" → "pending" (대기 큐)
 *  - "active"    → progress object 안의 subStatus (rendering/mixing/verifying/uploading)
 */
function mapState(state, progressData) {
  if (state === "completed") return "done";
  if (state === "failed") return "error";
  if (state === "waiting" || state === "delayed" || state === "waiting-children") return "pending";
  if (typeof progressData === "object" && progressData?.subStatus) return progressData.subStatus;
  return "rendering";
}

// ── POST /render-start — 즉시 jobId 반환, 렌더는 worker가 수행 ──
app.post("/render-start", authMiddleware, async (req, res) => {
  try {
    const jobId = uuidv4();
    await shortsQueue.add("render", req.body, { jobId });
    console.log(`[${jobId}] 큐 등록`);
    res.json({ ok: true, jobId });
  } catch (e) {
    console.error("큐 등록 실패:", e?.message || e);
    res.status(500).json({ error: "큐 등록 실패: " + (e?.message || "unknown") });
  }
});

// ── GET /render-status/:jobId — BullMQ job state를 기존 폴링 응답 스키마로 변환 ──
app.get("/render-status/:jobId", authMiddleware, async (req, res) => {
  try {
    const job = await shortsQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: "job not found" });

    const state = await job.getState();
    const raw = job.progress;

    // progress는 object({progress, stage, subStatus})로 저장하지만
    // 잡 등록 직후/BullMQ 초기값은 0(number)일 수 있어 둘 다 처리
    let progress = 0;
    let stage = "";
    if (typeof raw === "object" && raw !== null) {
      progress = typeof raw.progress === "number" ? raw.progress : 0;
      stage = raw.stage || "";
    } else if (typeof raw === "number") {
      progress = raw;
    }

    const status = mapState(state, raw);

    if (state === "completed") {
      const ret = job.returnvalue || {};
      return res.json({
        jobId: job.id,
        status: "done",
        progress: 100,
        stage: "완료",
        videoUrl: ret.videoUrl,
        durationSec: ret.durationSec,
        frames: ret.frames,
      });
    }

    if (state === "failed") {
      return res.json({
        jobId: job.id,
        status: "error",
        progress,
        stage,
        error: job.failedReason || "unknown",
      });
    }

    // waiting/delayed/active
    const response = {
      jobId: job.id,
      status,
      progress,
      stage: stage || (state === "waiting" || state === "delayed" ? "대기 중" : ""),
    };

    // 대기 중이면 큐 포지션을 힌트로 노출 (없으면 생략)
    if (state === "waiting" || state === "delayed") {
      try {
        const pos = typeof job.getPosition === "function" ? await job.getPosition() : undefined;
        if (typeof pos === "number" && pos > 0) response.queuePosition = pos;
      } catch {
        /* ignore */
      }
    }

    res.json(response);
  } catch (e) {
    console.error("상태 조회 실패:", e?.message || e);
    res.status(500).json({ error: e?.message || "unknown" });
  }
});

/**
 * 레거시 동기식 엔드포인트 — 기존에 외부에서 /render-video로 호출하던 통합을 위해 유지.
 * 내부적으로 큐에 잡을 올리고 waitUntilFinished로 완료를 기다린다.
 * Railway 엣지 프록시 504 위험은 그대로이므로 신규 클라이언트는 /render-start + 폴링 사용 권장.
 */
app.post("/render-video", authMiddleware, async (req, res) => {
  let jobId;
  try {
    jobId = uuidv4();
    const job = await shortsQueue.add("render", req.body, { jobId });
    const result = await job.waitUntilFinished(queueEvents, 8 * 60 * 1000);
    res.json({
      ok: true,
      videoUrl: result.videoUrl,
      jobId: job.id,
      durationSec: result.durationSec,
      frames: result.frames,
    });
  } catch (e) {
    console.error(`[${jobId}] /render-video 실패:`, e?.message || e);
    res.status(500).json({ error: e?.message || "렌더 실패", jobId });
  }
});

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`SMS Video Server v5.0 (BullMQ) — :${PORT}`);
  console.log(`  Redis: ${process.env.REDIS_URL ? "연결됨" : "기본 127.0.0.1:6379"}`);
});

// Graceful shutdown — 진행 중인 HTTP 요청은 마무리, 큐 커넥션은 닫지 않음 (worker 소유)
async function shutdown(signal) {
  console.log(`[api] ${signal} 수신, 종료 시작`);
  server.close(() => process.exit(0));
  // 강제 종료 안전장치
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

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
// Redis가 없으면 503을 반환해 Railway가 배포 실패로 판단하고 이전 버전을 유지하게 한다.
// (BullMQ 기반 서비스는 Redis 없으면 의미가 없으므로 "Degraded"로 가장하지 않는다.)
app.get("/health", async (_, res) => {
  const checks = { redis: false, queue: false };
  try {
    const client = await shortsQueue.client;
    if (client && typeof client.ping === "function") {
      await client.ping();
      checks.redis = true;
    }
    const counts = await shortsQueue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed"
    );
    checks.queue = true;
    res.json({ ok: true, ts: Date.now(), version: "5.2-sse", queue: counts, checks });
  } catch (e) {
    res.status(503).json({
      ok: false,
      ts: Date.now(),
      version: "5.2-sse",
      error: e?.message || "unknown",
      checks,
      hint: "REDIS_URL이 설정된 Railway Redis addon이 필요합니다",
    });
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

/** BullMQ 잡을 기존 폴링/SSE 공용 응답 스키마로 변환. */
async function buildStatusResponse(job) {
  const state = await job.getState();
  const raw = job.progress;

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
    return {
      jobId: job.id,
      status: "done",
      progress: 100,
      stage: "완료",
      videoUrl: ret.videoUrl,
      durationSec: ret.durationSec,
      frames: ret.frames,
    };
  }
  if (state === "failed") {
    return {
      jobId: job.id,
      status: "error",
      progress,
      stage,
      error: job.failedReason || "unknown",
    };
  }
  const resp = {
    jobId: job.id,
    status,
    progress,
    stage: stage || (state === "waiting" || state === "delayed" ? "대기 중" : ""),
  };
  if (state === "waiting" || state === "delayed") {
    try {
      const pos = typeof job.getPosition === "function" ? await job.getPosition() : undefined;
      if (typeof pos === "number" && pos > 0) resp.queuePosition = pos;
    } catch {
      /* ignore */
    }
  }
  return resp;
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

// ── GET /render-status/:jobId — 폴링 엔드포인트 (호환성 유지) ──
app.get("/render-status/:jobId", authMiddleware, async (req, res) => {
  try {
    const job = await shortsQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: "job not found" });
    const response = await buildStatusResponse(job);
    res.json(response);
  } catch (e) {
    console.error("상태 조회 실패:", e?.message || e);
    res.status(500).json({ error: e?.message || "unknown" });
  }
});

// ── GET /render-status/:jobId/stream — Server-Sent Events (푸시 기반) ──
// QueueEvents의 progress/completed/failed 이벤트를 그대로 SSE로 중계.
// 3초 폴링 간격 없이 즉시 UI 반영 → 체감 속도 개선. 클라이언트가 연결 끊으면
// 리스너·keepalive 정리 후 조용히 종료. 실패 시 클라이언트는 폴링으로 폴백.
app.get("/render-status/:jobId/stream", authMiddleware, async (req, res) => {
  let job;
  try {
    job = await shortsQueue.getJob(req.params.jobId);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "unknown" });
  }
  if (!job) return res.status(404).json({ error: "job not found" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // nginx/Cloudflare 등의 응답 버퍼링 방지
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let closed = false;
  const targetJobId = String(job.id);

  const send = (obj) => {
    if (closed) return;
    try {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    } catch {
      closed = true;
    }
  };

  // 초기 스냅샷 (폴링과 동일 포맷)
  try {
    const snapshot = await buildStatusResponse(job);
    send(snapshot);
    if (snapshot.status === "done" || snapshot.status === "error") {
      closed = true;
      res.end();
      return;
    }
  } catch (e) {
    console.error("[SSE] 초기 스냅샷 실패:", e?.message || e);
  }

  const handleEvent = async ({ jobId: jid }) => {
    if (closed) return;
    if (String(jid) !== targetJobId) return;
    try {
      const current = await shortsQueue.getJob(targetJobId);
      if (!current) return;
      const payload = await buildStatusResponse(current);
      send(payload);
      if (payload.status === "done" || payload.status === "error") {
        teardown();
        res.end();
      }
    } catch (e) {
      console.error("[SSE] 이벤트 처리 실패:", e?.message || e);
    }
  };

  queueEvents.on("progress", handleEvent);
  queueEvents.on("completed", handleEvent);
  queueEvents.on("failed", handleEvent);

  // 30초마다 keep-alive 주석 라인 — 프록시 타임아웃 방지
  const keepalive = setInterval(() => {
    if (!closed) {
      try {
        res.write(`: keepalive ${Date.now()}\n\n`);
      } catch {
        /* ignore */
      }
    }
  }, 30_000);

  function teardown() {
    if (closed) return;
    closed = true;
    queueEvents.off("progress", handleEvent);
    queueEvents.off("completed", handleEvent);
    queueEvents.off("failed", handleEvent);
    clearInterval(keepalive);
  }

  req.on("close", teardown);
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
  console.log(`SMS Video Server v5.2 (BullMQ + SSE) — :${PORT}`);
  console.log(`  Redis: ${process.env.REDIS_URL ? "연결됨" : "기본 127.0.0.1:6379"}`);
  console.log(`  Endpoints: POST /render-start · GET /render-status/:id · GET /render-status/:id/stream`);
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

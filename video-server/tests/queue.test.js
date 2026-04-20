// BullMQ 큐 동작 테스트 — 동시성·실패 격리 확인
//
// 실행 전제:
//   - 로컬 Redis 서버가 127.0.0.1:6379 또는 $REDIS_URL 에서 접근 가능해야 합니다.
//   - Redis 없이 실행하면 모든 테스트가 커넥션 에러로 실패합니다.
//   - 실행: `npm run test:queue` (video-server 디렉토리)
//
// 이 테스트는 실제 Remotion 렌더가 아닌 빠른 mock processor를 사용합니다.
// 목적: Queue/Worker 오케스트레이션만 검증합니다.

const test = require("node:test");
const assert = require("node:assert");
const { Queue, Worker, QueueEvents } = require("bullmq");
const IORedis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

function mkConn() {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

async function cleanupQueue(queue) {
  try {
    await queue.obliterate({ force: true });
  } catch {
    /* ignore */
  }
}

test("동시 5개 잡이 모두 완료되고 결과가 반환된다", async () => {
  const QUEUE_NAME = "shorts-render-test-concurrent-" + Date.now();
  const queue = new Queue(QUEUE_NAME, { connection: mkConn() });
  const queueEvents = new QueueEvents(QUEUE_NAME, { connection: mkConn() });
  await queueEvents.waitUntilReady();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      // 2단계 progress 보고 — 실제 worker.js와 같은 스키마
      await job.updateProgress({ progress: 20, stage: "렌더링 시작", subStatus: "rendering" });
      await new Promise((r) => setTimeout(r, 120));
      await job.updateProgress({ progress: 85, stage: "오디오 믹싱", subStatus: "mixing" });
      await new Promise((r) => setTimeout(r, 120));
      return {
        videoUrl: `https://test.local/${job.id}.mp4`,
        durationSec: 12,
        frames: 288,
      };
    },
    { connection: mkConn(), concurrency: 2 }
  );

  try {
    const jobs = await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        queue.add("render", { index: i }, { jobId: `concurrent-${i}` })
      )
    );

    const results = await Promise.all(
      jobs.map((j) => j.waitUntilFinished(queueEvents, 30_000))
    );

    assert.strictEqual(results.length, 5, "5개 모두 완료되어야 함");
    for (const r of results) {
      assert.ok(r.videoUrl?.startsWith("https://test.local/"), "videoUrl 반환");
      assert.strictEqual(r.frames, 288, "frames 반환");
      assert.strictEqual(r.durationSec, 12, "durationSec 반환");
    }
  } finally {
    await worker.close();
    await cleanupQueue(queue);
    await queue.close();
    await queueEvents.close();
  }
});

test("1개 실패해도 나머지 잡이 독립적으로 성공한다", async () => {
  const QUEUE_NAME = "shorts-render-test-isolation-" + Date.now();
  const queue = new Queue(QUEUE_NAME, {
    connection: mkConn(),
    defaultJobOptions: { attempts: 1 }, // 재시도 없이 즉시 실패 판정
  });
  const queueEvents = new QueueEvents(QUEUE_NAME, { connection: mkConn() });
  await queueEvents.waitUntilReady();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      await new Promise((r) => setTimeout(r, 80));
      if (job.data.shouldFail) {
        throw new Error("의도적 실패: " + job.data.reason);
      }
      return { videoUrl: `https://test.local/${job.id}.mp4` };
    },
    { connection: mkConn(), concurrency: 2 }
  );

  try {
    const jobs = await Promise.all([
      queue.add("render", { i: 1, shouldFail: false }, { jobId: "iso-1" }),
      queue.add("render", { i: 2, shouldFail: true, reason: "test-fail" }, { jobId: "iso-2" }),
      queue.add("render", { i: 3, shouldFail: false }, { jobId: "iso-3" }),
      queue.add("render", { i: 4, shouldFail: false }, { jobId: "iso-4" }),
      queue.add("render", { i: 5, shouldFail: false }, { jobId: "iso-5" }),
    ]);

    const outcomes = await Promise.all(
      jobs.map((j) =>
        j.waitUntilFinished(queueEvents, 30_000).then(
          (result) => ({ ok: true, id: j.id, result }),
          (err) => ({ ok: false, id: j.id, err: err?.message || String(err) })
        )
      )
    );

    const failed = outcomes.filter((o) => !o.ok);
    const succeeded = outcomes.filter((o) => o.ok);

    assert.strictEqual(failed.length, 1, "정확히 1개만 실패해야 함");
    assert.strictEqual(failed[0].id, "iso-2", "실패한 잡은 iso-2");
    assert.match(failed[0].err, /의도적 실패/, "실패 사유 전파");

    assert.strictEqual(succeeded.length, 4, "나머지 4개는 독립적으로 성공");
    for (const s of succeeded) {
      assert.ok(s.result.videoUrl, "성공 잡은 videoUrl 반환");
    }
  } finally {
    await worker.close();
    await cleanupQueue(queue);
    await queue.close();
    await queueEvents.close();
  }
});

test("progress updateProgress가 object 스키마로 보존된다", async () => {
  const QUEUE_NAME = "shorts-render-test-progress-" + Date.now();
  const queue = new Queue(QUEUE_NAME, { connection: mkConn() });
  const queueEvents = new QueueEvents(QUEUE_NAME, { connection: mkConn() });
  await queueEvents.waitUntilReady();

  let capturedDuringActive = null;
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      await job.updateProgress({ progress: 42, stage: "중간 단계", subStatus: "rendering" });
      // active 상태에서 다른 곳이 읽어갈 수 있도록 대기
      await new Promise((r) => setTimeout(r, 300));
      return { videoUrl: `https://test.local/${job.id}.mp4` };
    },
    { connection: mkConn(), concurrency: 1 }
  );

  try {
    const job = await queue.add("render", {}, { jobId: "prog-1" });

    // active 중 polling 흉내
    await new Promise((r) => setTimeout(r, 150));
    const fetched = await queue.getJob("prog-1");
    capturedDuringActive = fetched.progress;

    await job.waitUntilFinished(queueEvents, 10_000);

    assert.ok(capturedDuringActive, "active 중 progress 조회 가능");
    assert.strictEqual(typeof capturedDuringActive, "object");
    assert.strictEqual(capturedDuringActive.progress, 42);
    assert.strictEqual(capturedDuringActive.stage, "중간 단계");
    assert.strictEqual(capturedDuringActive.subStatus, "rendering");
  } finally {
    await worker.close();
    await cleanupQueue(queue);
    await queue.close();
    await queueEvents.close();
  }
});

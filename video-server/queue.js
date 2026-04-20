// BullMQ 큐 설정 — API 서버(index.js)와 워커(worker.js)가 공유
const { Queue, QueueEvents } = require("bullmq");
const IORedis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const QUEUE_NAME = "shorts-render";

/**
 * BullMQ 권장 설정:
 *  - maxRetriesPerRequest: null → 내부 블로킹 커맨드(BRPOPLPUSH 등) 대기를 제한하지 않음
 *  - enableReadyCheck: false    → Railway Redis addon처럼 INFO 권한 제한 환경에서 안전
 */
function createConnection() {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  });
}

const defaultJobOptions = {
  attempts: 2,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { age: 3600, count: 100 },
  removeOnFail: { age: 86400 },
};

// ── 공유 커넥션 ──
// Queue 용, QueueEvents 용 분리 (BullMQ 권장: 블로킹 이벤트와 일반 명령 커넥션 분리)
const queueConnection = createConnection();
const eventsConnection = createConnection();

const shortsQueue = new Queue(QUEUE_NAME, {
  connection: queueConnection,
  defaultJobOptions,
});

const queueEvents = new QueueEvents(QUEUE_NAME, {
  connection: eventsConnection,
});

module.exports = {
  QUEUE_NAME,
  REDIS_URL,
  createConnection,
  shortsQueue,
  queueEvents,
  defaultJobOptions,
};

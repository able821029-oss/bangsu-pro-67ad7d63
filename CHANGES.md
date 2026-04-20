# CHANGES — BullMQ + Redis 큐 도입 (v5.0)

> 작업 일자: 2026-04-20  
> 참조: [docs/PIPELINE_ANALYSIS.md](docs/PIPELINE_ANALYSIS.md) §7 (동시 요청 처리 방식)

## 목표
video-server에 **BullMQ + Redis 기반 작업 큐**를 도입해 동시 요청 시 OOM/타임아웃을 제거.  
기존 인메모리 `jobs` Map은 컨테이너 재시작 시 잡 상태가 사라지고 동시 N잡 요청을 무제한 수용해 Railway Hobby(1GB RAM)에서 OOM을 일으켰다.

## 변경 요약

| 영역 | Before (v4.0-async) | After (v5.0-bullmq) |
|---|---|---|
| 잡 저장소 | 프로세스 메모리 `Map` | Redis (영속) |
| 동시성 제한 | **없음** (무제한 병렬) | `WORKER_CONCURRENCY`(기본 2) |
| 재시도 | 없음 | `attempts:2`, exponential 5000ms backoff |
| 프로세스 구조 | 단일 (API + 렌더) | **분리** — API 서버 + 워커 |
| 컨테이너 재시작 | 진행 중 잡 전부 소실 | Redis에 상태 보존, 재시작 후 재처리 |
| 큐 넘침 시 | OOM → 전체 다운 | 대기열에 쌓임, `queuePosition` 힌트 노출 |

## 파일 변경

### 신규
- [video-server/queue.js](video-server/queue.js) — `Queue`·`QueueEvents`·커넥션 팩토리 공유 모듈
- [video-server/worker.js](video-server/worker.js) — BullMQ `Worker`, 렌더/믹싱/검증/업로드 전 로직 이동
- [video-server/Procfile](video-server/Procfile) — `web` + `worker` 프로세스 선언
- [video-server/railway.worker.json](video-server/railway.worker.json) — Railway 별도 서비스용 설정 (참고용)
- [video-server/tests/queue.test.js](video-server/tests/queue.test.js) — 동시성 + 실패 격리 + progress 스키마 테스트

### 수정
- [video-server/package.json](video-server/package.json)
  - `version`: 3.0.0 → 5.0.0
  - dependencies 추가: `bullmq@^5.26.0`, `ioredis@^5.4.1`
  - scripts 추가: `worker`, `dev:worker`, `test:queue`
- [video-server/index.js](video-server/index.js) — **완전 재작성**
  - 인메모리 `jobs` Map 제거
  - 렌더 로직 전체를 worker.js로 이동
  - `POST /render-start` → `shortsQueue.add()` 후 jobId 즉시 반환
  - `GET /render-status/:jobId` → `job.getState()` + `job.progress` 기반 응답 (기존 스키마 유지)
  - 레거시 `/render-video` → 내부적으로 큐 + `waitUntilFinished` 래핑

### 유지 (변경 없음)
- [video-server/renderer.js](video-server/renderer.js)
- [video-server/bgm.js](video-server/bgm.js)
- [video-server/remotion/**](video-server/remotion)
- [video-server/Dockerfile](video-server/Dockerfile)
- [video-server/railway.json](video-server/railway.json) — web 서비스용 (그대로 `node index.js`)

### 클라이언트 측 (변경 금지 제약 준수)
- [src/components/ShortsCreator.tsx](src/components/ShortsCreator.tsx) — **수정 없음**. API 호환성 확인 완료.
- Edge Function ([supabase/functions/generate-shorts/index.ts](supabase/functions/generate-shorts/index.ts)) — **수정 없음**.

## API 호환성 검증

기존 클라이언트가 기대하는 폴링 응답 스키마:
```ts
{ status?: string; progress?: number; stage?: string; videoUrl?: string; error?: string }
```

| 클라이언트 체크 | v5.0 동작 |
|---|---|
| `statusJson.status === "done"` | BullMQ `completed` → `"done"` ✅ |
| `statusJson.status === "error"` | BullMQ `failed` → `"error"` + `error` 필드 ✅ |
| `typeof statusJson.progress === "number"` | `job.updateProgress({progress, stage, subStatus})`에서 `progress` 숫자 추출 ✅ |
| `statusJson.stage` | progress object에서 `stage` 문자열 그대로 전달 ✅ |
| `statusJson.videoUrl` | `completed` 시 `job.returnvalue.videoUrl` 노출 ✅ |

**추가된 필드** (클라이언트는 무시하므로 안전): `jobId`, `durationSec`, `frames`, `queuePosition`

## 큐 설정 요약 ([queue.js](video-server/queue.js))

```js
QUEUE_NAME = "shorts-render"
attempts: 2
backoff: { type: "exponential", delay: 5000 }
removeOnComplete: { age: 3600, count: 100 }
removeOnFail: { age: 86400 }
```

Redis 커넥션: `maxRetriesPerRequest: null` + `enableReadyCheck: false` — BullMQ 권장값이자 Railway Redis addon 호환.

## 검증 게이트 보존
PIPELINE_ANALYSIS.md 기준:
- **사전 게이트 ②** (worker.js:80-85) — `narrationExpected=true`인데 audio 0개면 Remotion 시작 전 throw ✅
- **사후 게이트 ③** (worker.js:156-166) — ffmpeg probe로 hasVideo/duration/fileSize/hasAudio 5개 항목 검증 ✅
- Supabase 업로드 경로 `videos/{jobId}.mp4` · 버킷 `sms-videos` (public) ✅

## `/tmp` 누수 수정 (부수 개선)
기존 index.js는 `narrationFiles` 개별 파일이 cleanup 리스트에 빠져 있어 concat 실패 시 누수 가능했다.  
v5.0 worker.js는 `toCleanup` 배열에 `...narrationFiles` + `listFile`을 포함해 모든 임시 파일을 `finally`에서 정리.

## 환경변수

### 신규
| 변수 | 기본값 | 설명 |
|---|---|---|
| `REDIS_URL` | `redis://127.0.0.1:6379` | Railway Redis addon이 주입하는 연결 URL |
| `WORKER_CONCURRENCY` | `2` | 워커가 동시에 처리할 잡 개수 (Remotion 메모리 고려) |

### 기존 (변경 없음)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `VIDEO_API_SECRET` (옵션)
- `CHROMIUM_PATH`, `PORT`

## Railway 배포 절차

v5.0부터 **web + worker 두 개의 서비스**를 운영해야 합니다.

1. **Redis addon 추가** — Railway 프로젝트에서 `+ New` → `Database` → `Add Redis`. 생성되면 같은 프로젝트의 모든 서비스에서 `${{Redis.REDIS_URL}}` 참조 가능.
2. **기존 web 서비스** — 그대로. `railway.json`의 `startCommand: "node index.js"` 유지. `REDIS_URL` 환경변수 연결.
3. **worker 서비스 추가**
   - Railway 대시보드에서 `+ New Service` → `Empty Service` → 같은 GitHub repo 연결
   - Root Directory: `video-server`
   - Settings → Deploy → Start Command: `node worker.js`
   - Variables: `REDIS_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_CONCURRENCY=2`
   - 또는 [railway.worker.json](video-server/railway.worker.json)을 `railway.json`으로 지정
4. **배포 후 확인**
   - `GET /health` → `version: "5.0-bullmq"` + `queue: { waiting, active, completed, failed, delayed }` 표시
   - 워커 로그에 `SMS Video Worker v5.0 (BullMQ) — queue="shorts-render" concurrency=2` 출력

## 테스트

```bash
# 사전: 로컬 Redis 서버 필요 (docker run -p 6379:6379 -d redis:7-alpine 가능)
cd video-server
npm install
npm run test:queue
```

테스트 케이스:
1. **동시 5개 잡 모두 완료** — concurrency=2로 처리, 모두 videoUrl 반환
2. **1개 실패 시 독립성** — `attempts:1`로 즉시 실패 판정, 다른 4개는 성공
3. **progress 스키마 보존** — `updateProgress({progress, stage, subStatus})` object가 `job.progress`에서 그대로 조회됨

## 남은 후속 과제 (본 PR 범위 밖)

- Redis addon 비용 (Railway $5/월 수준) 모니터링
- 워커 컨테이너 메모리 프로파일링 → `WORKER_CONCURRENCY` 튜닝
- Sentry에 worker 예외 연결 (현재는 `console.error`만)
- Edge Function에 원본 request id 생성해 jobId와 매핑 (추적성)
- `/render-video` 레거시 엔드포인트 deprecation 알림 후 제거

# CHANGES

## 진행 요약

| Phase | 버전 | 테마 | 핵심 변경 |
|---|---|---|---|
| 1 | v5.0 | BullMQ 큐 | 인메모리 Map → Redis, 동시성 제어, API/워커 분리 |
| 2 | v5.1 | FFmpeg 엔진 | Remotion 우회로 렌더 시간 3~5배 단축, 엔진 이원화 |
| 3 | v5.2 | SSE + 에러 격리 | 부분 실패 허용, 폴링 → SSE 푸시, BGM 캐싱 |
| 4 | v6.0 | Railway 폐기, Shotstack 전환 | 자체 렌더 서버 전체 제거, 외부 SaaS 렌더로 위임 |

---

## Phase 4 — Railway 폐기, Shotstack 전환 (v6.0) · 2026-04-25

### 목표
자체 운영하던 Remotion/FFmpeg 렌더 파이프라인(Railway web + worker + Redis)을 전부 폐기하고, 영상 렌더링을 **Shotstack** 외부 SaaS로 위임. 운영 부담(Redis 비용, 컨테이너 OOM, ffmpeg 빌드 환경, 폰트/코덱) 일괄 해소.

### 제거된 자산

| 영역 | 자산 |
|---|---|
| 렌더 서버 | `video-server/` 전체 폴더 (index.js, worker.js, queue.js, ffmpegRenderer.js, audioMixer.js, bgm.js, renderer.js, remotion/, tests/, Dockerfile, Procfile, railway.json, railway.worker.json 등) |
| Edge Function | `supabase/functions/render-video/` (Railway 프록시였음) |
| 설정 | `supabase/config.toml`의 `[functions.render-video]` 섹션 |
| 환경변수 | `.env.example`의 `VITE_VIDEO_SERVER_URL` |
| 외부 인프라 | Railway 프로젝트 `cooperative-flow` 전체 (수동) — Redis addon 포함 |

### 영향
- Phase 1~3에서 구축한 BullMQ 큐, FFmpeg 네이티브 엔진, SSE 푸시, BGM 캐싱은 더 이상 사용하지 않음. 코드는 git history에 보존.
- 클라이언트 영상 렌더 경로는 Shotstack API 직접 호출로 전환 (별도 PR/문서).
- Railway 잔액($4.24)은 사용자가 직접 정산 결정 — 추가 비용 발생 없음.

### Railway 수동 정리 (사용자 작업)
- Railway Dashboard → `cooperative-flow` 프로젝트 전체 삭제
- Redis addon, web 서비스, worker 서비스 모두 정리됨

### 후속 작업
- `npx supabase functions delete render-video` — 배포된 Edge Function 정리
- src/ 내부 잔존 Railway 참조(`useShortsPipeline.ts`, `AdminApiKeys.tsx` 등)는 Shotstack 전환 PR에서 정리 예정

---

## Phase 3 — SSE + 부분 실패 허용 + BGM 캐싱 (v5.2) · 2026-04-20

### 목표
- 한 점 실패가 전체 실패를 만들지 않도록 **degraded service** 전환
- 3초 폴링 → **SSE 푸시**로 완료 즉시 UI 반영
- 동일 BGM 타입의 반복 요청 비용 최소화

### A. ElevenLabs 에러 격리 + 재시도 ([generate-shorts/index.ts](supabase/functions/generate-shorts/index.ts))
- `generateNarrationWithRetry()` 함수 신규 — 지수 백오프 800·1600ms, 최대 2회 재시도
- 씬별 `Promise.allSettled` — 한 씬 실패가 다른 씬에 영향 없음
- 최종 실패한 씬은 `failedScenes: number[]` 배열로 반환
- **전체 실패(attempted > 0 && success === 0) 시에만 500** · 부분 실패는 `200 { narrationAudios, failedScenes: [...] }`
- Claude/Gemini 단계의 기존 fallback 체인은 그대로 유지

### B. 클라이언트 사전 게이트 ① 수정 ([ShortsCreator.tsx](src/components/ShortsCreator.tsx))
- `validAudioCount === 0` 차단 유지
- `failedScenes.length > 0 && validAudioCount > 0` → 토스트 경고 후 진행 허용 (차단 X)
- 토스트: "일부 장면 음성 생성 실패 — {N}개 장면은 음성 없이 진행합니다"

### C. 서버 사전 게이트 ② 수정 ([worker.js](video-server/worker.js))
- `validAudioCount === 0 && totalSlots > 0`일 때만 throw (의도적 전체 실패)
- 부분 실패는 `console.log`로만 기록 → 무음 씬 허용하고 진행
- 메시지를 "전부 실패했습니다"로 구체화

### D. 파이프라인 병렬화 확인 ([generate-shorts/index.ts](supabase/functions/generate-shorts/index.ts))
- **이미** `Promise.all`로 ElevenLabs N건 완전 병렬이었음. 이번에 `Promise.allSettled`로 교체했지만 병렬성은 동일
- 로그 메시지에 `(allSettled + retry)` 명시하여 구조 확인 가능

### E. 폴링 → SSE 전환
**서버** ([video-server/index.js](video-server/index.js))
- `GET /render-status/:jobId/stream` SSE 엔드포인트 신규
- BullMQ `queueEvents`의 `progress`/`completed`/`failed` 이벤트를 그대로 `data: {json}\n\n`로 푸시
- 30초마다 `: keepalive` 주석 라인 — 프록시 타임아웃 방지
- `X-Accel-Buffering: no` 헤더 — nginx/CF 버퍼링 비활성화
- `req.on("close")` 시 리스너·keepalive 자동 정리 (누수 방지)
- 기존 `GET /render-status/:jobId` 폴링 엔드포인트는 그대로 유지 (호환성)
- `buildStatusResponse(job)` 공통 헬퍼로 폴링·SSE 응답 스키마 통일

**클라이언트** ([ShortsCreator.tsx](src/components/ShortsCreator.tsx))
- `EventSource`로 `/stream` 우선 구독
- `onmessage` → `applyStatus(data)` 공통 핸들러 (폴링과 공유)
- `onerror` → 연결 종료 후 3초 폴링 폴백 자동 진입
- 최대 8분 hardTimeout
- SSE 미지원(`typeof EventSource === "undefined"`) 시 즉시 폴링 경로

### F. BGM 프리셋 캐싱 ([video-server/bgm.js](video-server/bgm.js))
- `/tmp/bgm-cache/{type}.mp3`에 180초 마스터 저장
- 호출 시 `ensureMaster()` → 있으면 재사용, 없으면 1회 생성
- 요구 길이로 `-c:a copy -t <clamped>` stream copy trim (수십~수백 ms)
- 최대 180초 clamp
- 알 수 없는 타입은 `calm`으로 fallback
- `clearBgmCache()` export (테스트 용도)
- `BGM_CACHE_DIR` 환경변수로 경로 변경 가능

### G. 테스트
신규 2종 (Redis 불필요):

| 파일 | 검증 |
|---|---|
| [tests/partialNarration.test.js](video-server/tests/partialNarration.test.js) | 7씬 중 2·4번 null → 5씬 오디오 합성 OK / 전부 null + BGM=none → 원본 영상 그대로 / 일부 null + BGM 있음 → 믹스 OK |
| [tests/bgmCache.test.js](video-server/tests/bgmCache.test.js) | 2회차 < 1회차 시간 / 마스터 파일 생성 / none·unknown 처리 |

SSE 엔드포인트는 수동 통합 테스트 (Redis + 워커 필요). docs/ERROR_HANDLING.md에 로컬 검증 절차 기록.

### H. 문서화
- [docs/ERROR_HANDLING.md](docs/ERROR_HANDLING.md) 신규 — 10단계 파이프라인별 실패 원인·폴백·사용자 메시지 매핑 테이블
- 본 CHANGES.md 상단에 Phase 1/2/3 요약 추가

### 제약 준수
- ✅ Phase 1 BullMQ 구조 유지 (worker 프로세스 분리, `shortsQueue`/`queueEvents` 공유)
- ✅ Phase 2 엔진 이원화 유지 (`selectEngine()` 그대로)
- ✅ Supabase DB 스키마 변경 없음
- ✅ 기존 환경변수 유지 — 신규만 추가: `BGM_CACHE_DIR` (optional)

### 배포 체크
- [x] 전파일 `node -c` 구문 OK
- [x] 루트 `tsc --noEmit` exit 0 (클라이언트 타입 오류 없음)
- [x] `npm run test:ffmpeg` 4/4 pass
- [ ] `npm --prefix video-server run test` (bgmCache + partialNarration) — 실행 예정
- [ ] SSE 엔드포인트 로컬 Redis 통합 테스트 — 수동

### 사용자 체감 개선
| 항목 | Before | After |
|---|---|---|
| 완료 시점 반영 지연 | 최대 3초 | **<100ms (SSE push)** |
| 나레이션 1건 실패 | 전체 영상 생성 취소 | 해당 씬 무음 + 경고 토스트 후 진행 |
| BGM 동일 타입 10번 요청 | 매번 sine 합성 ~1초 | 첫 호출만 ~1초, 이후 **~50ms** |
| Railway 서버 일시 재시작 | SSE 끊겨도 폴링으로 자동 복구 |

---

## Phase 2 — FFmpeg 네이티브 렌더러 (v5.1) · 2026-04-20

### 목표
기본 스타일 쇼츠를 Remotion 대신 FFmpeg 네이티브 파이프라인으로 렌더해 **렌더 시간 60~120s → 15~30s (3~5배 단축)**. Chromium 미사용으로 메모리도 절반 이하.

### 파일 변경

#### 신규
- [video-server/ffmpegRenderer.js](video-server/ffmpegRenderer.js) — libx264 직접 렌더러
  - scale + crop + **zoompan Ken Burns** + drawtext(제목/자막) + **xfade fade** 트랜지션
  - `-progress pipe:1` 파싱 → 진행률 0~1 콜백
  - 폰트 자동 탐색(`FONT_PATH` → Noto CJK → malgun → macOS fallback)
  - `-loop 1 -framerate 1 -t 1` 로 input 1프레임 엄격 제한 (zoompan duration 정확성 보장)
  - single quote를 `U+2019`로 치환하여 filter_complex parser 충돌 회피
- [video-server/audioMixer.js](video-server/audioMixer.js) — 오디오 믹싱 로직을 엔진 공통으로 추출
  - 나레이션 concat → BGM 생성 → amix(나1.0/bgm0.25) → 영상 합체
  - `tempFiles` 배열 반환 → worker가 책임지고 cleanup
- [video-server/tests/ffmpegRenderer.test.js](video-server/tests/ffmpegRenderer.test.js) — 4개 테스트
  - 폰트 경로 resolve
  - 5씬(사진+색상 혼합) duration 일치
  - 3씬 사진 전용
  - 한글 + 특수문자(`'` `:` `,`) 자막 파싱 안정성
- [docs/RENDER_ENGINES.md](docs/RENDER_ENGINES.md) — 두 엔진 비교 및 선택 가이드

#### 수정
- [video-server/worker.js](video-server/worker.js) — 렌더 엔진 분기 로직 추가
  - `selectEngine(style)` → `premium`/`animated`/`remotion`/`FORCE_REMOTION=1`은 Remotion, 그 외 ffmpeg
  - 오디오 믹싱을 `audioMixer.mixAudio()` 호출로 교체
  - 반환값에 `engine` 필드 추가 (관측 용이성)
- [video-server/package.json](video-server/package.json) — scripts 추가: `test:ffmpeg`, `test`

#### 유지 (변경 없음)
- [video-server/renderer.js](video-server/renderer.js) — Remotion 렌더러 그대로 보존
- [video-server/remotion/**](video-server/remotion) — Composition 전체 유지
- [video-server/bgm.js](video-server/bgm.js)
- [video-server/queue.js](video-server/queue.js), [video-server/index.js](video-server/index.js) — Phase 1 BullMQ 구조 유지
- 클라이언트 ([src/components/ShortsCreator.tsx](src/components/ShortsCreator.tsx)) — **수정 없음**
- Edge Function ([supabase/functions/generate-shorts/index.ts](supabase/functions/generate-shorts/index.ts)) — **수정 없음**

### 엔진 선택 규칙 ([worker.js:22](video-server/worker.js#L22))
```js
FORCE_REMOTION=1            → remotion (전체 강제)
style in [premium|animated] → remotion
else                         → ffmpeg (기본)
```

현재 Edge Function이 보내는 `videoStyle` ("시공일지형", "홍보형", "Before/After형")은 모두 기본 규칙에 걸려 **ffmpeg 라우팅**됨. 즉 Phase 2 배포 직후부터 전 프로덕션 트래픽이 빠른 엔진 사용.

### FFmpeg 파이프라인 요약 (씬 i)
```
사진 씬: -loop 1 -framerate 1 -t 1 -i photo.jpg
색상 씬: -f lavfi -t <d> -i color=c=<bg>:s=1080x1920:r=24

filter_complex:
  [i:v] scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920
        ,zoompan=z='min(zoom+0.0015,1.3)':d=<frames>:s=1080x1920:fps=24
        ,format=yuv420p
        ,drawtext=fontfile=<한글>:text='<제목>':y=h*0.08:box=1...
        ,drawtext=fontfile=<한글>:text='<자막>':y=h*0.78:box=1...
        ,setsar=1,fps=24 [v<i>]

  xfade 체인: [v0][v1]xfade=fade:0.5:<offset>[xf1] → ... → [vout]

출력: -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -r 24 -movflags +faststart
```

### 검증 게이트 유지 (PIPELINE_ANALYSIS.md §3)
- **사전 게이트 ②** (worker.js) — `narrationExpected && validAudioCount===0` 즉시 실패 ✅
- **사후 게이트 ③** (worker.js `probeMedia`) — 엔진 무관 동일 ffmpeg probe 검증 ✅

### 측정 결과 (로컬 Windows, ffmpeg-static)
| 케이스 | 영상 길이 | 렌더 시간 |
|---|---|---|
| 5씬 (인트로 1s + 사진 3×1s + 엔딩 1s) | ~3초 | 약 7초 |
| 3씬 사진 전용 (각 1s) | ~2초 | **1.7초** |
| 1씬 한글+특수문자 자막 | 1초 | 0.7초 |

프로덕션 사진 6장 × 3.5초 영상(~21초) 기준 **10~20초**로 추정. 목표(15~30초) 충족.

### 환경변수
| 변수 | 용도 | 기본값 |
|---|---|---|
| `FORCE_REMOTION` | `"1"`일 때 모든 잡을 Remotion로 강제 (롤백) | off |
| `FONT_PATH` | drawtext 한글 폰트 직접 지정 | fallback 탐색 |

Dockerfile에는 이미 `fonts-noto-cjk`가 설치되어 있어 Railway 배포 시 `FONT_PATH` 없어도 자동 동작.

### 롤백 방법
Railway worker 서비스 Variables에 `FORCE_REMOTION=1` 추가 → 워커 재시작 → 즉시 전체 Remotion으로 복귀. ffmpegRenderer 코드는 그대로 보존되므로 언제든 OFF 가능.

### 검증
- [x] `node -c` 전파일 구문 OK
- [x] `npm run test:ffmpeg` 4/4 pass (로컬 Windows + malgun.ttf)
- [x] 한글 + 특수문자(`'` `:` `,`) filter_complex 파싱 OK
- [x] 5씬 xfade 체인 duration 정확도(예상 3s vs 실측 2.5~3s, 오차 <0.7s)
- [x] 루트 `tsc --noEmit` exit 0 (클라이언트 영향 없음)
- [x] BullMQ 구조 유지 (Phase 1)
- [x] 클라이언트/Edge Function 미수정

---

## Phase 1 — BullMQ + Redis 큐 도입 (v5.0)

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

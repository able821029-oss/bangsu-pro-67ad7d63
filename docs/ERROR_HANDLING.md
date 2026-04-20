# 에러 격리 · 폴백 매핑

> 작성일: 2026-04-20  
> 관련: [generate-shorts/index.ts](../supabase/functions/generate-shorts/index.ts) · [worker.js](../video-server/worker.js) · [ShortsCreator.tsx](../src/components/ShortsCreator.tsx)

본 문서는 쇼츠 제작 파이프라인에서 **어떤 에러가 어디에서 격리되고, 어떤 폴백으로 이어지는지**를 단일한 표로 정리한다. Phase 3(부분 실패 허용 + SSE)를 기점으로 "한 점 실패 = 전체 실패"가 아닌 **degraded service** 모델로 전환되었다.

## 원칙
1. **외부 서비스 장애는 항상 격리** — 한 API의 실패가 다른 API를 막지 않는다.
2. **재시도 가능한 실패는 자동 재시도** — 지수 백오프, 최대 2~3회.
3. **부분 실패는 진행 허용** — 전체 실패 시에만 차단.
4. **폴백은 다중 계층** — 이상 경로 하나가 깨져도 상위 플로우가 살아남는다.

## 단계별 에러 매핑

### A. 스크립트 생성 (Edge Function)

| 단계 | 실패 원인 | 1차 폴백 | 2차 폴백 | 최종 실패 |
|---|---|---|---|---|
| Gemini 2.0 Flash | API 키 미설정 · 429 · 파싱 실패 | Claude Haiku 4.5로 전환 | Mock scenes (하드코딩 템플릿) | 없음 — Mock은 항상 성공 |
| Claude Haiku 4.5 | API 키 미설정 · 529 overloaded · JSON 파싱 실패 | regex 기반 JSON 추출 재시도 | Mock scenes | 없음 — Mock은 항상 성공 |
| Mock fallback | — | — | — | 마지막 보루 (빈 scenes는 불가) |

### B. 나레이션 TTS (ElevenLabs)

| 씬 수준 | 처리 |
|---|---|
| 씬별 독립 `try/catch` via `Promise.allSettled` — 한 씬 실패는 다른 씬 무관 |
| 씬당 자동 재시도: 800ms → 1600ms exponential backoff, **최대 2회 재시도 (총 3번 시도)** |
| 재시도 후에도 실패한 씬은 `narrationAudios[i] = null`, `failedScenes.push(i)` |

| 종합 결과 | 응답 |
|---|---|
| 모든 씬 성공 | `200 { scenes, narrationAudios, failedScenes: [] }` |
| **일부 씬 실패** | `200 { scenes, narrationAudios, failedScenes: [2, 5] }` ← **정상 응답, 클라이언트가 경고 토스트** |
| 모든 씬 실패 (attempted > 0) | `500 { error, failedScenes }` ← 차단 |
| 나레이션 OFF (`narrationType === "없음"`) | `200 { scenes, narrationAudios: [null,...], failedScenes: [] }` |

### C. 클라이언트 사전 게이트 ① ([ShortsCreator.tsx](../src/components/ShortsCreator.tsx))

수신한 `narrationAudios` + `failedScenes` 기반 판정:

| 상황 | 동작 |
|---|---|
| `narrationEnabled && validAudioCount === 0` | **throw** — 서버 호출 X, "다시 시도" 안내 |
| `narrationEnabled && failedScenes.length > 0 && validAudioCount > 0` | **경고 토스트 후 진행** ("{N}개 장면은 음성 없이 진행합니다") |
| 정상 | 조용히 진행 |

### D. 서버 사전 게이트 ② ([worker.js](../video-server/worker.js))

Railway 워커에 도달한 잡의 `narrationAudios` 재검증:

| 상황 | 동작 |
|---|---|
| `narrationExpected && validCount === 0 && totalSlots > 0` | **throw** — BullMQ `failed` 상태, `status: error` 응답 |
| `narrationExpected && missingCount > 0 && validCount > 0` | `console.log` 만 기록하고 무음 처리로 진행 |
| 나레이션 OFF | 조용히 진행 |

### E. Remotion / FFmpeg 렌더

| 엔진 | 실패 원인 | 처리 |
|---|---|---|
| Remotion | Chromium OOM · 번들 로드 실패 | throw → BullMQ `attempts: 2`로 1회 재시도 → 그래도 실패하면 `failed` |
| FFmpeg | filter_complex 파싱 실패 · 폰트 누락 · 사진 파일 오류 | stderr 마지막 500자 포함 throw → 재시도 1회 |
| 폰트 누락 (FFmpeg) | FONT_PATH 없고 fallback 전부 miss | 즉시 throw → "한글 폰트를 찾을 수 없습니다" |

**롤백**: `FORCE_REMOTION=1` 환경변수로 FFmpeg 전체 비활성화 가능 (Remotion만 사용).

### F. 오디오 믹싱 ([audioMixer.js](../video-server/audioMixer.js))

| 상황 | 동작 |
|---|---|
| `narrationAudios` 일부 null | 유효한 것만 concat → 영상과 합성 |
| `narrationAudios` 전부 null + BGM 없음 | 원본 영상 그대로 (오디오 없음) |
| BGM 생성 실패 | `hasBgm = false` — 나레이션만으로 진행 |
| 나레이션 concat 실패 (손상 base64) | throw — BullMQ 재시도 |

### G. 사후 게이트 ③ ([worker.js](../video-server/worker.js) `probeMedia`)

업로드 직전 ffmpeg 메타데이터 검증. 하나라도 실패하면 업로드 차단 후 `failed`.

| 체크 | 실패 조건 |
|---|---|
| `hasVideo` | 영상 스트림 없음 |
| `durationSec ≥ 1` | 영상 길이 0~1초 (깨진 출력) |
| `fileSize ≥ 10KB` | 파일이 사실상 비어 있음 |
| `narrationExpected → hasAudio` | 음성 요청했는데 최종 파일에 오디오 없음 |
| `(hasNarration || hasBgm) → hasAudio` | 믹싱은 성공 로그지만 최종 오디오 없음 (silent fail) |

### H. Supabase Storage 업로드

| 실패 | 처리 |
|---|---|
| 버킷 없음 | `createBucket()` 자동 시도, 예외 무시 |
| 네트워크 오류 · 용량 초과 | throw → BullMQ 재시도 1회 → `failed` |

### I. 클라이언트 폴링/SSE

| 이벤트 | 폴백 |
|---|---|
| SSE 연결 실패 (`EventSource.onerror`) | 3초 폴링으로 자동 전환 |
| SSE 중단 (Railway 컨테이너 재시작 등) | onerror → 폴링 진입, 잡 상태는 Redis에 영속 |
| 폴링 개별 호출 실패 (네트워크/503) | 다음 3초 틱에서 재시도 (fetchWithRetry 내부 retries=2) |
| 총 8분 초과 | `renderErrMsg = "렌더 타임아웃 (8분 초과)"` |

### J. 시스템 수준 회복

| 이벤트 | 결과 |
|---|---|
| Worker 컨테이너 재시작 | 진행 중이던 잡은 `stalled` → 자동 재처리 (BullMQ 기본 동작) |
| Redis 재시작 | 미완료 잡 상태 유지 (AOF persistence) |
| Railway 롤백 | FORCE_REMOTION=1로 FFmpeg 엔진 비활성화, 수초 내 전체 Remotion로 복귀 |

## 에러 코드 → 사용자 메시지 매핑

| 상황 | 사용자 토스트/에러 |
|---|---|
| Edge Function 403 (Origin) | "허용되지 않은 호출" (개발자 확인용, 일반 사용자 미노출) |
| Edge Function 500 (TTS 전체 실패) | "나레이션 음성 생성이 실패했습니다. 잠시 후 다시 시도해주세요" |
| 사전 게이트 ① 전체 실패 | "나레이션 음성 생성이 전부 실패했습니다..." (클라이언트) |
| 사전 게이트 ① 부분 실패 | "일부 장면 음성 생성 실패 — {N}개 장면은 음성 없이 진행합니다" (진행 허용) |
| 사전 게이트 ② 전체 실패 | "나레이션 음성 생성이 전부 실패했습니다..." (서버) |
| 사후 게이트 ③ 실패 | "최종 영상에 음성이 들어가지 않았습니다 — 다시 시도해 주세요" 등 구체적 메시지 |
| 렌더 타임아웃 | "렌더 타임아웃 (8분 초과)" |

## 모니터링 포인트 (Sentry 연계 시 권장 이벤트)

| 이벤트 | 빈도 가이드 |
|---|---|
| `Edge Function 500` TTS 전체 실패 | 매번 알림 |
| `failedScenes.length > 3` (과반 이상 실패) | 알림 |
| BullMQ `failed` 5분당 > 3건 | 알림 |
| ffmpeg stderr에 "Filter not found" | 즉시 알림 (filter_complex 회귀) |
| SSE 연결 실패율 > 30% | 주간 검토 |

## 테스트 커버리지

| 테스트 | 파일 | 검증 범위 |
|---|---|---|
| 부분 실패 나레이션 | [tests/partialNarration.test.js](../video-server/tests/partialNarration.test.js) | audioMixer가 일부 null 입력으로 정상 완료 |
| BGM 캐시 | [tests/bgmCache.test.js](../video-server/tests/bgmCache.test.js) | 두 번째 호출 < 첫 번째 호출 시간 |
| FFmpeg 렌더 | [tests/ffmpegRenderer.test.js](../video-server/tests/ffmpegRenderer.test.js) | 4종 (폰트/5씬/3씬/한글 특수문자) |
| BullMQ 큐 | [tests/queue.test.js](../video-server/tests/queue.test.js) | 동시 5개 · 실패 격리 · progress 스키마 |

## 개선 후보 (미구현)

- ElevenLabs 전체 실패 시 Gemini/Claude에게 "나레이션 없이 다시 생성" 재시도
- 사후 게이트 실패 시 다른 엔진(remotion/ffmpeg)으로 자동 재시도
- Sentry breadcrumb에 jobId 자동 연결
- `failedScenes` 통계 누적 → ElevenLabs voice ID 별 실패율 대시보드

# 쇼츠 렌더 엔진 가이드

> 작성일: 2026-04-20  
> 관련 코드: [worker.js](../video-server/worker.js) · [ffmpegRenderer.js](../video-server/ffmpegRenderer.js) · [renderer.js](../video-server/renderer.js)

SMS 쇼츠 영상은 두 가지 렌더 엔진을 상황에 따라 선택한다. 둘 다 BullMQ worker 내부에서 동일한 입력(Edge Function이 생성한 `scenes`, `photos`, `narrationAudios`)으로 호출되며, 오디오 믹싱과 사후 검증은 엔진 공통([audioMixer.js](../video-server/audioMixer.js), [worker.js](../video-server/worker.js) `probeMedia`).

## 엔진 비교

| 항목 | ffmpegRenderer (v5.1 기본) | Remotion |
|---|---|---|
| 구현 | libx264 직접 렌더 | Chromium 헤드리스 + React |
| 평균 소요 (사진 6장) | **15~30초** | 60~120초 |
| 메모리 | 200~400MB | 400~800MB (Chromium) |
| 동시 2잡 Railway Hobby(1GB) | 안정 | OOM 위험 |
| 지원 애니메이션 | Ken Burns zoompan · xfade fade · drawtext | Spring · 복합 레이어 · 이미지 블러 배경 · 원형 glow |
| 자막 | drawtext (fontfile 필수) | React 컴포넌트 |
| 컨테이너 의존성 | ffmpeg만 | Chromium + 폰트 + swiftshader |
| 결정성 | 100% | 99%+ (Chromium 랜덤 요소) |
| 디버깅 용이성 | filter_complex 로그 검토 | 번들 재빌드 필요 |

## 엔진 선택 규칙

[worker.js:18-24](../video-server/worker.js#L18-L24)의 `selectEngine(style)`:

```js
if (FORCE_REMOTION === "1")  → "remotion"     (롤백용 강제)
if (style === "premium")      → "remotion"
if (style === "animated")     → "remotion"
if (style === "remotion")     → "remotion"
else                          → "ffmpeg"      (기본)
```

Edge Function이 실제로 보내는 `videoStyle` 값(`"시공일지형"`, `"홍보형"`, `"Before/After형"`)은 **전부 ffmpeg로 라우팅**된다. 현재 프로덕션은 100% ffmpegRenderer를 사용한다고 봐도 된다.

Remotion은:
- 클라이언트가 명시적으로 `videoStyle: "premium"` 을 보내거나
- 운영자가 `FORCE_REMOTION=1` 환경변수로 전환한 경우

에만 사용된다.

## 각 엔진의 파이프라인

### ffmpegRenderer
[ffmpegRenderer.js](../video-server/ffmpegRenderer.js)

```
씬 N개마다:
  사진 씬:   -loop 1 -framerate 24 -t <d> -i photo.jpg
  색상 씬:   -f lavfi -t <d> -i color=c=#0a1628:s=1080x1920:r=24

filter_complex:
  [i:v] scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920
        ,zoompan=z='min(zoom+0.0015,1.3)':d=<frames>:s=1080x1920:fps=24
        ,format=yuv420p
        ,drawtext=fontfile=<한글 폰트>:text='<제목>':y=h*0.08:...
        ,drawtext=fontfile=<한글 폰트>:text='<자막>':y=h*0.78:...
        ,setsar=1,fps=24[v<i>]

  [v0][v1] xfade=transition=fade:duration=0.5:offset=<o1> [xf1]
  [xf1][v2] xfade=...:offset=<o2> [xf2]
  ...
  [xfN-2][vN-1] xfade=...:offset=<oN-1> [vout]

출력:
  -map [vout] -c:v libx264 -preset veryfast -crf 23
  -pix_fmt yuv420p -r 24 -movflags +faststart
```

진행률: `-progress pipe:1` 옵션 → stdout의 `out_time_us=...` 파싱 → 0~1 콜백.

### Remotion
[renderer.js](../video-server/renderer.js) · [remotion/SmsComposition.tsx](../video-server/remotion/SmsComposition.tsx)

```
1. selectComposition(bundlePath, "SmsShorts")
2. composition.durationInFrames/fps/width/height 오버라이드
3. renderMedia() — Chromium swangle + concurrency 3
4. React 컴포넌트:
   - SmsSceneComp: 블러 배경 + 원본 사진 + 텍스트 spring 애니메이션
   - EndingCard: 로고 글로우 + 업체명 + 연락처
   - FadeTransition: 8프레임 fade-in/out
```

scale 0.40 (432x768 내부 렌더), jpegQuality 62, muted=true. 오디오는 후단 ffmpeg 합성.

## 공통 후단 (엔진 무관)

1. **오디오 믹싱** ([audioMixer.js](../video-server/audioMixer.js))
   - narration base64 → concat → 영상 길이 맞춰 BGM 생성 → amix → 영상 합체
2. **사후 게이트 ③** ([worker.js](../video-server/worker.js) `probeMedia`)
   - hasVideo, duration ≥ 1s, fileSize ≥ 10KB
   - narrationExpected면 hasAudio 필수
   - hasNarration/hasBgm true이면 최종 hasAudio 필수 (silent fail 포착)
3. **Supabase Storage 업로드** (`sms-videos/videos/<jobId>.mp4`)

## 환경변수

| 변수 | 용도 | 기본값 |
|---|---|---|
| `FORCE_REMOTION` | `"1"`일 때 모든 잡을 Remotion으로 강제 (롤백) | (off) |
| `FONT_PATH` | drawtext용 한글 폰트 경로 직접 지정 | fallback 탐색 |
| `WORKER_CONCURRENCY` | BullMQ 워커 동시 처리 개수 | `2` |
| `CHROMIUM_PATH` | Remotion용 Chromium 바이너리 | Dockerfile `/usr/bin/chromium` |

### FONT_PATH fallback 순서
1. `$FONT_PATH`
2. `/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc` (Dockerfile `fonts-noto-cjk` 설치 경로)
3. `/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc`
4. `/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc`
5. `/usr/share/fonts/truetype/noto/NotoSansKR-Bold.otf`
6. `C:\Windows\Fonts\malgunbd.ttf` (로컬 테스트)
7. `C:\Windows\Fonts\malgun.ttf`
8. `/System/Library/Fonts/AppleSDGothicNeo.ttc` (macOS 로컬 테스트)

fallback을 모두 실패하면 `renderFfmpegVideo`는 즉시 throw. 클라이언트는 잡 status=error로 안내 받음.

## 전환 시나리오

### 운영 중 Remotion으로 전면 롤백
```bash
# Railway worker 서비스 Variables에 추가
FORCE_REMOTION=1
```
워커 재시작 직후부터 모든 신규 잡이 Remotion으로 처리됨. 기존 대기 중인 잡도 포함. ffmpegRenderer 코드는 그대로 남아있어 언제든 OFF하면 복귀.

### 특정 스타일만 Remotion
Edge Function이 보내는 `videoStyle`을 `"premium"`으로 지정한 잡만 Remotion으로 감. 나머지는 ffmpeg.

### 로컬 개발 테스트
```bash
cd video-server
# FFmpeg 렌더만 (Redis 불필요)
npm run test:ffmpeg

# BullMQ 큐 (로컬 Redis 필요)
docker run -p 6379:6379 -d redis:7-alpine
npm run test:queue

# 모두
npm test
```

## 알려진 한계

### ffmpegRenderer
- zoompan `d=<frames>` 정확도: 입력 스트림이 `-framerate 24 -t X`로 명시되어야 함 (본 구현에서는 보장)
- `xfade`는 모든 씬이 같은 해상도/fps여야 안정 (본 구현에서는 전부 1080×1920 @ 24fps로 통일)
- drawtext는 자동 줄바꿈 없음 — subtitle은 20자 이내 권장. 장문은 render 전 잘라야 함

### Remotion
- Chromium OOM 여전히 발생 가능 (잡당 400~800MB)
- Railway 재배포 시 remotion-bundle 재빌드 필요 (Dockerfile RUN 단계)
- `logoUrl` 전달 시 EndingCard가 로고를 표시하지 않는 버그 존재 — 현재 미수정 ([SmsSceneComp.tsx](../video-server/remotion/components/EndingCard.tsx#L30))

## 성능 측정 방법

```bash
# 로컬
cd video-server
FONT_PATH=/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc \
  node --test tests/ffmpegRenderer.test.js
# → "[test] 렌더 시간: XXXXms" 로그 확인
```

프로덕션:
```
Railway worker 로그에서 "engine=ffmpeg" 또는 "engine=remotion" 옆의 elapsed() 값
```

Remotion 대비 ffmpegRenderer는 동일 입력 기준 약 **3~5배 빠름**이 목표이며, 실제 벤치마크 결과는 본 문서에 계속 갱신할 예정.

# SMS 앱 — Claude Code 개발 규칙

> 마지막 갱신: 2026-04-30

## 1. 프로젝트 정보

| 항목 | 값 |
|---|---|
| 경로 (개발용 미러) | `/e/dev/sms-app` |
| 경로 (원본, Vite 실행 불가) | `e:/#앱 개발/SMS앱 개발` — 디렉토리명에 `#` 포함 |
| 스택 | React 18 + TypeScript + Vite 5 + Tailwind + Supabase + shadcn/ui |
| 상태 관리 | Zustand (persist localStorage) |
| 영상 렌더링 | Shotstack 외부 SaaS API (자체 video-server는 v6.0에서 폐기) |
| GitHub | `able821029-oss/bangsu-pro-67ad7d63` |
| 배포 | Cloudflare Pages → `https://sms-app-9p9.pages.dev` |

### 경로 규칙 (중요)
`#` 문자 때문에 원본 경로에서 `vite dev`가 실패합니다 (`/src/main.tsx` URL 해석 실패).
**개발·빌드는 반드시 `/e/dev/sms-app`에서만 수행**하고, 커밋만 원본에서 처리합니다.
두 경로를 완전 동기화하려면:
```bash
git pull   # 양쪽 모두에서
```

## 2. 핵심 도메인 규칙

### 시공 전용화 (2026-04-19 확정)
- 업종 카테고리 10종은 전부 제거됨. `BusinessCategory` 타입 / `BUSINESS_CATEGORY_LABELS` / `Settings.businessCategory` 모두 삭제.
- 앱은 **건축·시공 업체 전용**. 블로그/영상 프롬프트는 `시공` 맥락 고정.
- 블로그 포맷은 **제목 → 현장정보(지역·시공면적·공법·기타) → `subtitle → text → photo` 섹션 반복** 구조. `ContentBlock.type`에 `"subtitle"` 포함.

### 탭 구조 (변경 금지)
```
home · calendar · shorts(center) · content · mypage
```
- `settings` 탭 없음 → MyPage에서 서브페이지로 진입
- 중앙 `shorts` 탭만 원형 글로우 배경, 나머지 4탭은 **사각형** `nav-active-bg` 하이라이트

### 직접 글쓰기 탭 구조 (2026-04-30 갱신 · 2-mode 분기)
`src/pages/BlogWriterTab.tsx`는 **타입 선택 → mode별 작성 화면** 2단계 구조. Step1/Step2 위저드 없음.

#### 진입 흐름
1. `draft.mode === undefined` → **TypePicker** 노출: [전문가형] / [브이로그형] 2지선다
2. 선택 후: 상단 `ModeBanner`에 현재 모드 표시 + "유형 변경" 버튼

#### 전문가형 (`mode === "expert"`)
1. **상단 현장 정보** (`FieldsBlock`): 제목 · 지역(3단계) · 시공면적 · 공법 · **특가 항목** (`siteSpecial`) · 기타 · 발행 채널
2. **섹션 영역** (`SectionsBlock` → `SectionCard`): 소제목 · 사진 · 글(5줄 권장) · **AI 글쓰기 인라인 버튼**
3. 블록별 [+]/[-]: 아래에 빈 블록 삽입 / 현재 블록 삭제
4. 하단 **"+ 글쓰기 추가"**: 끝에 빈 블록 추가

#### 브이로그형 (`mode === "vlog"`)
1. **현장 정보 없이** `VlogHeaderBlock`만: 제목 + 발행 채널
2. **섹션**(`SectionCard`): 텍스트 입력 · 사진 · 새 글(자유형식) · **AI 글쓰기 인라인 버튼**
3. 블록별 [+]/[-] + 하단 "+ 글쓰기 추가" 동일

#### 공통 — paste 핸들러 (2026-04-30 추가)
- `useImagePaste` 훅(`src/hooks/useImagePaste.ts`)이 `SectionCard`의 textarea/소제목 input에 부착
- 클립보드에 이미지 있을 때 `clipboardData.items` 순회 → `getAsFile()` → `compressImage` → 섹션 사진으로 자동 흡수
- 텍스트만 있으면 native paste 진행. iOS Safari 별도 권한 요청 불필요 (paste 이벤트 자체가 사용자 제스처 컨텍스트).

위 흐름은 앱의 핵심 워크플로. 모드를 추가·세분화하는 건 가능하나, 모드별 화면을 합치거나 위저드 단계로 되돌리는 변경은 금지.

### AI 글쓰기 플로우 (2026-04-20 확정)
`src/pages/CameraTab.tsx`는 2단계 위저드로 동작. Step2는 직접 글쓰기와 **동일한 3블록 편집 화면**이 뜬다.

- **Step 1**: 사진(최대 10장, 400px/q0.7 압축) · 현장 정보(지역·일자·면적·공법·기타) · 제목(비우면 AI가 자동 생성)
- **Step 2**: 3블록 편집 화면 — `FieldsBlock`(편집 가능한 현장정보 carry-over) + `SectionsBlock`(`SectionCard` 재사용) + 버튼 3종
  - **[+ 글쓰기 추가]**: 빈 섹션 수동 추가
  - **[AI로 자동 완성]**: `generate-blog` 호출 → 결과(blocks)를 `blocksToSections`로 역변환하여 섹션 일괄 채움
  - **[저장하기]**: sections → blocks 변환 후 posts 테이블 insert + PostDetailPage 이동

AI 실패해도 편집기는 독립 작동하므로 "결과 안 나옴" 재발 방지. 제목 길이 < 8자일 때 `location + siteMethod`로 클라이언트 보강.

### 인증 방식 (2026-04-20 재변경 · 최종)
- **이메일 + 비밀번호** (`AuthPage.tsx`). `LoginPage.tsx`는 AuthPage를 그대로 노출하는 얇은 래퍼.
- SMS OTP·카카오·구글·네이버 OAuth **모두 제거**. Supabase Email provider는 기본 활성화라 대시보드 설정 불필요.
- 비밀번호 재설정은 `reset-password` Edge Function 경유.
- dev 테스트 모드(`isDevModeAllowed()`)는 `import.meta.env.PROD`에서 강제 비활성화되어 localhost에서만 표시.

### 무료 플랜 한도 (2026-04-20 현재)
- 블로그 5건 / 영상 1건 월 기준 (`subscription.maxCount`, `maxVideo`)
- **사용량 집계**: `subscription.usedCount` 증가 로직 미구현 → HomeTab이 `posts`를 `createdAt.startsWith(YYYY-MM)` 필터로 파생 계산
- 향후 `usage_counters` RPC 도입 시 파생 계산 제거 예정 ([HomeTab.tsx:68-79](src/pages/HomeTab.tsx#L68-L79))

### 핵심 기능 맵 (2026-04-20 현재 작동 중)

| 영역 | 경로 | 상태 | 비고 |
|---|---|---|---|
| 홈 대시보드 | `HomeTab.tsx` | ✅ | 이번 달 사용량·4주 차트·등급 메달·SEO 점수 |
| 일정 캘린더 | `CalendarTab.tsx` | ✅ | 월별 시공 일정·일당 계산·날씨 판단·임금체불 |
| AI 글쓰기 | `CameraTab.tsx` | ✅ | 2단계 플로우(사진+현장정보 → 3블록 편집) |
| 직접 글쓰기 | `BlogWriterTab.tsx` | ✅ | 3블록 고정 구조, 최대 4개 동시 작성 |
| 발행 현황 | `PublishTab.tsx` | ✅ | 네이버·인스타·틱톡 현황 |
| 쇼츠 영상 | `ShortsCreator.tsx` | ⚠️ | Shotstack 전환 진행 중 (Railway/Remotion 렌더는 v6.0에서 폐기) |
| 글 상세·SEO 분석 | `PostDetailPage.tsx` + `SeoScoreBadge.tsx` | ✅ | Haiku 기반 SEO 점수 분석 |
| 업체 설정 | `ProfileSettings.tsx` | ✅ | 업체명·로고·SNS 연동(네이버·인스타·틱톡 전부 "연결하기" 버튼) |
| 로그인 | `AuthPage.tsx` | ✅ | 이메일+비밀번호 + 재설정 |

### Edge Function 맵 (2026-04-20 현재)

| 함수 | 모델/외부API | `verify_jwt` | 용도 |
|---|---|---|---|
| `generate-blog` | Claude Haiku 4.5 + Vision | `false` | AI 블로그 생성 (prompt caching 적용) |
| `generate-section` | Claude Haiku 4.5 + Vision | `false` | 섹션별 짧은 본문(5줄) 생성 — BlogWriterTab의 인라인 AI 버튼용. 월 한도 미적용, rate limit만 적용. |
| `generate-shorts` | Claude Haiku 4.5 + ElevenLabs | `false` | 쇼츠 스크립트 + 나레이션 오디오 |
| `tts-preview` | ElevenLabs | `false` | 음성 미리듣기 |
| `seo-analyze` | Claude Haiku 4.5 | `false` | SEO 점수 분석 (prompt caching 적용) |
| `test-elevenlabs` | ElevenLabs | `false` | 관리자 도구 키 유효성 확인 |
| `reset-password` | Supabase admin API | `true` | 이메일 기반 비밀번호 재설정 |
| `delete-account` | Supabase admin API | `true` | 회원 탈퇴 |
| `google-calendar-sync` | Google OAuth | `true` | 일정 연동 |
| `kakao-pay` | 카카오페이 | `true` | 결제 (키 미수령, UI mock) |
| `naver-oauth` | 네이버 | `true` | 레거시, 미사용 |

**`verify_jwt=false` 6함수**는 anon 호출 허용 — API 비용 남용 방지는 ANTHROPIC·ElevenLabs 쿼터와 Supabase 글로벌 rate limit에 의존. Origin 헤더 검증은 `_shared/guard.ts`로 전체 적용 중.

## 3. 디자인 시스템 (2026-04-19 개편)

### 브랜드 색상
- Primary: `#237FFF` / `#AB5EBE`
- 그라데이션: `linear-gradient(135deg, #237FFF, #AB5EBE)`
- 배경: `#0E1322` (딥 네이비)

### 재사용 유틸리티 (`src/index.css`)
| 클래스 | 용도 |
|---|---|
| `.glass-card` | 기본 글래스 카드 — 블루 글로우 보더 + 내부 섀도 |
| `.glass-card-glow` | 강조/선택 상태 — 퍼플 섞인 글로우 강화 |
| `.icon-chip` / `.icon-chip-sm` / `.icon-chip-lg` | 흰 둥근 사각형 아이콘 칩 |
| `.nav-active-bg` | 하단 탭 활성 배경 (사각형 블루 글로우) |
| `.btn-power` | 메인 CTA 버튼 (그라데이션 + 글로우 섀도) |
| `.text-glow` / `.ring-glow` | 텍스트/섀도 글로우 |
| `.stat-number` / `.stat-unit` | 대시보드 큰 숫자 + 작은 단위 라벨 타이포 |

### IconChip 컴포넌트 (`src/components/IconChip.tsx`)
```tsx
<IconChip icon={Camera} color="blue" size="md" />
```
지원 컬러: `blue | purple | cyan | green | amber | rose | indigo | orange | slate`

**원칙:** `bg-card` / `bg-muted` 로 단순 카드 만들지 말고 `glass-card`를 쓴다. Material Symbols 폰트는 레거시 코드에만 존재, 신규는 **Lucide + IconChip**.

## 4. 개발 워크플로우

### 수정 후 체크리스트 (필수)
```bash
cd /e/dev/sms-app
npx tsc --noEmit           # 타입 에러 0개
# (UI 변경 시) 브라우저 확인
cd "/e/#앱 개발/SMS앱 개발"  # 원본으로 이동
git add -A && git commit -m "..." && git push  # CF Pages 자동 배포
```

### Edge Function 배포
```bash
npx supabase functions deploy <function-name>
```
코드 수정 후 반드시 실행 (Supabase가 자동 배포하지 않음).

### 헤드리스 검증
Playwright가 이미 설치되어 있으므로 흰 화면/런타임 에러 디버깅 시 직접 검증:
```js
const page = await (await chromium.launch()).newContext().then(c=>c.newPage());
page.on('pageerror', e => console.log(e.message));
await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'check.png', fullPage: true });
```

## 5. 지켜야 할 원칙
- TypeScript 에러 **0개** 유지 (`npx tsc --noEmit`)
- `console.log` 새로 추가 금지 (기존 debug 로그는 그대로 둠)
- 더미 데이터 사용 금지 (Supabase 실데이터 or 명시적 mock)
- 커밋 메시지: Conventional Commits (`feat:`, `fix:`, `refactor:`)
- `.env` 파일은 절대 커밋하지 않음 (`.env.example`만 커밋)

## 6. 자주 발생하는 에러

| 증상 | 해결 |
|---|---|
| 흰 화면 + `VITE_SUPABASE_URL ... must be set` | `.env`가 없음 → 원본에서 복사 |
| `Failed to load url /src/main.tsx` | `#` 경로에서 실행 중 → `/e/dev/sms-app`으로 이동 |
| `Failed to resolve import "@sentry/react"` | `src/lib/sentry.ts`의 동적 import에 `@vite-ignore` + 변수 문자열 필요 |
| Edge Function 500 | `return new Response(JSON.stringify({error}), { status: 200 })` 로 200+error 응답 사용 |
| Edge Function 401 Unauthorized | 공개 AI 함수면 `supabase/config.toml`에 `verify_jwt=false` 후 `--no-verify-jwt` 플래그로 재배포 |
| Edge Function Payload Too Large | 사진을 여러 장 보내지 말고 대표 1장만 (`photos.slice(0,1)` + 400px 압축) |
| ElevenLabs 401 `detected_unusual_activity` | Free Tier 차단 — **Starter 유료 구독 필수** |
| 사진 업로드 > 6MB | `compressPhotos()` 유틸로 클라이언트 압축 |
| `photos.slice` 타입 에러 | `photos.slice(0,5).map((p,i) => ({ dataUrl: p.dataUrl, index: i+1 }))` |
| AI 제목이 "방수공사" 한 단어 | 클라이언트에서 `rawTitle.length < 8`이면 `location + siteMethod + rawTitle`로 보강 |
| "시공 시공 완료" 중복 제목 | mock/fallback에서 `detectedType`에 "시공" 포함 여부에 따라 `완료` / `시공 완료` 분기 |

## 7. 확정된 기술 결정

| 항목 | 결정 |
|---|---|
| LLM 모델 (Edge Function 전체) | `claude-haiku-4-5-20251001` — 속도·비용 최적. Sonnet·Opus 사용 금지 |
| LLM Prompt Caching | `generate-blog`, `seo-analyze` 시스템 프롬프트에 `cache_control: ephemeral` 적용 |
| Edge Function 인증 정책 | 공개 AI 엔드포인트 5개는 `verify_jwt=false` (supabase/config.toml 명시). 사용자 데이터 함수(`reset-password` 등)는 `true` 유지 |
| TTS | **ElevenLabs Starter 유료** ($6/월, 30,000자). Free Tier는 데이터센터 IP 차단되므로 사용 불가. 음성 6종(남 3·여 3). Web Speech API는 폴백만 |
| 영상 렌더링 | **Shotstack 외부 SaaS API** (v6.0). 자체 video-server(Railway/Remotion/FFmpeg)는 폐기. 클라이언트는 Shotstack ingest/render API 직접 호출 |
| 패키지 매니저 | **npm 전용** (bun 금지, `bun.lock` / `bun.lockb` 재생성 금지) |
| 결제 | 카카오페이 + 토스페이먼츠 (키 미수령, UI는 mock) |
| 분석 | GA4 + Microsoft Clarity (운영 환경만, env 없으면 no-op) |
| 에러 트래킹 | Sentry (동적 import, 패키지 미설치 허용) |
| 보안 헤더 | `public/_headers`에 HSTS / X-Frame-Options DENY / Referrer-Policy / Permissions-Policy. CSP는 후속 작업 |

## 8. 삭제된 파일 (재생성 금지)
- `.lovable/` — Lovable 미사용
- `bun.lock`, `bun.lockb` — npm 전환
- `test-results/` — Playwright 자동 생성 임시 폴더
- `video-server/` — v6.0에서 Railway 폐기, Shotstack 전환 (CHANGES.md Phase 4)
- `supabase/functions/render-video/` — Railway 프록시였음, v6.0에서 제거

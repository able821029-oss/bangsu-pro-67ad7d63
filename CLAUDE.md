# SMS 앱 — Claude Code 개발 규칙

> 마지막 갱신: 2026-04-19

## 1. 프로젝트 정보

| 항목 | 값 |
|---|---|
| 경로 (개발용 미러) | `/e/dev/sms-app` |
| 경로 (원본, Vite 실행 불가) | `e:/#앱 개발/SMS앱 개발` — 디렉토리명에 `#` 포함 |
| 스택 | React 18 + TypeScript + Vite 5 + Tailwind + Supabase + shadcn/ui |
| 상태 관리 | Zustand (persist localStorage) |
| 영상 서버 | `video-server/` (Railway 배포, Remotion 렌더링) |
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

### 인증 방식 (2026-04-19 변경)
- **전화번호 + SMS OTP** (`LoginPage.tsx`)
- 카카오/네이버 OAuth는 UI·코드에서 제거됨 (이메일 로그인은 대체 링크로 유지)
- 구현: `supabase.auth.signInWithOtp({ phone, channel: "sms" })` + `verifyOtp({ phone, token, type: "sms" })`
- 한국 번호 E.164 정규화(`toE164KR`), 60초 재전송 쿨다운
- **실제 SMS 발송은 Supabase Dashboard → Authentication → Providers → Phone 활성화 필수** (Twilio/MessageBird/Vonage/Textlocal 택1)

### 무료 플랜 한도 (서버측)
- 블로그 5건 / 영상 1개 월 기준
- `usage_counters` 테이블 + `increment_usage(type)` RPC 설계 예정 (현재는 로컬 store에서 집계)

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
| 사진 업로드 > 6MB | `compressPhotos()` 유틸로 클라이언트 압축 |
| `photos.slice` 타입 에러 | `photos.slice(0,5).map((p,i) => ({ dataUrl: p.dataUrl, index: i+1 }))` |

## 7. 확정된 기술 결정

| 항목 | 결정 |
|---|---|
| LLM 모델 (Edge Function) | `claude-haiku-4-5-20251001` (속도 우선) |
| 영상 렌더링 | Remotion (Canvas/FFmpeg 대체 완료) |
| 패키지 매니저 | **npm 전용** (bun 금지, `bun.lock` / `bun.lockb` 재생성 금지) |
| 결제 | 카카오페이 + 토스페이먼츠 (키 미수령, UI는 mock) |
| 분석 | GA4 + Microsoft Clarity (운영 환경만) |
| 에러 트래킹 | Sentry (동적 import, 패키지 미설치 허용) |

## 8. 삭제된 파일 (재생성 금지)
- `.lovable/` — Lovable 미사용
- `bun.lock`, `bun.lockb` — npm 전환
- `test-results/` — Playwright 자동 생성 임시 폴더

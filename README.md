# SMS — Self Marketing Service

> 시공 업체 사장님을 위한 AI 블로그·영상 자동 생성 앱
<!-- rebuild 2026-04-19 -->


현장 사진 몇 장만 찍으면 AI가 네이버 블로그용 글과 쇼츠 영상을 자동으로 만들어 드립니다.
소상공인·건축 시공 업체의 셀프 마케팅을 돕는 모바일 퍼스트 웹 앱입니다.

- **Production:** https://sms-app-9p9.pages.dev
- **Repo:** https://github.com/able821029-oss/bangsu-pro-67ad7d63

---

## 주요 기능

### 📸 AI 블로그 자동 생성
1. 현장 사진 촬영 / 갤러리에서 선택 (최대 10장)
2. 지역 / 시공면적 / 공법 / 기타 특이사항 입력
3. 페르소나(장인형·친근형·전문기업형) + 플랫폼(네이버·인스타·틱톡) 선택
4. AI(Claude Haiku)가 `제목 → 현장 소개 → 시공 전 상태 → 시공 과정 → 시공 완료` 소제목 구조로 자동 작성
5. 해시태그 15~20개 자동 삽입, SEO 점수 자가 평가 포함
6. 클립보드 복사 → 네이버 블로그 앱으로 딥링크 이동 → 붙여넣기

### 🎬 쇼츠 영상 자동 생성
- Shotstack API 기반 외부 SaaS 렌더링 (Railway/자체 렌더 서버는 v6.0에서 폐기)
- 나레이션 TTS (ElevenLabs) + BGM + 이미지 슬라이드 합성
- 최대 2분 MP4 출력, 나레이션/BGM/영상 속도 조절 가능

### 📅 일정 · 현장 도우미
- 공사 일정 관리 + Google 캘린더 동기화
- 일당 계산 / 날씨 판단 / 임금체불 신고 바로가기

### 📊 마이페이지
- 이번 달 블로그/영상 사용량 대시보드
- 플랜별 한도 강제 (무료 플랜: 블로그 5건 / 영상 1개)
- 요금제 업그레이드 (카카오페이·토스페이먼츠 예정)

---

## 기술 스택

| 레이어 | 사용 기술 |
|---|---|
| 프런트엔드 | React 18, TypeScript, Vite 5, Tailwind CSS, shadcn/ui |
| 상태 관리 | Zustand (localStorage persist) |
| 인증 | Supabase Auth — **전화번호 + SMS OTP** |
| DB / Storage | Supabase Postgres + RLS |
| AI 추론 | Anthropic Claude Haiku 4.5 (Edge Function) |
| 영상 렌더링 | Shotstack (외부 SaaS) |
| TTS | ElevenLabs |
| 분석 | GA4 + Microsoft Clarity |
| 에러 트래킹 | Sentry (optional) |
| 배포 | Cloudflare Pages (auto) + Supabase Edge Functions |

---

## 로컬 개발 환경

### 경로 주의
원본 작업 디렉토리(`e:/#앱 개발/SMS앱 개발`) 이름에 `#` 문자가 포함되어 **Vite dev 서버를 그대로 실행하면 `/src/main.tsx` URL 해석에 실패**합니다.
`#`이 없는 미러 경로 `/e/dev/sms-app`에서 개발·빌드하고, 양쪽은 git으로 동기화합니다.

### 필수 환경 변수 (`.env`)
`.env.example`을 복사해서 채웁니다.

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
# (선택) VITE_GA_ID / VITE_CLARITY_ID / VITE_SENTRY_DSN
```

### 실행
```bash
cd /e/dev/sms-app
npm install
npm run dev        # http://localhost:8080
npm run build
npx tsc --noEmit   # 타입 체크
```

### Edge Function 배포
```bash
npx supabase functions deploy generate-blog
# 기타: generate-shorts / tts-preview / seo-analyze / delete-account 등
```

---

## Supabase 설정 체크리스트

운영에 들어가기 전 Supabase 대시보드에서 설정해야 하는 항목:

- [ ] **Authentication → Providers → Phone 활성화** (Twilio 등 SMS 공급자 등록)
- [ ] **Authentication → URL Configuration**에 production URL 추가
- [ ] **Edge Function Secrets:** `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`
- [ ] `supabase/migrations/*.sql` 순서대로 적용됐는지 확인
- [ ] Storage 버킷 `video-storage` (public read) 생성 확인

---

## 디자인 시스템

다크 네이비(`#0E1322`) + 블루·퍼플 글로우 + 흰 둥근 사각형 아이콘 칩 기반의 glassmorphism UI입니다.
재사용 클래스는 [`src/index.css`](src/index.css) 참고:

- `.glass-card` / `.glass-card-glow` — 블루 글로우 카드
- `.icon-chip` + [`<IconChip>`](src/components/IconChip.tsx) — 9가지 브랜드 컬러 아이콘 칩
- `.btn-power` — 그라데이션 + 글로우 메인 CTA
- `.stat-number` / `.stat-unit` — 큰 숫자 + 작은 단위 타이포

---

## 라이선스 / 크레딧

내부 프로젝트 — 외부 배포 없음.

개발 규칙과 자주 쓰는 명령은 [`CLAUDE.md`](CLAUDE.md) 참고.

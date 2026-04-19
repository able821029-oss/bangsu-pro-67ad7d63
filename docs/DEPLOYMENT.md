# SMS 앱 배포 운영 가이드

> 마지막 갱신: 2026-04-19

실배포 전에 반드시 확인해야 할 **수동 작업 체크리스트**.
코드로 자동화할 수 없는 외부 서비스 설정을 정리합니다.

---

## 1. Supabase 대시보드 설정

### 1-1. 구 프로젝트 정리 (CRITICAL)
구 프로젝트 `hamtxjhjlfpeatwqcgwo`의 anon 키가 git 히스토리에 남아있음 (`275de15` 커밋).

- [ ] https://supabase.com/dashboard/projects 접속
- [ ] `hamtxjhjlfpeatwqcgwo` 프로젝트 존재 확인
- [ ] **사용 중이 아니라면 Settings → General → Pause project 또는 Delete project** 로 완전 제거
- [ ] 사용 중이라면 Settings → API → "Reset anon key" 실행 (기존 키 무효화)

### 1-2. 현재 프로젝트 (stnpepxiysfoblfeqvpu)

#### Authentication → Providers → Phone
- [ ] Phone provider **Enable**
- [ ] SMS Provider: Twilio 선택
  - Account SID: Twilio 콘솔에서 복사
  - Auth Token: Twilio 콘솔에서 복사
  - Message Service SID: Twilio Messaging Service에서 한국 발송 승인된 SID 등록
- [ ] Rate Limits: 기본값(1초당 30건)이면 충분, 필요 시 조정

#### Authentication → URL Configuration
- [ ] Site URL: `https://sms-app-9p9.pages.dev`
- [ ] Redirect URLs에 추가: `https://sms-app-9p9.pages.dev/`, `http://localhost:8080/` (개발용)

#### Database → Migrations
다음 마이그레이션이 순서대로 적용되어야 함 (Dashboard → Database → Migrations에서 확인):
```
20260402074620_... (초기 스키마)
20260402124524_...
20260403022235_...
20260404_create_video_storage
20260406100908_...
20260409_fix_rls_policies
20260410_admin_config
20260414120000_auth_extensions
20260414130000_notifications
20260414_profile_business_info
20260414_usage_counters            ← 무료 플랜 한도
20260419_tighten_rls_and_contact_messages ← 신규 (RLS 강화)
```

미적용 마이그레이션 있으면 CLI에서:
```bash
# config.toml이 올바른 project_id를 가리키는지 먼저 확인 (stnpepxiysfoblfeqvpu)
npx supabase link --project-ref stnpepxiysfoblfeqvpu
npx supabase db push
```

#### Edge Functions → Secrets
각 함수에서 사용하는 API 키 등록 필수:
- [ ] `ANTHROPIC_API_KEY` — generate-blog / generate-shorts가 실 응답을 생성하기 위해 필수
- [ ] `ELEVENLABS_API_KEY` — tts-preview / 쇼츠 나레이션
- [ ] (선택) `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — google-calendar-sync

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase secrets set ELEVENLABS_API_KEY=...
```

또는 Dashboard → Edge Functions → Secrets UI.

#### Edge Functions 배포 상태
마지막 배포 이후 코드 수정한 함수는 반드시 재배포:
```bash
npx supabase functions deploy generate-blog
npx supabase functions deploy generate-shorts
npx supabase functions deploy render-video
# ... 필요한 것만
```

### 1-3. 관리자 계정 부여
기존 `VITE_ADMIN_PW`는 **제거됨**. 관리자 권한은 `profiles.is_admin` 서버 플래그로 전환.

1. 관리자로 삼을 계정이 앱에서 메인 로그인(Phone OTP)을 1회 완료
2. Supabase SQL Editor에서 실행:
   ```sql
   UPDATE public.profiles
   SET is_admin = true
   WHERE user_id = (SELECT id FROM auth.users WHERE phone = '+821012345678');
   ```
3. 해당 계정이 앱에서 `#/admin` 진입 시 자동 대시보드 표시

---

## 2. GitHub Secrets (CI/CD)

Repository → Settings → Secrets and variables → Actions → "New repository secret"

### 필수
- [ ] `CLOUDFLARE_API_TOKEN` — Cloudflare → My Profile → API Tokens → "Edit Cloudflare Pages" 권한
- [ ] `CLOUDFLARE_ACCOUNT_ID` — Cloudflare 대시보드 우측 하단 Account ID
- [ ] `VITE_SUPABASE_URL` — `https://stnpepxiysfoblfeqvpu.supabase.co`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase → Settings → API → `anon public`
- [ ] `VITE_SUPABASE_PROJECT_ID` — `stnpepxiysfoblfeqvpu`
- [ ] `VITE_VIDEO_SERVER_URL` — Railway 영상 서버 URL (예: `https://bangsu-pro-67ad7d63-production-6e2e.up.railway.app`)

### 선택 (설정 안 하면 해당 기능 비활성)
- [ ] `VITE_GA_ID` — Google Analytics 4 측정 ID (`G-XXXXXXXXXX`)
- [ ] `VITE_CLARITY_ID` — Microsoft Clarity 프로젝트 ID
- [ ] `VITE_SENTRY_DSN` — Sentry 프로젝트 DSN (`https://...@sentry.io/...`)
- [ ] `VITE_KAKAO_JAVASCRIPT_KEY` — Kakao Developers 앱 JavaScript 키 (카카오톡 공유 기능용)

---

## 3. Cloudflare Pages 설정

### Environment variables (Production + Preview)
위 Secrets와 동일한 값들을 Cloudflare Pages → Settings → Environment variables에도 추가 (프리뷰 배포용).

### Custom Domain
- [ ] Custom domain 연결: `sms.yourdomain.com`
- [ ] SSL 자동 발급 확인

### 보안 헤더 (선택)
`public/_headers` 파일을 만들어 배포하면 CF Pages가 자동 적용:
```
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)
```

---

## 4. Kakao 개발자 콘솔 (카카오톡 공유용)

- [ ] https://developers.kakao.com 접속
- [ ] 내 애플리케이션 → "SMS" 앱 등록
- [ ] 플랫폼 → Web → 사이트 도메인에 `https://sms-app-9p9.pages.dev` (또는 커스텀 도메인) 추가
- [ ] JavaScript 키를 `VITE_KAKAO_JAVASCRIPT_KEY` Secret에 저장

---

## 5. Railway (영상 서버)

- [ ] video-server 프로젝트 Railway 배포 중
- [ ] Railway 환경변수에 `ELEVENLABS_API_KEY` 등록 (영상 렌더링 시 TTS 결합용)
- [ ] `/render-video` 엔드포인트가 200 응답하는지 헬스체크

```bash
curl -X POST https://bangsu-pro-67ad7d63-production-6e2e.up.railway.app/health
```

---

## 6. 최종 라이브 점검 (배포 직후)

### 모바일 실기 테스트
- [ ] iOS Safari에서 https://sms-app-9p9.pages.dev 접속
- [ ] Phone OTP 로그인 성공
- [ ] 글작성 탭 → 직접 글쓰기 → 저장 → 상세 페이지 이동
- [ ] 쇼츠 탭 → 영상 생성 (2장 이상 사진 필요)
- [ ] 마이 탭 → 프로필 설정 → 업체명 저장
- [ ] Android Chrome에서 동일 반복

### PWA
- [ ] 모바일 Chrome 주소창 "홈 화면에 추가" 제안 표시
- [ ] 설치된 PWA에서 Phone OTP 정상 동작
- [ ] 오프라인에서는 스플래시만 보이는지 (오프라인 캐싱 미구현 정상)

### SEO
- [ ] `view-source:https://sms-app-9p9.pages.dev` 에서 `og:image`가 `/og-image.png` 실제 파일 응답 확인
- [ ] https://developers.facebook.com/tools/debug/ 에서 URL 확인 → 카드 이미지 정상 표시
- [ ] https://cards-dev.twitter.com/validator 동일 확인

---

## 7. 문제 발생 시 롤백

```bash
# 직전 커밋으로 롤백
git revert HEAD --no-edit
git push

# 특정 커밋으로 롤백
git revert <commit-hash> --no-edit
git push
```

Cloudflare Pages는 이전 빌드를 보존하므로 Dashboard → Pages → Deployments에서 "Rollback to this deployment" 클릭도 가능.

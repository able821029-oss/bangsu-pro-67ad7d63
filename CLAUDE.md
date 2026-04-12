---
# SMS 앱 — Claude Code 개발 규칙

## 프로젝트 정보
- 경로: /e/dev/sms-app
- 스택: React + TypeScript + Vite + Tailwind + Supabase + shadcn/ui
- 영상 서버: video-server (Railway 배포)
- GitHub: able821029-oss/bangsu-pro-67ad7d63

## 탭 구조 (절대 변경 금지)
홈(home) | 일정(calendar) | 콘텐츠(content) | 마이(mypage)
settings 탭 없음 → mypage 사용

## 브랜드 색상
Primary: #237FFF / #AB5EBE
그라데이션: linear-gradient(135deg, #237FFF, #AB5EBE)

## 반드시 지킬 규칙
- TypeScript 에러 0개 유지 (수정 후 npx tsc --noEmit 실행)
- console.log 추가 금지
- 더미 데이터 사용 금지
- 수정 후 반드시 git add -A && git commit && git push

## 에러 발생 시 순서
1. 에러 메시지 정확히 읽기
2. 관련 파일 하나씩 수정
3. npx tsc --noEmit 로 확인
4. 빌드 테스트: npm run build

## 자주 발생하는 에러 해결법
- photos.slice 타입 에러 → photos.slice(0,5).map((p,i) => ({dataUrl: p.dataUrl, index: i+1}))
- Edge Function 500 → 200+error 방식으로 처리
- CORS 에러 → Supabase Edge Function 프록시 사용

## 수정 완료 후 배포 순서
1. npm run build (빌드 확인)
2. git push (GitHub)
3. Cloudflare Pages 자동 배포 대기

## 확정된 기술 결정사항
- Edge Function 모델: claude-haiku-4-5-20251001 (속도 우선)
- 영상 렌더링: Remotion (Canvas/FFmpeg 교체 예정)
- 배포: Cloudflare Pages — https://sms-app-9p9.pages.dev
- 결제: 카카오페이 + 토스페이먼츠 (키 미수령)

## 패키지 매니저
- npm만 사용 (bun 금지)
- npm install / npm run dev / npm run build

## 삭제된 파일 (재생성 금지)
- .lovable/ → Lovable 미사용
- bun.lock, bun.lockb → npm 전환
- test-results/ → 자동 생성 임시 폴더
---

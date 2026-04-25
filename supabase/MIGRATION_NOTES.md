# Supabase 마이그레이션 운영 메모

> 작성일: 2026-04-26

## 현재 상태

`npx supabase migration list` 실행 시 로컬과 원격 사이에 **bookkeeping drift**가 존재합니다.
**SQL 자체는 양쪽 모두 적용되어 있어 앱 동작에는 영향 없음.**

### 원인
초기 개발 단계에서 일부 마이그레이션을 로컬 파일(`YYYYMMDD_*.sql`, 8자리)과
Supabase SQL Editor(`YYYYMMDDhhmmss`, 14자리) 양쪽에서 혼용 적용했기 때문.

## 운영 규칙 (앞으로 반드시 준수)

### ✅ 새 마이그레이션 추가 절차
1. 파일명은 **14자리 timestamp** 사용:
   ```
   supabase/migrations/20260501143000_새기능_설명.sql
   ```
2. **로컬 파일 생성 → SQL Editor에 그대로 복사 → 실행**
3. `npx supabase db push`는 drift 해소 전까지 사용 금지

### ❌ 금지 사항
- 8자리 timestamp 사용 (`20260501_xxx.sql`)
- `supabase db push` 직접 실행 (drift 때문에 실패)
- `supabase db pull` 직접 실행 (로컬 파일 덮어쓸 위험)
- `supabase migration repair` 실행 (잘못된 방향 시 데이터 손상 위험)

## Drift 정리 (향후 유지보수 윈도우 시)

언제 정리할 것인가:
- 신규 기능이 stable 운영 진입한 후
- 사용자 부하가 낮은 시점 (새벽)
- 백업 직후

권장 절차:
1. 원격 DB 전체 백업 (Supabase 대시보드 → Database → Backups)
2. 로컬 마이그레이션 폴더 백업 (`cp -r supabase/migrations supabase/migrations.bak`)
3. `npx supabase db pull` 실행해 원격을 단일 마이그레이션으로 캡처
4. 기존 로컬 파일들 archive 폴더로 이동
5. 향후 마이그레이션은 새 파일에서 시작

## 참고
- 이 drift는 **출시 차단 요소가 아님**.
- Edge Function 배포 (`npx supabase functions deploy`)는 마이그레이션과 별개라 정상 작동.
- RLS 정책, RPC 함수, 테이블 스키마 모두 원격에 정상 반영됨.

-- ════════════════════════════════════════════════════════════════
-- 남용 탐지 스켈레톤 — profile 플래그 + abuse_candidates 뷰
-- ════════════════════════════════════════════════════════════════
-- 목적:
--  1) 관리자가 수동으로 abuse 여부를 마킹할 수 있는 flag를 profiles에 둠
--  2) usage_logs 기반으로 최근 1시간 에러율이 비정상적으로 높은 계정을
--     abuse_candidates 뷰로 노출 → 관리자 대시보드에서 확인 후 플래그 처리
-- 전제: 20260419(is_admin 헬퍼), 20260424_usage_logs.sql 선행
-- ════════════════════════════════════════════════════════════════

-- 1) profiles에 남용 플래그 + 사유 컬럼
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS abuse_flagged BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS abuse_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_abuse_flagged
  ON public.profiles(abuse_flagged) WHERE abuse_flagged = true;

COMMENT ON COLUMN public.profiles.abuse_flagged IS '관리자가 남용으로 마킹한 계정 여부';
COMMENT ON COLUMN public.profiles.abuse_reason IS '플래그 사유(관리자 메모)';

-- 2) abuse_candidates 뷰 — 최근 1시간 동안 10회 초과 호출 중
--    에러 비율이 50%를 넘는 사용자를 뽑아 관리자 리뷰 큐로 노출.
--    is_admin() 가드를 뷰 내부에 두어 비관리자는 빈 결과만 본다.
CREATE OR REPLACE VIEW public.abuse_candidates
WITH (security_invoker = on) AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE status = 'error')::INTEGER AS error_1h,
  COUNT(*)::INTEGER AS total_1h
FROM public.usage_logs
WHERE created_at >= now() - interval '1 hour'
  AND user_id IS NOT NULL
  AND public.is_admin()
GROUP BY user_id
HAVING COUNT(*) > 10
   AND COUNT(*) FILTER (WHERE status = 'error')::FLOAT / COUNT(*) > 0.5;

COMMENT ON VIEW public.abuse_candidates IS
  '최근 1시간 사용량이 10회 초과이며 에러율이 50% 초과인 사용자 — 관리자 전용 리뷰 큐';

-- 3) 뷰 접근 권한 — authenticated에게 SELECT 부여.
--    실제 데이터 노출은 내부 WHERE public.is_admin()이 결정.
REVOKE ALL ON public.abuse_candidates FROM PUBLIC;
GRANT SELECT ON public.abuse_candidates TO authenticated;

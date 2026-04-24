-- ════════════════════════════════════════════════════════════════
-- usage_logs — Edge Function 호출·비용 기록 (SaaS 운영 기반)
-- 2026-04-24
-- ════════════════════════════════════════════════════════════════
-- 목적:
--  1) 누가 얼마를 썼는지 서버가 정확히 안다 (클라이언트 파생 계산 탈피)
--  2) 월별 한도(subscription.maxCount) 강제의 서버 측 근거
--  3) 관리자 대시보드 DAU/MAU·실패율·비용 지표의 원천
--
-- 스키마:
--  - user_id  : Supabase auth.users FK (anon 호출은 NULL 허용)
--  - fn_name  : generate-blog | generate-shorts | seo-analyze | tts-preview | render-video
--  - status   : ok | error | rate_limited
--  - tokens_input / tokens_output : LLM 사용량 (없으면 NULL)
--  - cost_usd : 함수가 자체 계산해 기록 (대략치)
--  - extra    : 함수별 메타 (예: error_code, origin, tier)
-- ════════════════════════════════════════════════════════════════

-- 0) is_admin 헬퍼 — 20260419 마이그레이션에서 생성됨. 존재 보장용 NOOP.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  ) THEN
    RAISE NOTICE 'is_admin() is missing — run 20260419_tighten_rls_and_contact_messages.sql first';
  END IF;
END $$;

-- 1) 테이블
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fn_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error', 'rate_limited')),
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd NUMERIC(10, 6),
  extra JSONB,
  origin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) 인덱스 — 월 집계·사용자 조회·함수별 필터
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_created
  ON public.usage_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_fn_created
  ON public.usage_logs (fn_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created
  ON public.usage_logs (created_at DESC);

-- 3) RLS — 쓰기는 서비스롤(Edge Function)만, 읽기는 본인과 관리자
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_logs_select_own" ON public.usage_logs;
CREATE POLICY "usage_logs_select_own"
  ON public.usage_logs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "usage_logs_select_admin" ON public.usage_logs;
CREATE POLICY "usage_logs_select_admin"
  ON public.usage_logs
  FOR SELECT
  USING (public.is_admin());

-- INSERT/UPDATE는 서비스롤로만 (RLS 우회). 명시적 anon/authenticated INSERT 허용 안 함.

-- 4) 이번 달 집계 뷰 — 앱이 파생 계산 없이 바로 조회
CREATE OR REPLACE VIEW public.usage_current_month AS
SELECT
  user_id,
  fn_name,
  COUNT(*) FILTER (WHERE status = 'ok') AS ok_count,
  COUNT(*) FILTER (WHERE status = 'error') AS error_count,
  COUNT(*) FILTER (WHERE status = 'rate_limited') AS rate_limited_count,
  COALESCE(SUM(cost_usd), 0) AS cost_usd_sum,
  COALESCE(SUM(tokens_input), 0) AS tokens_input_sum,
  COALESCE(SUM(tokens_output), 0) AS tokens_output_sum
FROM public.usage_logs
WHERE created_at >= date_trunc('month', now())
GROUP BY user_id, fn_name;

-- 5) 코멘트
COMMENT ON TABLE public.usage_logs IS
  'Edge Function 호출 로그. generate-blog/shorts/seo-analyze 등이 INSERT. 월별 한도 강제·관리자 대시보드 원천.';
COMMENT ON VIEW public.usage_current_month IS
  '이번 달 사용량 집계. HomeTab이 subscription.usedCount 대신 이 뷰를 조회하도록 교체 예정.';

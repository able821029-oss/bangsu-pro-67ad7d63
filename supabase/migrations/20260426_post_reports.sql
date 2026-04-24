-- ════════════════════════════════════════════════════════════════
-- post_reports — 글 신고 접수 + 모더레이션 자동 플래그
-- 2026-04-26
-- ════════════════════════════════════════════════════════════════
-- 목적:
--  1) 사용자가 부적절한 공개 글을 신고할 수 있게 한다.
--  2) 신고 3건 누적 시 자동으로 posts.moderation_status='flagged' 전환.
--  3) 관리자는 AdminReports에서 신고 큐를 조회·처리.
--
-- RLS:
--  - 사용자: 본인이 제출한 신고만 SELECT / INSERT.
--  - 관리자: 전체 SELECT / UPDATE (status, admin_note, resolved_at).
-- ════════════════════════════════════════════════════════════════

-- 0) is_admin 헬퍼 존재 확인 (20260419 마이그레이션 의존)
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

-- 1) posts.moderation_status — 모더레이션 상태 플래그
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'ok'
    CHECK (moderation_status IN ('ok', 'flagged', 'hidden'));

CREATE INDEX IF NOT EXISTS idx_posts_moderation_status
  ON public.posts(moderation_status)
  WHERE moderation_status <> 'ok';

-- 2) post_reports 테이블
CREATE TABLE IF NOT EXISTS public.post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reporter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('ad', 'fraud', 'inappropriate', 'other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- 동일 사용자가 같은 글에 중복 신고하는 것을 방지 (UNIQUE 부분 인덱스)
CREATE UNIQUE INDEX IF NOT EXISTS uq_post_reports_reporter_post
  ON public.post_reports(post_id, reporter_user_id)
  WHERE reporter_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_reports_status
  ON public.post_reports(status);
CREATE INDEX IF NOT EXISTS idx_post_reports_created
  ON public.post_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_reports_post
  ON public.post_reports(post_id);

-- 3) RLS — 본인 신고 관리 + 관리자 전권
ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_reports_insert_own" ON public.post_reports;
CREATE POLICY "post_reports_insert_own"
  ON public.post_reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_user_id);

DROP POLICY IF EXISTS "post_reports_select_own" ON public.post_reports;
CREATE POLICY "post_reports_select_own"
  ON public.post_reports
  FOR SELECT
  USING (auth.uid() = reporter_user_id);

DROP POLICY IF EXISTS "post_reports_select_admin" ON public.post_reports;
CREATE POLICY "post_reports_select_admin"
  ON public.post_reports
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "post_reports_update_admin" ON public.post_reports;
CREATE POLICY "post_reports_update_admin"
  ON public.post_reports
  FOR UPDATE
  USING (public.is_admin());

-- 4) 집계 뷰 — 관리자 큐에서 신고 수 빠르게 조회
CREATE OR REPLACE VIEW public.post_report_stats AS
SELECT
  post_id,
  COUNT(*) AS report_count,
  COUNT(*) FILTER (WHERE status = 'open') AS open_count,
  MAX(created_at) AS last_reported_at
FROM public.post_reports
GROUP BY post_id;

COMMENT ON VIEW public.post_report_stats IS
  'post_id별 신고 집계. AdminReports 리스트에서 우선순위 정렬에 사용.';

-- 5) 트리거 — 신고 3건 누적 시 자동으로 posts.moderation_status='flagged'
-- 이미 'hidden'인 글은 격상 금지 (hidden > flagged).
CREATE OR REPLACE FUNCTION public.fn_post_reports_auto_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.post_reports
  WHERE post_id = NEW.post_id
    AND status IN ('open', 'reviewing');

  IF v_count >= 3 THEN
    UPDATE public.posts
       SET moderation_status = 'flagged'
     WHERE id = NEW.post_id
       AND moderation_status = 'ok';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_reports_auto_flag ON public.post_reports;
CREATE TRIGGER trg_post_reports_auto_flag
  AFTER INSERT ON public.post_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_post_reports_auto_flag();

COMMENT ON TABLE public.post_reports IS
  '사용자가 제출한 글 신고. status open → reviewing → resolved/dismissed.';
COMMENT ON COLUMN public.posts.moderation_status IS
  'ok | flagged(3건 누적 자동) | hidden(관리자 차단). UI에서 hidden 글 숨김 처리 예정.';

-- ════════════════════════════════════════════════════════════════
-- subscriptions RLS 추가 강화 — 쓰기는 서비스롤(Edge Function)만
-- 2026-04-24
-- ════════════════════════════════════════════════════════════════
-- 배경:
--  20260409_fix_rls_policies.sql 에서 Allow-all → owner-only로 좁혀졌으나,
--  "Users can (insert|update|delete) own subscriptions" 정책은 아직 열려 있음.
--  사용자가 브라우저 콘솔에서
--      supabase.from('subscriptions').update({ plan: '무제한', max_count: 9999 })
--              .eq('user_id', userId)
--  를 호출하면 자기 플랜을 자유롭게 올릴 수 있음.
--
--  실제 결제는 Edge Function(kakao-pay, verify_jwt=true)이 수행하고 서비스롤로
--  DB를 갱신하므로, anon/authenticated 쓰기 정책은 차단해도 정상 흐름에 영향 없음.
-- ════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can create own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.subscriptions;

-- 남은 SELECT 정책은 유지: "Users can view own subscriptions"

-- 관리자 전체 조회 (고객지원용)
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (public.is_admin());

-- 관리자 수동 조정 (환불·예외 처리용)
DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can update subscriptions"
  ON public.subscriptions
  FOR UPDATE
  USING (public.is_admin());

COMMENT ON TABLE public.subscriptions IS
  '결제/플랜 상태. 일반 사용자 쓰기 불가 — 결제 Edge Function(서비스롤) 또는 관리자만 수정.';

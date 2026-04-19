-- ════════════════════════════════════════════════════════════════
-- CRITICAL RLS 강화 + 문의 데이터 분리
-- ════════════════════════════════════════════════════════════════
-- 문제 1. admin_config는 요금제·프롬프트 등 관리자 설정을 담는데
--         기존 정책은 "authenticated" 모두에게 INSERT/UPDATE 허용 →
--         일반 사용자가 key="plans" 등으로 덮어쓸 수 있음.
-- 문제 2. ContactPage가 문의 메시지를 admin_config에 upsert하면서
--         같은 테이블을 다용도로 사용 → 위 공격면 추가.
-- 해결:   admin_config 쓰기 권한을 profiles.is_admin=true 사용자로 제한,
--         문의는 별도 contact_messages 테이블로 분리.
-- ════════════════════════════════════════════════════════════════

-- 0) profiles에 is_admin 컬럼 추가 (관리자 표식)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin
  ON public.profiles(is_admin) WHERE is_admin = true;

-- 1) is_admin 헬퍼 함수 — RLS에서 재사용
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND is_admin = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2) admin_config RLS 재정의 — 쓰기는 관리자만
DROP POLICY IF EXISTS "Anyone can read admin_config" ON public.admin_config;
DROP POLICY IF EXISTS "Authenticated can upsert admin_config" ON public.admin_config;
DROP POLICY IF EXISTS "Authenticated can update admin_config" ON public.admin_config;

-- 읽기는 모두 허용 (요금제·프롬프트는 앱이 참조해야 함)
CREATE POLICY "Anyone can read admin_config"
  ON public.admin_config
  FOR SELECT
  USING (true);

-- 쓰기는 관리자만
CREATE POLICY "Admins can insert admin_config"
  ON public.admin_config
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update admin_config"
  ON public.admin_config
  FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete admin_config"
  ON public.admin_config
  FOR DELETE
  USING (public.is_admin());

-- 3) contact_messages 테이블 신설 (문의 데이터 분리)
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'spam')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id
  ON public.contact_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status
  ON public.contact_messages(status);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- 사용자: 본인 문의만 조회 / 생성
CREATE POLICY "Users can view own contacts"
  ON public.contact_messages
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create contacts"
  ON public.contact_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 관리자: 전체 조회 / 상태 업데이트
CREATE POLICY "Admins can view all contacts"
  ON public.contact_messages
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update contacts"
  ON public.contact_messages
  FOR UPDATE
  USING (public.is_admin());

-- 4) 기존 admin_config에 남은 inquiry_* 키를 contact_messages로 마이그레이션
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT key, value FROM public.admin_config WHERE key LIKE 'inquiry_%'
  LOOP
    BEGIN
      INSERT INTO public.contact_messages (user_id, email, category, message, created_at, status)
      VALUES (
        NULLIF((rec.value->>'user_id')::TEXT, '')::UUID,
        rec.value->>'email',
        COALESCE(rec.value->>'category', 'general'),
        COALESCE(rec.value->>'message', ''),
        COALESCE((rec.value->>'created_at')::TIMESTAMPTZ, now()),
        COALESCE(rec.value->>'status', 'pending')
      );
      DELETE FROM public.admin_config WHERE key = rec.key;
    EXCEPTION WHEN OTHERS THEN
      -- 변환 실패한 레코드는 그대로 두고 로그만 남김
      RAISE NOTICE 'skipped inquiry %: %', rec.key, SQLERRM;
    END;
  END LOOP;
END $$;

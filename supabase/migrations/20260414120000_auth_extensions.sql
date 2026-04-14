-- 소셜 로그인 + 구독 플랜 지원 확장
-- profiles 테이블을 users + business_info 역할로 통합 사용
-- (새 테이블 분리 대신 기존 구조 확장 — 마이그레이션 단순화)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';

-- plan_type 값 제약 (free / basic / pro / enterprise)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_type_check
  CHECK (plan_type IN ('free', 'basic', 'pro', 'enterprise'));

-- provider 값 제약 (email / kakao / naver / google)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_provider_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_provider_check
  CHECK (provider IN ('email', 'kakao', 'naver', 'google', 'apple'));

-- 가입 트리거 업데이트 — 소셜 로그인 시 email / provider 자동 채움
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, provider)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    provider = EXCLUDED.provider,
    updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.profiles.plan_type IS '구독 플랜 (free/basic/pro/enterprise)';
COMMENT ON COLUMN public.profiles.provider IS '로그인 방식 (email/kakao/naver/google/apple)';
COMMENT ON COLUMN public.profiles.email IS '사용자 이메일 (auth.users 복사본 — 조회 편의용)';

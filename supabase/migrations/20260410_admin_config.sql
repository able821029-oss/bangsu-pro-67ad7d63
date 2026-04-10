-- 관리자 설정 테이블 (key-value)
CREATE TABLE IF NOT EXISTS public.admin_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능 (앱에서 설정값 참조), 쓰기는 authenticated만
CREATE POLICY "Anyone can read admin_config" ON public.admin_config FOR SELECT USING (true);
CREATE POLICY "Authenticated can upsert admin_config" ON public.admin_config FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update admin_config" ON public.admin_config FOR UPDATE USING (auth.role() = 'authenticated');

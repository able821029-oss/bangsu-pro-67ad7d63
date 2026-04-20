-- 쇼츠 영상 보관함 — 완성된 영상을 나중에 재다운로드할 수 있도록 저장
-- 2026-04-20

CREATE TABLE IF NOT EXISTS public.shorts_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '무제 쇼츠',
  video_url TEXT NOT NULL,
  thumbnail_data_url TEXT,          -- 대표 사진 data URL (작게 압축)
  video_style TEXT,
  voice_id TEXT,
  bgm_type TEXT,
  duration_sec INTEGER,
  scenes_preview TEXT[],            -- 장면 제목 1~6개 요약
  photo_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shorts_videos_user_created
  ON public.shorts_videos (user_id, created_at DESC);

-- RLS — 본인 것만 조회/생성/삭제 가능
ALTER TABLE public.shorts_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shorts_videos_select_own" ON public.shorts_videos;
CREATE POLICY "shorts_videos_select_own" ON public.shorts_videos
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shorts_videos_insert_own" ON public.shorts_videos;
CREATE POLICY "shorts_videos_insert_own" ON public.shorts_videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "shorts_videos_delete_own" ON public.shorts_videos;
CREATE POLICY "shorts_videos_delete_own" ON public.shorts_videos
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.shorts_videos IS
  '완성된 쇼츠 영상 메타데이터. video_url은 Railway 렌더 서버의 MP4 경로. 장기 보관이 필요한 경우 후속 작업에서 Supabase Storage로 이관 예정.';

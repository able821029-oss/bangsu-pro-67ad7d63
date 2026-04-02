
-- Create videos table for shorts
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  video_style TEXT NOT NULL DEFAULT '시공일지형',
  narration_type TEXT NOT NULL DEFAULT '남성',
  script JSONB NOT NULL DEFAULT '[]'::jsonb,
  shotstack_render_id TEXT,
  video_url TEXT,
  status TEXT NOT NULL DEFAULT '생성중',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on videos" ON public.videos FOR SELECT USING (true);
CREATE POLICY "Allow all insert on videos" ON public.videos FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on videos" ON public.videos FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on videos" ON public.videos FOR DELETE USING (true);

CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for shorts videos
INSERT INTO storage.buckets (id, name, public) VALUES ('shorts-videos', 'shorts-videos', true);

CREATE POLICY "Public read access for shorts videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shorts-videos');

CREATE POLICY "Anyone can upload shorts videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'shorts-videos');


-- Create posts table for blog content
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  work_type TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT '시공일지형',
  persona TEXT NOT NULL DEFAULT '장인형',
  platforms TEXT[] NOT NULL DEFAULT ARRAY['naver'],
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT '작성중',
  location TEXT DEFAULT '',
  building_type TEXT DEFAULT '',
  work_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Allow all access for now (no auth yet)
CREATE POLICY "Allow all select" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.posts FOR UPDATE USING (true);
CREATE POLICY "Allow all delete" ON public.posts FOR DELETE USING (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ════════════════════════════════════════════════════════════════
-- post-photos 버킷 생성 + RLS
-- ════════════════════════════════════════════════════════════════
-- 배경: 블로그 사진이 posts.photos[].dataUrl / posts.blocks[].content(dataURL)로
--       DB + localStorage 양쪽에 통째로 저장되고 있어서 무거움.
-- 목표: 사진은 Storage에 올리고 DB/로컬에는 URL만 보관.
-- 경로 규칙: {user_id}/{post_id}/{timestamp}-{index}.jpg
-- ════════════════════════════════════════════════════════════════

-- 1) 공개 읽기 버킷 (10MB 제한, jpeg/png/webp)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-photos',
  'post-photos',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- 2) RLS 정책 — 읽기는 모두, 쓰기는 본인 user_id prefix 경로만
DROP POLICY IF EXISTS "Public read post-photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert own post-photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own post-photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own post-photos" ON storage.objects;

CREATE POLICY "Public read post-photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'post-photos');

CREATE POLICY "Users can insert own post-photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'post-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own post-photos"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'post-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own post-photos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'post-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SMS 영상 저장 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sms-videos',
  'sms-videos',
  true,
  104857600, -- 100MB
  ARRAY['video/mp4', 'video/webm']
) ON CONFLICT (id) DO NOTHING;

-- 공개 읽기 정책
CREATE POLICY "Public read sms-videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'sms-videos');

-- 서비스 롤 쓰기 정책
CREATE POLICY "Service role write sms-videos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'sms-videos');

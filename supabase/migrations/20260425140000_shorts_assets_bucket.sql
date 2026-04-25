-- ════════════════════════════════════════════════════════════════
-- shorts-assets 버킷 — Shotstack 렌더용 임시 자산 (사진 + ElevenLabs MP3)
-- ════════════════════════════════════════════════════════════════
-- 배경: Shotstack API는 src에 공개 URL을 요구한다. 클라이언트가 보내준
--       base64 사진과 Edge Function이 받은 ElevenLabs MP3를 일단 이 버킷에
--       올리고 그 public URL을 timeline에 박아 POST 한다.
-- 보존: 영상이 완성되면 이 자산들은 더 이상 필요 없다. 후속 작업에서
--       오래된 객체를 정리하는 cron을 돌릴 예정 (현재는 그냥 누적).
-- 정책: public read (Shotstack이 fetch). insert는 service_role 만 (Edge Function).
-- ════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shorts-assets',
  'shorts-assets',
  true,
  20971520, -- 20MB (이미지 ~2MB, MP3 ~1MB 안쪽 가정)
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp',
    'audio/mpeg', 'audio/mp3', 'audio/mp4'
  ]
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read shorts-assets" ON storage.objects;
CREATE POLICY "Public read shorts-assets"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'shorts-assets');

-- INSERT/UPDATE/DELETE 는 별도 정책을 만들지 않는다.
-- service_role 키는 RLS 를 우회하므로 Edge Function 에서만 쓰기 가능.

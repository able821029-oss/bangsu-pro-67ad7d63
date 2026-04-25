-- ════════════════════════════════════════════════════════════════
-- shorts-assets 자동 정리 RPC — 2026-04-25
-- ════════════════════════════════════════════════════════════════
-- 배경: generate-shorts 가 매 영상마다 사진/MP3/로고를 shorts-assets 버킷에
--       업로드한다. Shotstack 렌더가 끝나면 더 이상 필요 없지만 그대로 남아
--       Storage 비용이 무한 누적된다.
-- 정책: 영상 생성 후 24시간 보관 → 사용자가 다운로드 못 받았을 케이스 대비.
--       그 이후엔 자동 삭제.
--
-- 호출 경로:
--   외부 cron (cron-job.org / EasyCron / GitHub Actions)
--     → POST /functions/v1/cleanup-shorts-assets (X-Cron-Secret 헤더)
--     → 이 RPC 호출
--
-- SECURITY DEFINER 로 storage.objects 에 직접 DELETE 권한 확보.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cleanup_shorts_assets(
  older_than_hours integer DEFAULT 24
)
RETURNS TABLE(deleted_count integer, freed_bytes bigint, cutoff timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_cutoff timestamptz := now() - make_interval(hours => GREATEST(older_than_hours, 1));
  v_count integer := 0;
  v_bytes bigint := 0;
BEGIN
  -- 삭제 전 통계 수집
  SELECT
    count(*),
    COALESCE(SUM((metadata->>'size')::bigint), 0)
  INTO v_count, v_bytes
  FROM storage.objects
  WHERE bucket_id = 'shorts-assets'
    AND created_at < v_cutoff;

  -- 실제 삭제 — Supabase 가 storage backend 와 동기화 (행 삭제 = 파일 삭제)
  DELETE FROM storage.objects
  WHERE bucket_id = 'shorts-assets'
    AND created_at < v_cutoff;

  RETURN QUERY SELECT v_count, v_bytes, v_cutoff;
END;
$$;

-- service_role 만 호출 가능 (외부 cron 도 service_role 키로 호출)
REVOKE ALL ON FUNCTION public.cleanup_shorts_assets(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_shorts_assets(integer) TO service_role;

COMMENT ON FUNCTION public.cleanup_shorts_assets(integer) IS
  'shorts-assets 버킷에서 N시간 이전 파일을 일괄 삭제. 외부 cron 으로 매일 호출 권장.';

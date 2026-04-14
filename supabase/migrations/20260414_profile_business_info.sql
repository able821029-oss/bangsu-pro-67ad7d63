-- 업체정보 컬럼을 profiles 테이블에 추가
-- 로그인한 사용자의 업체정보를 클라우드에 저장하여 멀티 기기 동기화 지원

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone_number TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS service_area TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_category TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS face_photo_url TEXT DEFAULT '';

-- 업종 빠른 조회용 인덱스 (관리자 대시보드 분석용)
CREATE INDEX IF NOT EXISTS idx_profiles_business_category
  ON public.profiles(business_category)
  WHERE business_category <> '';

COMMENT ON COLUMN public.profiles.company_name IS '업체명 (사장님이 입력)';
COMMENT ON COLUMN public.profiles.phone_number IS '대표 전화번호';
COMMENT ON COLUMN public.profiles.service_area IS '주요 활동 지역';
COMMENT ON COLUMN public.profiles.business_category IS '업종 카테고리 (건축_시공/요식업/미용_뷰티/자동차/청소_방역/반려동물/의료_헬스/교육/제조_판매/기타)';
COMMENT ON COLUMN public.profiles.company_description IS '업체 소개글';
COMMENT ON COLUMN public.profiles.logo_url IS '로고 이미지 URL (쇼츠 엔딩에 표시)';
COMMENT ON COLUMN public.profiles.face_photo_url IS '대표 얼굴 사진 URL (블로그 하단에 표시)';

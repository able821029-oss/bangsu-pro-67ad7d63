/**
 * dataUrl 이미지를 최대 maxSize px · JPEG quality로 압축.
 *
 * ⚠️ Anthropic Vision 제약
 *  - 단일 이미지 요청: 각 변 8000px까지 허용
 *  - 다중 이미지(many-image) 요청: **2000px 초과 시 즉시 에러**
 *  - SMS 앱의 `generate-shorts`는 최대 5장을 한 요청에 보내므로 2000px 여유 마진이 필수
 *  - 따라서 maxSize 기본값은 1500px (안전 마진 + 파일 크기 축소)
 *
 * 로드 실패 시 **원본을 돌려주지 않는다**. 원본이 고해상도이면 2000px 제약을 깨뜨리기 때문.
 * 대신 빈 문자열을 반환해 호출자가 자연스럽게 필터링하도록 한다.
 */
export function compressImage(dataUrl: string, maxSize = 1500, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== "string") {
      resolve("");
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        if (width > maxSize || height > maxSize) {
          const ratio = maxSize / Math.max(width, height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve("");
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (e) {
        console.warn("[imageCompress] canvas 실패:", e);
        resolve("");
      }
    };
    img.onerror = () => {
      console.warn("[imageCompress] 이미지 로드 실패 — 원본 반환 대신 skip (many-image 2000px 제약 회피)");
      resolve("");
    };
    img.src = dataUrl;
  });
}

/**
 * 여러 이미지를 병렬 압축. 실패한 이미지는 결과 배열에서 제외한다 (빈 문자열 필터링).
 */
export async function compressPhotos(
  photos: { dataUrl: string }[],
  maxSize = 1500,
  quality = 0.7,
): Promise<string[]> {
  const results = await Promise.all(photos.map((p) => compressImage(p.dataUrl, maxSize, quality)));
  return results.filter((d) => d && d.length > 0);
}

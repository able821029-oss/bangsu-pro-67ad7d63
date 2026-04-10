/** dataUrl 이미지를 최대 800px, JPEG 70% 품질로 압축 */
export function compressImage(dataUrl: string, maxSize = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round(height * maxSize / width);
          width = maxSize;
        } else {
          width = Math.round(width * maxSize / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl); // 실패 시 원본 반환
    img.src = dataUrl;
  });
}

/** 여러 이미지를 병렬 압축 */
export async function compressPhotos(photos: { dataUrl: string }[], maxSize = 800): Promise<string[]> {
  return Promise.all(photos.map(p => compressImage(p.dataUrl, maxSize)));
}

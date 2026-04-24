import { supabase } from "@/integrations/supabase/client";

const BUCKET = "post-photos";

function extContentTypeFromDataUrl(dataUrl: string): { ext: string; contentType: string } {
  const m = /^data:(image\/(jpeg|jpg|png|webp));/i.exec(dataUrl);
  const contentType = m ? m[1].toLowerCase() : "image/jpeg";
  const ext =
    contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return { ext, contentType };
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

export interface UploadPostPhotoArgs {
  userId: string;
  postId: string;
  dataUrl: string;
  index: number;
}

/**
 * dataUrl을 Supabase Storage `post-photos` 버킷에 업로드하고 공개 URL을 돌려준다.
 * 실패 시 null을 반환 — 호출부는 dataUrl을 fallback으로 유지한다.
 */
export async function uploadPostPhoto({
  userId,
  postId,
  dataUrl,
  index,
}: UploadPostPhotoArgs): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith("data:")) {
    return null;
  }
  try {
    const { ext, contentType } = extContentTypeFromDataUrl(dataUrl);
    const path = `${userId}/${postId}/${Date.now()}-${index}.${ext}`;
    const blob = await dataUrlToBlob(dataUrl);

    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType,
      upsert: false,
      cacheControl: "31536000",
    });
    if (error) {
      console.warn("[uploadPostPhoto] upload failed:", error.message);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (e) {
    console.warn("[uploadPostPhoto] exception:", e);
    return null;
  }
}

/**
 * 여러 장 병렬 업로드. 결과 배열 길이는 입력과 동일하며, 실패 항목은 null.
 */
export async function uploadPostPhotos(
  userId: string,
  postId: string,
  dataUrls: string[],
): Promise<(string | null)[]> {
  return Promise.all(
    dataUrls.map((dataUrl, i) =>
      uploadPostPhoto({ userId, postId, dataUrl, index: i }),
    ),
  );
}

/**
 * Edge Function(generate-blog)에 넘길 dataURL을 확보.
 * dataUrl이 메모리에 있으면 그대로, Storage url만 있으면 fetch해서 base64로 변환.
 */
export async function ensurePhotoDataUrl(photo: {
  dataUrl?: string;
  url?: string;
}): Promise<string | null> {
  if (photo.dataUrl && photo.dataUrl.startsWith("data:")) return photo.dataUrl;
  if (!photo.url) return null;
  try {
    const res = await fetch(photo.url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("[ensurePhotoDataUrl] fetch failed:", e);
    return null;
  }
}

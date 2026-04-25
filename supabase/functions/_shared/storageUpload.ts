// ────────────────────────────────────────────────────────────────
// Edge Function 전용 Storage 업로드 헬퍼
// 2026-04-25
//
// Shotstack 같은 외부 렌더 서비스가 fetch 할 수 있도록 base64 자산을
// shorts-assets 버킷에 올리고 public URL을 돌려준다.
// 실패는 null 로 표시 — 호출자가 부분 실패를 결정한다.
// ────────────────────────────────────────────────────────────────

const DEFAULT_BUCKET = "shorts-assets";

export interface DataUrlParts {
  bytes: Uint8Array;
  mimeType: string;
}

export function decodeDataUrl(dataUrl: string): DataUrlParts | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    bytes: base64ToBytes(match[2]),
  };
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface UploadOptions {
  /** 업로드 경로 — 버킷 내부 키. 예: `${userId}/${jobId}/photo-1.jpg` */
  path: string;
  bytes: Uint8Array;
  contentType: string;
  bucket?: string;
}

/** 업로드 성공 시 public URL, 실패 시 null. */
export async function uploadPublicAsset(opts: UploadOptions): Promise<string | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("[storageUpload] SUPABASE_URL/SERVICE_ROLE_KEY 없음 — 업로드 불가");
    return null;
  }
  const bucket = opts.bucket || DEFAULT_BUCKET;
  const uploadUrl = `${url}/storage/v1/object/${bucket}/${encodePath(opts.path)}`;
  try {
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        apikey: key,
        "x-upsert": "true",
        "content-type": opts.contentType,
        "cache-control": "public, max-age=3600",
      },
      body: opts.bytes,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(
        `[storageUpload] ${bucket}/${opts.path} 실패: ${res.status} ${txt.slice(0, 200)}`,
      );
      return null;
    }
    return `${url}/storage/v1/object/public/${bucket}/${encodePath(opts.path)}`;
  } catch (e) {
    console.error("[storageUpload] 예외:", e instanceof Error ? e.message : e);
    return null;
  }
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

export interface UploadDataUrlResult {
  url: string | null;
  mimeType: string | null;
}

/** dataURL → bytes 디코드 후 업로드. 결과로 public URL + mimeType 반환. */
export async function uploadDataUrl(
  dataUrl: string,
  pathWithoutExt: string,
  bucket?: string,
): Promise<UploadDataUrlResult> {
  const parts = decodeDataUrl(dataUrl);
  if (!parts) return { url: null, mimeType: null };
  const ext = mimeToExt(parts.mimeType);
  const url = await uploadPublicAsset({
    path: `${pathWithoutExt}.${ext}`,
    bytes: parts.bytes,
    contentType: parts.mimeType,
    bucket,
  });
  return { url, mimeType: parts.mimeType };
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
  };
  return map[mime.toLowerCase()] || "bin";
}

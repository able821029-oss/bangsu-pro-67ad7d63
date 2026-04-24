import { supabase } from "@/integrations/supabase/client";
import { useAppStore, PhotoItem } from "@/stores/appStore";
import { uploadPostPhoto } from "./uploadPostPhoto";

const BATCH_SIZE = 5;

type StoredPhoto = Pick<PhotoItem, "id" | "url" | "dataUrl" | "caption">;

function hasLegacyDataUrl(p: StoredPhoto): boolean {
  return !p.url && !!p.dataUrl && p.dataUrl.startsWith("data:");
}

/**
 * 로그인 직후 1회 실행 — posts[].photos 중 url은 없고 dataUrl만 있는 사진을
 * Storage에 백그라운드 업로드하고 DB/store의 photos 컬럼을 url로 교체.
 * 한 번에 최대 5개까지만 처리해 네트워크 쏠림을 방지한다.
 *
 * 이 함수는 실패에 관대하다 — 실패한 사진은 다음 세션에서 다시 시도된다.
 */
export async function migratePostPhotos(userId: string): Promise<void> {
  try {
    const state = useAppStore.getState();
    const targets = state.posts.filter((post) =>
      post.photos.some(hasLegacyDataUrl),
    );
    if (targets.length === 0) return;

    let processed = 0;
    for (const post of targets) {
      if (processed >= BATCH_SIZE) break;
      const legacyIdxs: number[] = [];
      post.photos.forEach((p, i) => {
        if (hasLegacyDataUrl(p as StoredPhoto) && processed < BATCH_SIZE) {
          legacyIdxs.push(i);
          processed += 1;
        }
      });
      if (legacyIdxs.length === 0) continue;

      const newPhotos = [...post.photos];
      let changed = false;
      for (const idx of legacyIdxs) {
        const ph = newPhotos[idx] as StoredPhoto;
        const url = await uploadPostPhoto({
          userId,
          postId: post.id,
          dataUrl: ph.dataUrl ?? "",
          index: idx,
        });
        if (url) {
          newPhotos[idx] = { id: ph.id, url, caption: ph.caption };
          changed = true;
        }
      }

      if (!changed) continue;

      // DB 업데이트 — url만 포함된 형태로 교체
      try {
        await supabase
          .from("posts")
          .update({
            photos: newPhotos.map((p) =>
              p.url ? { id: p.id, url: p.url } : { id: p.id, dataUrl: p.dataUrl ?? "" },
            ) as unknown as Record<string, unknown>[],
          })
          .eq("id", post.id)
          .eq("user_id", userId);
      } catch (e) {
        console.warn("[migratePostPhotos] DB update failed:", e);
      }

      // Store 업데이트
      useAppStore.getState().updatePost(post.id, { photos: newPhotos });
    }
  } catch (e) {
    console.warn("[migratePostPhotos] unexpected error:", e);
  }
}

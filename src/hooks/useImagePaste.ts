import { useCallback } from "react";
import { compressImage } from "@/lib/imageCompress";

export interface PastedImage {
  id: string;
  dataUrl: string;
}

interface Options {
  /** 이미지가 paste 되었을 때 호출 — 압축된 dataUrl 전달 */
  onImage: (img: PastedImage) => void;
  /** paste 시 이미지가 1개 이상 감지되면 텍스트 paste 동작을 막을지 여부 (기본 true) */
  preventTextWhenImage?: boolean;
  /** 이미지 압축 최대 변 (기본 1500px — Anthropic Vision 다중 이미지 2000px 제약 회피) */
  maxSize?: number;
  /** JPEG quality (기본 0.7) */
  quality?: number;
}

/**
 * input/textarea 의 onPaste 에 부착해 클립보드 이미지를 잡아내는 훅.
 *
 * 동작
 *  - clipboardData.items 순회 → image/* 발견 시 getAsFile() → dataUrl → compressImage → onImage
 *  - text/plain 만 있으면 native paste 가 그대로 진행됨 (preventDefault 호출 안 함)
 *  - 이미지+텍스트 동시 paste(스크린샷 캡처 도구 등): 이미지만 처리하고 텍스트는 무시 (preventTextWhenImage=true 기본)
 *
 * iOS Safari 권한
 *  - paste 이벤트는 사용자 제스처 컨텍스트에서 발생하므로 별도 권한 요청 불필요.
 *  - navigator.clipboard.read() 와 달리 이 훅은 ClipboardEvent 만 사용하므로 모든 모던 브라우저에서 동작.
 */
export function useImagePaste({
  onImage,
  preventTextWhenImage = true,
  maxSize = 1500,
  quality = 0.7,
}: Options) {
  return useCallback(
    async (e: React.ClipboardEvent<HTMLElement>) => {
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      const imageItems: DataTransferItem[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file" && it.type.startsWith("image/")) {
          imageItems.push(it);
        }
      }
      if (imageItems.length === 0) return; // 텍스트만 → native paste 진행

      if (preventTextWhenImage) e.preventDefault();

      for (const it of imageItems) {
        const file = it.getAsFile();
        if (!file) continue;
        try {
          const raw = await readAsDataUrl(file);
          if (!raw) continue;
          const compressed = await compressImage(raw, maxSize, quality);
          onImage({
            id: crypto.randomUUID(),
            dataUrl: compressed || raw,
          });
        } catch (err) {
          console.warn("[useImagePaste] paste 처리 실패:", err);
        }
      }
    },
    [onImage, preventTextWhenImage, maxSize, quality],
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve((ev.target?.result as string) || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

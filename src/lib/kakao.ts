/**
 * Kakao JavaScript SDK 공유하기 래퍼.
 *
 * - SDK는 index.html에서 <script>로 로드된다.
 * - VITE_KAKAO_JAVASCRIPT_KEY가 없으면 no-op.
 */

interface KakaoShareContent {
  title: string;
  description: string;
  imageUrl: string;
  link: { mobileWebUrl: string; webUrl: string };
}

interface KakaoShareButton {
  title: string;
  link: { mobileWebUrl: string; webUrl: string };
}

interface KakaoStatic {
  isInitialized: () => boolean;
  init: (appKey: string) => void;
  Share: {
    sendDefault: (options: {
      objectType: "feed";
      content: KakaoShareContent;
      buttons?: KakaoShareButton[];
    }) => void;
  };
}

declare global {
  interface Window {
    Kakao?: KakaoStatic;
  }
}

const KAKAO_KEY = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY as string | undefined;

export function isKakaoAvailable(): boolean {
  return Boolean(KAKAO_KEY) && typeof window !== "undefined" && Boolean(window.Kakao);
}

function ensureInitialized(): boolean {
  if (!KAKAO_KEY || typeof window === "undefined" || !window.Kakao) return false;
  if (!window.Kakao.isInitialized()) {
    try {
      window.Kakao.init(KAKAO_KEY);
    } catch (error) {
      console.warn("[kakao] init failed", error);
      return false;
    }
  }
  return window.Kakao.isInitialized();
}

export interface ShareParams {
  title: string;
  description: string;
  imageUrl?: string;
  url?: string;
}

export function shareToKakao(params: ShareParams): boolean {
  if (!ensureInitialized() || !window.Kakao) return false;

  const webUrl = params.url || (typeof window !== "undefined" ? window.location.href : "");
  const imageUrl =
    params.imageUrl ||
    (typeof window !== "undefined" ? `${window.location.origin}/og-image.png` : "");

  try {
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: params.title,
        description: params.description,
        imageUrl,
        link: { mobileWebUrl: webUrl, webUrl },
      },
      buttons: [
        {
          title: "자세히 보기",
          link: { mobileWebUrl: webUrl, webUrl },
        },
      ],
    });
    return true;
  } catch (error) {
    console.warn("[kakao] share failed", error);
    return false;
  }
}

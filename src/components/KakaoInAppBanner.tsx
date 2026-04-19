import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";

/**
 * 카카오톡 / 페이스북 / 인스타그램 등 인앱 브라우저 감지 배너.
 *
 * - 인앱 브라우저는 OAuth 팝업·카메라·PWA 설치·파일 업로드가 불안정해 실제 기능이 깨진다.
 * - KakaoTalk은 `kakaotalk://web/openExternal?url=...` 스킴으로 외부 브라우저 직접 이동이 가능.
 * - 그 외 인앱(인스타/페북)은 URL 복사·직접 열기 안내만.
 */

type Browser = "kakao" | "line" | "facebook" | "instagram" | "naver" | "other-inapp" | null;

function detectInApp(): Browser {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("kakaotalk")) return "kakao";
  if (ua.includes("line/")) return "line";
  if (ua.includes("naver")) return "naver";
  if (ua.includes("fban") || ua.includes("fbav") || ua.includes("fb_iab")) return "facebook";
  if (ua.includes("instagram")) return "instagram";
  // 일반적인 WebView 표식 — Android/iOS 인앱 대응
  const isAndroidWebView = /android/.test(ua) && /; wv\)/.test(ua);
  const isIOSWebView = /(iphone|ipod|ipad)/.test(ua) && !/safari/.test(ua);
  if (isAndroidWebView || isIOSWebView) return "other-inapp";
  return null;
}

const DISMISS_KEY = "sms_inapp_banner_dismissed";

export function KakaoInAppBanner() {
  const [browser, setBrowser] = useState<Browser>(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    setBrowser(detectInApp());
  }, []);

  if (!browser || dismissed) return null;

  const currentUrl = window.location.href;

  const handleOpenExternal = () => {
    if (browser === "kakao") {
      // 카카오톡 외부 브라우저 스킴
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(currentUrl)}`;
      return;
    }
    if (browser === "line") {
      // LINE 외부 브라우저 파라미터
      const sep = currentUrl.includes("?") ? "&" : "?";
      window.location.href = `${currentUrl}${sep}openExternalBrowser=1`;
      return;
    }
    // 그 외는 URL 복사 후 안내
    navigator.clipboard?.writeText(currentUrl).catch(() => {});
    alert("주소가 복사되었습니다.\nChrome / Safari에서 붙여넣어 열어주세요.");
  };

  const handleDismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  const label =
    browser === "kakao" ? "카카오톡 인앱 브라우저에서 접속 중입니다" :
    browser === "line" ? "LINE 인앱 브라우저에서 접속 중입니다" :
    browser === "naver" ? "네이버 앱 브라우저에서 접속 중입니다" :
    browser === "facebook" ? "페이스북 인앱 브라우저에서 접속 중입니다" :
    browser === "instagram" ? "인스타그램 인앱 브라우저에서 접속 중입니다" :
    "인앱 브라우저에서 접속 중입니다";

  const ctaLabel =
    browser === "kakao" || browser === "line" ? "외부 브라우저로 열기" : "주소 복사 후 Chrome/Safari에서 열기";

  return (
    <div
      role="alertdialog"
      aria-live="polite"
      aria-label="외부 브라우저 사용 권장 안내"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        background: "linear-gradient(135deg, #237FFF, #AB5EBE)",
        color: "white",
        padding: "12px 16px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        paddingTop: "max(12px, env(safe-area-inset-top))",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, maxWidth: 560, margin: "0 auto" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{label}</p>
          <p style={{ fontSize: 11, margin: "2px 0 0", opacity: 0.9, lineHeight: 1.4 }}>
            로그인·카메라·앱 설치가 정상 동작하지 않을 수 있어요. 외부 브라우저에서 열어주세요.
          </p>
          <button
            onClick={handleOpenExternal}
            style={{
              marginTop: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.22)",
              border: "1px solid rgba(255,255,255,0.35)",
              color: "white",
              fontSize: 12,
              fontWeight: 700,
              padding: "7px 12px",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            <ExternalLink size={13} />
            {ctaLabel}
          </button>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="닫기"
          style={{
            background: "transparent",
            border: 0,
            color: "white",
            opacity: 0.8,
            padding: 4,
            cursor: "pointer",
          }}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

export default KakaoInAppBanner;

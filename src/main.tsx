import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "@/lib/sentry";

// Sentry — DSN/환경이 맞을 때만 실제 초기화되는 no-op 래퍼
void initSentry();

// 저장된 테마 즉시 적용 (FOUC 방지)
const savedTheme = localStorage.getItem("sms_theme") || "dark";
if (savedTheme === "light" || (savedTheme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches)) {
  document.documentElement.classList.add("light");
}

// SW registration — only in production, not in iframes/preview
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreview =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (!isInIframe && !isPreview && "serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });

      // 페이지 포커스 또는 페이지 전환 시 업데이트 체크
      const checkForUpdate = () => { registration.update().catch(() => {}); };
      window.addEventListener("focus", checkForUpdate);
      setInterval(checkForUpdate, 60_000); // 1분마다 자동 체크

      // 새 SW가 설치되고 대기 중일 때 → 즉시 활성화
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // 새 버전 설치 완료 → 활성화 메시지 전송
            newWorker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });

      // SW가 새 버전으로 교체되면 자동 리로드 (한 번만)
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      // SW → 클라이언트 업데이트 알림 수신 (activate 직후)
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "SW_UPDATED") {
          // 이미 controllerchange에서 reload 처리되므로 로그만
          console.info("[SW] 새 버전으로 업데이트됨");
        }
      });
    } catch {
      // SW 등록 실패 시 무시
    }
  });
} else if (isPreview || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) =>
    regs.forEach((r) => r.unregister())
  );
}

createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
} else if (isPreview || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) =>
    regs.forEach((r) => r.unregister())
  );
}

createRoot(document.getElementById("root")!).render(<App />);

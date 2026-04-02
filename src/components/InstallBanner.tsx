import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (localStorage.getItem("pwa-banner-dismissed")) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    if (ios) {
      setShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
    setShow(false);
    localStorage.setItem("pwa-banner-dismissed", "1");
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("pwa-banner-dismissed", "1");
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4">
      <div className="max-w-lg mx-auto bg-card border border-border rounded-xl p-4 shadow-lg flex items-start gap-3">
        <Download className="w-6 h-6 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">홈화면에 추가하면 앱처럼 사용할 수 있어요</p>
          {isIOS ? (
            <p className="text-xs text-muted-foreground mt-1">
              Safari 하단 <span className="font-semibold">공유 버튼(⬆)</span> → <span className="font-semibold">홈 화면에 추가</span>를 눌러주세요
            </p>
          ) : (
            <Button size="sm" className="mt-2" onClick={handleInstall}>
              홈화면에 추가
            </Button>
          )}
        </div>
        <button onClick={handleDismiss} className="text-muted-foreground p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

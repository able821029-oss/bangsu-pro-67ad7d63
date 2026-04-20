import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * 오프라인 감지 배너 — 네트워크 끊김·복구 상태를 상단에 표시.
 * 다수 사용자 환경에서 네트워크 일시 불안정 시 사용자가 원인을 즉시 인지.
 */
export function NetworkStatusBanner() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] bg-red-500/95 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 backdrop-blur"
    >
      <WifiOff className="w-3.5 h-3.5" />
      인터넷 연결이 끊겼어요 — 복구되면 자동으로 다시 작동합니다
    </div>
  );
}

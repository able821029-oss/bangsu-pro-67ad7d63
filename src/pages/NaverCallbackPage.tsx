import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * 네이버 OAuth 콜백 — 더 이상 사용하지 않음.
 * 구 링크로 들어오는 사용자에게 안내만 표시하고 3초 뒤 홈으로 redirect.
 * naver-oauth Edge Function 호출 경로는 전부 제거.
 */
export default function NaverCallbackPage() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = "/";
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center px-6"
      style={{ minHeight: "100dvh" }}
    >
      <div className="max-w-sm w-full text-center space-y-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
          style={{ background: "rgba(239,68,68,0.15)" }}
        >
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-lg font-bold">네이버 로그인 지원 종료</h2>
        <p className="text-sm text-muted-foreground">
          네이버 로그인은 더 이상 지원되지 않습니다.
          <br />
          이메일 + 비밀번호로 로그인해 주세요.
        </p>
        <p className="text-xs text-muted-foreground">잠시 후 홈으로 이동합니다…</p>
        <button
          onClick={() => (window.location.href = "/")}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
        >
          지금 홈으로 이동
        </button>
      </div>
    </div>
  );
}

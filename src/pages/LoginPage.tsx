import { toast } from "sonner";
import { FlaskConical } from "lucide-react";
import AuthPage from "@/pages/AuthPage";
import { enableDevMode, isDevModeAllowed } from "@/lib/devAuth";

/**
 * SMS 로그인 페이지 — 이메일 · 비밀번호 일반 로그인
 *
 * Supabase는 Email provider가 기본 활성화되어 있어 추가 대시보드 설정이 필요하지 않습니다.
 * 실제 인증 화면은 AuthPage에서 담당하며, 이 컴포넌트는 dev 테스트 모드 진입 버튼만 덧붙입니다.
 */

export function LoginPage() {
  const handleDevTestMode = () => {
    enableDevMode();
    toast.success("테스트 모드 진입", { description: "실제 계정 없이 앱을 둘러봅니다" });
    setTimeout(() => window.location.reload(), 300);
  };

  return (
    <div className="relative min-h-screen bg-background" style={{ minHeight: "100dvh" }}>
      <AuthPage />

      {isDevModeAllowed() && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-sm px-6">
          <button
            onClick={handleDevTestMode}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl border border-dashed border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
            aria-label="개발 테스트 모드로 입장"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            개발 테스트 모드 (Supabase 불필요)
          </button>
        </div>
      )}
    </div>
  );
}

export default LoginPage;

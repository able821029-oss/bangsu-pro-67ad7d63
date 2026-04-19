import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, ArrowLeft, FlaskConical, Loader2 } from "lucide-react";
import AuthPage from "@/pages/AuthPage";
import { trackEvent } from "@/lib/analytics";
import { enableDevMode, isDevModeAllowed } from "@/lib/devAuth";
import { SmsLogo } from "@/components/SmsLogo";

/**
 * SMS 로그인 페이지 — 무료 소셜 로그인 (카카오 · 구글) + 이메일 대체
 *
 * 📋 Supabase 대시보드 설정 필수:
 *    Authentication → Providers → Kakao / Google → Enable
 *    Client ID · Client Secret 등록.
 *    Callback URL은 https://stnpepxiysfoblfeqvpu.supabase.co/auth/v1/callback
 */

export function LoginPage() {
  const [showEmail, setShowEmail] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<"kakao" | "google" | null>(null);

  const handleOAuth = async (provider: "kakao" | "google") => {
    setLoadingProvider(provider);
    try {
      const redirectTo = `${window.location.origin}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) throw error;
      trackEvent("sign_in_attempt", { method: provider });
      // 리다이렉트가 발생하므로 여기서 로딩 해제는 거의 도달하지 않음
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : `${provider} 로그인 실패`;
      if (msg.toLowerCase().includes("provider is not enabled")) {
        toast.error(`${provider === "kakao" ? "카카오" : "구글"} 로그인이 아직 설정되지 않았어요`, {
          description: "Supabase Authentication > Providers 에서 활성화해주세요.",
        });
      } else {
        toast.error(msg);
      }
      setLoadingProvider(null);
    }
  };

  const handleDevTestMode = () => {
    enableDevMode();
    toast.success("테스트 모드 진입", { description: "실제 계정 없이 앱을 둘러봅니다" });
    setTimeout(() => window.location.reload(), 300);
  };

  if (showEmail) {
    return (
      <div className="min-h-screen bg-background" style={{ minHeight: "100dvh" }}>
        <div className="sticky top-0 z-10 px-5 py-3 flex items-center gap-3 border-b border-white/10">
          <button
            onClick={() => setShowEmail(false)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> 뒤로
          </button>
          <h1 className="text-base font-bold">이메일로 로그인</h1>
        </div>
        <AuthPage />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-between px-6 py-10"
      style={{ minHeight: "100dvh" }}
    >
      {/* 상단 로고/타이틀 */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm gap-1">
        <div className="mb-4">
          <SmsLogo size={88} glow />
        </div>
        <h1 className="text-2xl font-bold text-foreground">SMS</h1>
        <p className="text-sm text-muted-foreground">Self Marketing Service</p>
        <p className="text-xs text-muted-foreground/70 text-center mt-1">
          소상공인을 위한 AI 마케팅 앱
        </p>
      </div>

      {/* 로그인 버튼 스택 */}
      <div className="w-full max-w-sm space-y-3">
        {/* 카카오 로그인 — Primary */}
        <button
          onClick={() => handleOAuth("kakao")}
          disabled={loadingProvider !== null}
          aria-label="카카오로 시작하기"
          className="w-full h-[52px] rounded-full flex items-center justify-center gap-2 font-bold text-[15px] transition-transform active:scale-95 disabled:opacity-60"
          style={{ background: "#FEE500", color: "#191919" }}
        >
          {loadingProvider === "kakao" ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <KakaoIcon />
              카카오로 시작하기
            </>
          )}
        </button>

        {/* 구글 로그인 — Secondary */}
        <button
          onClick={() => handleOAuth("google")}
          disabled={loadingProvider !== null}
          aria-label="구글로 시작하기"
          className="w-full h-[52px] rounded-full flex items-center justify-center gap-2 font-semibold text-[14px] transition-transform active:scale-95 disabled:opacity-60"
          style={{
            background: "#FFFFFF",
            color: "#1F1F1F",
            border: "1px solid rgba(0,0,0,0.12)",
          }}
        >
          {loadingProvider === "google" ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <GoogleIcon />
              구글로 시작하기
            </>
          )}
        </button>

        {/* 이메일 로그인 대체 링크 */}
        <button
          onClick={() => setShowEmail(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Mail className="w-3.5 h-3.5" />
          이메일로 로그인
        </button>

        {/* 🧪 개발 테스트 모드 — localhost 전용 */}
        {isDevModeAllowed() && (
          <button
            onClick={handleDevTestMode}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl border border-dashed border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
            aria-label="개발 테스트 모드로 입장"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            개발 테스트 모드 (Supabase 불필요)
          </button>
        )}

        {/* 약관 고지 */}
        <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed pt-2">
          계속 진행하면 <span className="underline">이용약관</span>과{" "}
          <span className="underline">개인정보처리방침</span>에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.88 5.2 4.72 6.6l-1.08 3.96c-.1.36.3.65.62.45l4.78-3.14c.32.02.64.04.96.04 5.52 0 10-3.48 10-7.8C22 6.48 17.52 3 12 3z"
        fill="#191919"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.28-1.93-6.14-4.52H2.18v2.84A10.99 10.99 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.86 14.12A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.36-2.12V7.04H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.44 1.18 4.96l3.68-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.68 2.84C6.72 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

export default LoginPage;

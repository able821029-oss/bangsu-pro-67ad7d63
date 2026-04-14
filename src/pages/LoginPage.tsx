import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import AuthPage from "@/pages/AuthPage";

/**
 * SMS 로그인 페이지 — 한국 사용자용 소셜 로그인 우선
 *
 * 📋 Supabase 대시보드 설정 필수:
 *
 * 1) Kakao OAuth
 *    Authentication → Providers → Kakao → Enable
 *    - Client ID: Kakao Developers > 앱 > REST API 키
 *    - Client Secret: (optional) Kakao Developers > 보안 > Client Secret
 *    - Redirect URL (사이트 콜백):
 *      https://stnpepxiysfoblfeqvpu.supabase.co/auth/v1/callback
 *    - Kakao Developers 내 Redirect URI에 동일 주소 등록
 *    - Scope: profile_nickname, account_email
 *
 * 2) Naver OAuth (Supabase 미지원 — Custom Edge Function 사용)
 *    Naver Developers > Application 등록
 *    - 서비스 URL: https://sms-app-9p9.pages.dev
 *    - Callback URL: https://sms-app-9p9.pages.dev/auth/naver/callback
 *    - 환경변수 (Supabase Edge Functions secrets):
 *      NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 *    - Edge Function: naver-oauth (별도 배포)
 */
export function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);

  const handleKakaoLogin = async () => {
    setLoading("kakao");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: `${window.location.origin}/`,
          scopes: "profile_nickname account_email",
        },
      });
      if (error) {
        toast.error("카카오 로그인 실패: " + error.message);
        console.error("[Kakao Login]", error);
      }
      // 성공 시 브라우저가 카카오 로그인 화면으로 자동 리다이렉트됨
    } catch (e) {
      toast.error("카카오 로그인 중 오류가 발생했습니다");
      console.error(e);
    } finally {
      setLoading(null);
    }
  };

  const handleNaverLogin = () => {
    // Naver는 custom OAuth — 서버사이드 Edge Function으로 위임
    setLoading("naver");
    const clientId = import.meta.env.VITE_NAVER_CLIENT_ID;
    if (!clientId) {
      toast.error("네이버 로그인이 아직 설정되지 않았습니다.", {
        description: "VITE_NAVER_CLIENT_ID 환경변수 설정 필요",
      });
      setLoading(null);
      return;
    }
    // 네이버 OAuth URL로 직접 리다이렉트
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/auth/naver/callback`
    );
    const state = crypto.randomUUID();
    sessionStorage.setItem("naver_oauth_state", state);
    window.location.href =
      `https://nid.naver.com/oauth2.0/authorize?response_type=code` +
      `&client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&state=${state}`;
  };

  if (showEmail) {
    return (
      <div className="min-h-screen bg-background" style={{ minHeight: "100dvh" }}>
        <div className="sticky top-0 z-10 px-5 py-3 flex items-center gap-3 border-b border-white/10">
          <button
            onClick={() => setShowEmail(false)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← 뒤로
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
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
        <div className="w-20 h-20 rounded-3xl p-1 mb-6"
          style={{ background: "linear-gradient(135deg, #237FFF, #AB5EBE)" }}>
          <div className="w-full h-full rounded-[1.25rem] bg-background flex items-center justify-center">
            <span
              className="headline-font font-black text-3xl"
              style={{
                background: "linear-gradient(135deg, #237FFF, #AB5EBE)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              S
            </span>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">SMS</h1>
        <p className="text-sm text-muted-foreground mb-1">Self Marketing Service</p>
        <p className="text-xs text-muted-foreground/70 text-center">
          소상공인을 위한 AI 마케팅 앱
        </p>
      </div>

      {/* 로그인 버튼 영역 */}
      <div className="w-full max-w-sm space-y-3">
        {/* 🟡 카카오 — 메인 CTA */}
        <button
          onClick={handleKakaoLogin}
          disabled={loading !== null}
          aria-label="카카오로 시작하기"
          className="w-full h-14 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ background: "#FEE500", color: "#191919" }}
        >
          {loading === "kakao" ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <KakaoIcon className="w-5 h-5" />
              카카오로 시작하기
            </>
          )}
        </button>

        {/* 🟢 네이버 — 서브 CTA */}
        <button
          onClick={handleNaverLogin}
          disabled={loading !== null}
          aria-label="네이버로 시작하기"
          className="w-full h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ background: "#03C75A", color: "#FFFFFF" }}
        >
          {loading === "naver" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <NaverIcon className="w-4 h-4" />
              네이버로 시작하기
            </>
          )}
        </button>

        {/* 구분선 + 이메일 링크 */}
        <div className="pt-2">
          <button
            onClick={() => setShowEmail(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            이메일로 가입 / 로그인
          </button>
        </div>

        {/* 약관 고지 */}
        <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed pt-2">
          계속 진행하면 <span className="underline">이용약관</span>과{" "}
          <span className="underline">개인정보처리방침</span>에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}

// ── 브랜드 아이콘 (인라인 SVG) ──
function KakaoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3C6.477 3 2 6.477 2 10.762c0 2.77 1.818 5.192 4.567 6.565l-.977 3.573c-.087.318.26.572.54.395L10.35 18.9c.54.076 1.09.115 1.65.115 5.523 0 10-3.476 10-7.762S17.523 3 12 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function NaverIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 3v10.5L8 3H3v18h5V10.5L16 21h5V3h-5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default LoginPage;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, ShieldCheck, Loader2, Mail, ArrowLeft } from "lucide-react";
import AuthPage from "@/pages/AuthPage";
import { trackEvent, identifyUser } from "@/lib/analytics";

/**
 * SMS 로그인 페이지 — 전화번호 + SMS OTP 인증
 *
 * 📋 Supabase 대시보드 설정 필수:
 *    Authentication → Providers → Phone → Enable
 *    Twilio / MessageBird / Vonage / Textlocal 중 SMS 공급자 선택 후
 *    Account SID · Auth Token · Message Service SID 또는 From Number 등록.
 *    (개발 중에는 Twilio Trial Account로 인증된 번호만 수신 가능)
 */

// "010-1234-5678" / "01012345678" / "+8210..." → E.164 "+8210..."
function toE164KR(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("82")) return "+" + digits;
  if (digits.startsWith("0")) return "+82" + digits.slice(1);
  return "+82" + digits;
}

// 자동 포맷 010-1234-5678
function formatKRPhone(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

const RESEND_COOLDOWN_SEC = 60;

export function LoginPage() {
  const [showEmail, setShowEmail] = useState(false);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // 재전송 타이머
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const handleSendCode = async () => {
    const e164 = toE164KR(phone);
    if (!e164 || e164.length < 13) {
      toast.error("올바른 휴대폰 번호를 입력해주세요");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: e164,
        options: { channel: "sms" },
      });
      if (error) throw error;
      toast.success("인증번호를 전송했습니다");
      trackEvent("otp_requested", { channel: "sms" });
      setStep("otp");
      setResendIn(RESEND_COOLDOWN_SEC);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "인증번호 전송 실패";
      if (msg.includes("rate limit") || msg.includes("Too many")) {
        toast.error("잠시 후 다시 시도해주세요 (요청 제한)");
      } else if (msg.toLowerCase().includes("phone provider")) {
        toast.error("SMS 서비스가 설정되지 않았습니다", {
          description: "Supabase Authentication > Providers > Phone을 활성화해주세요.",
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    const e164 = toE164KR(phone);
    if (!e164) {
      toast.error("전화번호가 유효하지 않습니다");
      return;
    }
    if (token.length !== 6) {
      toast.error("6자리 인증번호를 입력해주세요");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: e164,
        token,
        type: "sms",
      });
      if (error) throw error;
      if (data?.user?.id) identifyUser(data.user.id);
      toast.success("로그인 성공!");
      trackEvent("sign_in", { method: "phone_otp" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "인증 실패";
      if (msg.includes("Invalid") || msg.includes("expired")) {
        toast.error("인증번호가 올바르지 않거나 만료되었습니다");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setToken("");
    await handleSendCode();
  };

  const handleChangeNumber = () => {
    setStep("phone");
    setToken("");
    setResendIn(0);
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
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
        <div
          className="w-20 h-20 rounded-3xl p-1 mb-6"
          style={{
            background: "linear-gradient(135deg, #237FFF, #AB5EBE)",
            boxShadow: "0 0 32px rgba(35,127,255,0.35)",
          }}
        >
          <div className="w-full h-full rounded-[1.25rem] bg-background flex items-center justify-center">
            <span
              className="headline-font font-black text-3xl text-glow"
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

      {/* 인증 카드 */}
      <div className="w-full max-w-sm space-y-4">
        {step === "phone" ? (
          <div className="glass-card-glow p-5 space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                <Phone className="w-3.5 h-3.5" /> 휴대폰 번호
              </label>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="010-1234-5678"
                value={phone}
                onChange={(e) => setPhone(formatKRPhone(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleSendCode()}
                className="w-full h-12 rounded-xl bg-background/60 border border-white/10 px-4 text-foreground text-base tracking-wide placeholder-muted-foreground focus-visible:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <p className="text-[11px] text-muted-foreground pt-0.5">
                SMS로 6자리 인증번호를 보내드립니다
              </p>
            </div>
            <button
              onClick={handleSendCode}
              disabled={loading || phone.replace(/\D/g, "").length < 10}
              className="btn-power w-full text-[15px] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  인증번호 받기
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="glass-card-glow p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[11px] text-muted-foreground">인증번호 전송됨</p>
                <p className="text-sm font-semibold text-foreground">{phone}</p>
              </div>
              <button
                onClick={handleChangeNumber}
                className="text-[11px] text-primary hover:underline"
              >
                번호 변경
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> 인증번호 (6자리)
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleVerify()}
                className="w-full h-14 rounded-xl bg-background/60 border border-white/10 px-4 text-foreground text-2xl font-bold tracking-[0.4em] text-center placeholder-muted-foreground focus-visible:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-muted-foreground">
                  문자메시지를 확인해주세요
                </p>
                <button
                  onClick={handleResend}
                  disabled={resendIn > 0 || loading}
                  className="text-[11px] text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  {resendIn > 0 ? `재전송 (${resendIn}s)` : "재전송"}
                </button>
              </div>
            </div>
            <button
              onClick={handleVerify}
              disabled={loading || token.length !== 6}
              className="btn-power w-full text-[15px] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  인증하고 로그인
                </>
              )}
            </button>
          </div>
        )}

        {/* 이메일 로그인 대체 링크 */}
        <button
          onClick={() => setShowEmail(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Mail className="w-3.5 h-3.5" />
          이메일로 가입 / 로그인
        </button>

        {/* 약관 고지 */}
        <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
          계속 진행하면 <span className="underline">이용약관</span>과{" "}
          <span className="underline">개인정보처리방침</span>에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;

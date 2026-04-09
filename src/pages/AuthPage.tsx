import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Eye, EyeOff, Mail } from "lucide-react";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [oauthEnabled, setOauthEnabled] = useState<{ kakao: boolean; google: boolean }>({ kakao: false, google: false });

  useEffect(() => {
    fetch(`${import.meta.env.VITE_SUPABASE_URL || "https://stnpepxiysfoblfeqvpu.supabase.co"}/auth/v1/settings`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "" },
    })
      .then((r) => r.json())
      .then((s) => setOauthEnabled({ kakao: !!s?.external?.kakao, google: !!s?.external?.google }))
      .catch(() => {});
  }, []);

  const handleEmailAuth = async () => {
    if (!email || !password) { toast.error("이메일과 비밀번호를 입력해주세요"); return; }
    if (mode === "signup" && !termsAgreed) { toast.error("이용약관에 동의해주세요"); return; }
    if (password.length < 6) { toast.error("비밀번호는 6자 이상이어야 합니다"); return; }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { full_name: name },
          },
        });
        if (error) throw error;
        // mailer_autoconfirm=true이면 세션이 즉시 반환됨
        if (data.session) {
          toast.success("가입 완료! 자동 로그인됩니다.");
        } else {
          // 혹시 세션이 없으면 수동 로그인 시도
          const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
          if (loginErr) throw loginErr;
          toast.success("가입 완료! 로그인되었습니다.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("로그인 성공!");
      }
    } catch (e: any) {
      const msg = e.message || "인증 오류";
      if (msg.includes("Invalid login")) {
        toast.error("이메일 또는 비밀번호가 올바르지 않습니다");
      } else if (msg.includes("already registered") || msg.includes("already exists")) {
        toast.error("이미 가입된 이메일입니다. 로그인해주세요.");
        setMode("login");
      } else if (msg.includes("rate limit")) {
        toast.error("잠시 후 다시 시도해주세요 (요청 제한)");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) { toast.error("이메일을 입력해주세요"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success("비밀번호 재설정 링크를 이메일로 보냈습니다");
    } catch (e: any) {
      toast.error(e.message || "재설정 메일 발송 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    setLoading(true);
    try {
      const settingsRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } },
      );
      const settings = await settingsRes.json();

      if (!settings?.external?.kakao) {
        toast.error("카카오 로그인이 준비 중입니다. 이메일로 로그인해주세요.");
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo: window.location.origin },
      });
      if (error) toast.error("카카오 로그인에 실패했습니다");
    } catch {
      toast.error("카카오 로그인 오류");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // Supabase Auth 설정에서 Google 활성화 여부 확인
      const settingsRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } },
      );
      const settings = await settingsRes.json();

      if (!settings?.external?.google) {
        toast.error("구글 로그인이 준비 중입니다. 이메일로 로그인해주세요.");
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) toast.error("구글 로그인에 실패했습니다");
    } catch {
      toast.error("구글 로그인 오류");
    } finally {
      setLoading(false);
    }
  };

  if (showTerms) {
    return (
      <div className="min-h-screen bg-[#0A0F1E] p-6">
        <button onClick={() => setShowTerms(false)} className="text-[#ADC6FF] mb-4 text-sm font-medium">← 돌아가기</button>
        <h1 className="text-xl font-bold mb-4 text-[#DEE1F7]">이용약관</h1>
        <div className="space-y-4 text-sm text-[#8B90A0] leading-relaxed">
          <section><h2 className="font-semibold text-[#DEE1F7] mb-1">1. 서비스 목적</h2><p>본 서비스는 콘텐츠 생성 및 일정 관리 기능을 제공합니다.</p></section>
          <section><h2 className="font-semibold text-[#DEE1F7] mb-1">2. 개인정보 수집</h2><p>이메일, 이름, 일정 정보 등 서비스 제공에 필요한 정보를 수집합니다.</p></section>
          <section><h2 className="font-semibold text-[#DEE1F7] mb-1">3. 데이터 활용</h2><p>사용자가 입력한 데이터는 서비스 기능 제공에만 사용됩니다.</p></section>
          <section><h2 className="font-semibold text-[#DEE1F7] mb-1">4. 외부 연동</h2><p>구글 캘린더 연동 시 사용자 동의 하에 데이터가 전송됩니다.</p></section>
          <section><h2 className="font-semibold text-[#DEE1F7] mb-1">5. 책임 제한</h2><p>서비스 사용으로 발생한 손해에 대해 책임이 제한됩니다.</p></section>
          <section><h2 className="font-semibold text-[#DEE1F7] mb-1">6. 서비스 변경</h2><p>기능은 사전 공지 없이 변경될 수 있습니다.</p></section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3"
          style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
          <span className="text-3xl font-black text-white">S</span>
        </div>
        <h1 className="text-2xl font-black" style={{ background: "linear-gradient(90deg,#237FFF,#AB5EBE)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>SMS</h1>
        <p className="text-xs text-[#8B90A0] mt-1 tracking-widest">셀프마케팅서비스</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {/* Kakao Login — 활성화된 경우만 표시 */}
        {oauthEnabled.kakao && (
          <button onClick={handleKakaoLogin} disabled={loading}
            className="w-full h-12 rounded-xl text-[#191600] text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
            style={{ backgroundColor: "#FEE500" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.61 1.74 4.9 4.36 6.22l-1.1 4.07c-.09.33.28.6.56.41l4.84-3.21c.44.04.88.07 1.34.07 5.52 0 10-3.36 10-7.56S17.52 3 12 3z" fill="#3C1E1E"/></svg>
            카카오로 계속하기
          </button>
        )}

        {/* Google Login — 활성화된 경우만 표시 */}
        {oauthEnabled.google && (
          <button onClick={handleGoogleLogin} disabled={loading}
            className="w-full h-12 rounded-xl bg-[#2F3445] text-[#DEE1F7] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#25293A] active:scale-[0.98] transition-all disabled:opacity-50"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            구글로 계속하기
          </button>
        )}

        {/* 소셜 로그인이 하나라도 있으면 구분선 표시 */}
        {(oauthEnabled.kakao || oauthEnabled.google) && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#414754]" />
            <span className="text-xs text-[#8B90A0]">또는</span>
            <div className="flex-1 h-px bg-[#414754]" />
          </div>
        )}

        {/* Email Form */}
        {mode === "signup" && (
          <input placeholder="이름" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full h-11 rounded-xl bg-[#1A1F2F] px-4 text-[#DEE1F7] placeholder-[#8B90A0] text-sm focus:outline-none focus:ring-1 focus:ring-[#ADC6FF]/40"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
        )}
        <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full h-11 rounded-xl bg-[#1A1F2F] px-4 text-[#DEE1F7] placeholder-[#8B90A0] text-sm focus:outline-none focus:ring-1 focus:ring-[#ADC6FF]/40"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
        <div className="relative">
          <input type={showPw ? "text" : "password"} placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 rounded-xl bg-[#1A1F2F] px-4 pr-10 text-[#DEE1F7] placeholder-[#8B90A0] text-sm focus:outline-none focus:ring-1 focus:ring-[#ADC6FF]/40"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B90A0]">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {mode === "signup" && (
          <div className="flex items-start gap-2">
            <Checkbox id="terms" checked={termsAgreed} onCheckedChange={(v) => setTermsAgreed(!!v)} className="mt-0.5 border-white/10 data-[state=checked]:bg-[#4C8EFF] data-[state=checked]:border-[#4C8EFF]" />
            <label htmlFor="terms" className="text-xs text-[#8B90A0]">
              <button type="button" onClick={() => setShowTerms(true)} className="text-[#ADC6FF] underline">이용약관</button>에 동의합니다 (필수)
            </label>
          </div>
        )}

        {mode === "reset" ? (
          <>
            {resetSent ? (
              <div className="bg-[#4AE176]/10 border border-[#4AE176]/30 rounded-xl p-4 text-center space-y-2">
                <span className="text-3xl">✉️</span>
                <p className="text-sm font-semibold text-[#4AE176]">재설정 링크를 보냈습니다</p>
                <p className="text-xs text-[#8B90A0]">{email} 메일함을 확인해주세요</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-[#8B90A0] text-center">가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다</p>
                <input type="email" placeholder="가입한 이메일" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 rounded-xl bg-[#1A1F2F] px-4 text-[#DEE1F7] placeholder-[#8B90A0] text-sm focus:outline-none focus:ring-1 focus:ring-[#ADC6FF]/40"
                  style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
                <button onClick={handleResetPassword} disabled={loading}
                  className="w-full h-11 rounded-xl text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
                  재설정 링크 보내기
                </button>
              </>
            )}
            <p className="text-center text-sm text-[#8B90A0]">
              <button onClick={() => { setMode("login"); setResetSent(false); }} className="text-[#ADC6FF] font-medium">← 로그인으로 돌아가기</button>
            </p>
          </>
        ) : (
          <>
            <button onClick={handleEmailAuth} disabled={loading}
              className="w-full h-11 rounded-xl text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
              <Mail className="w-4 h-4" />
              {mode === "login" ? "로그인" : "회원가입"}
            </button>

            {mode === "login" && (
              <button onClick={() => setMode("reset")} className="w-full text-center text-xs text-[#8B90A0] hover:text-[#ADC6FF] transition-colors">
                비밀번호를 잊으셨나요?
              </button>
            )}

            <p className="text-center text-sm text-[#8B90A0]">
              {mode === "login" ? "계정이 없으신가요?" : "이미 계정이 있으신가요?"}{" "}
              <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-[#ADC6FF] font-medium">
                {mode === "login" ? "회원가입" : "로그인"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

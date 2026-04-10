import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

  const handleEmailAuth = async () => {
    if (!email || !password) { toast.error("이메일과 비밀번호를 입력해주세요"); return; }
    if (mode === "signup" && !termsAgreed) { toast.error("이용약관에 동의해주세요"); return; }
    if (password.length < 6) { toast.error("비밀번호는 6자 이상이어야 합니다"); return; }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("가입 완료! 자동 로그인됩니다.");
        } else if (data.user && data.user.identities?.length === 0) {
          toast.error("이미 가입된 이메일입니다. 로그인해주세요.");
          setMode("login");
          return;
        } else {
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
        redirectTo: `${window.location.origin}${window.location.pathname}#/reset-password`,
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

  if (showTerms) {
    return (
      <div className="min-h-screen bg-background p-6">
        <button onClick={() => setShowTerms(false)} className="text-primary mb-4 text-sm font-medium">← 돌아가기</button>
        <h1 className="text-xl font-bold mb-4 text-foreground">이용약관</h1>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <section><h2 className="font-semibold text-foreground mb-1">1. 서비스 목적</h2><p>본 서비스는 콘텐츠 생성 및 일정 관리 기능을 제공합니다.</p></section>
          <section><h2 className="font-semibold text-foreground mb-1">2. 개인정보 수집</h2><p>이메일, 이름, 일정 정보 등 서비스 제공에 필요한 정보를 수집합니다.</p></section>
          <section><h2 className="font-semibold text-foreground mb-1">3. 데이터 활용</h2><p>사용자가 입력한 데이터는 서비스 기능 제공에만 사용됩니다.</p></section>
          <section><h2 className="font-semibold text-foreground mb-1">4. 외부 연동</h2><p>구글 캘린더 연동 시 사용자 동의 하에 데이터가 전송됩니다.</p></section>
          <section><h2 className="font-semibold text-foreground mb-1">5. 책임 제한</h2><p>서비스 사용으로 발생한 손해에 대해 책임이 제한됩니다.</p></section>
          <section><h2 className="font-semibold text-foreground mb-1">6. 서비스 변경</h2><p>기능은 사전 공지 없이 변경될 수 있습니다.</p></section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3"
          style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
          <span className="text-3xl font-black text-white">S</span>
        </div>
        <h1 className="text-2xl font-black" style={{ background: "linear-gradient(90deg,#237FFF,#AB5EBE)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>SMS</h1>
        <p className="text-xs text-muted-foreground mt-1 tracking-widest">셀프마케팅서비스</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {mode === "signup" && (
          <input placeholder="이름" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full h-11 rounded-xl bg-card px-4 text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 border border-border" />
        )}
        <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full h-11 rounded-xl bg-card px-4 text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 border border-border" />
        <div className="relative">
          <input type={showPw ? "text" : "password"} placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 rounded-xl bg-card px-4 pr-10 text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 border border-border" />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {mode === "signup" && (
          <div className="flex items-start gap-2">
            <Checkbox id="terms" checked={termsAgreed} onCheckedChange={(v) => setTermsAgreed(!!v)}
              className="mt-0.5 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
            <label htmlFor="terms" className="text-xs text-muted-foreground">
              <button type="button" onClick={() => setShowTerms(true)} className="text-primary underline">이용약관</button>에 동의합니다 (필수)
            </label>
          </div>
        )}

        {mode === "reset" ? (
          <>
            {resetSent ? (
              <div className="bg-success/10 border border-success/30 rounded-xl p-4 text-center space-y-2">
                <p className="text-sm font-semibold text-success">재설정 링크를 보냈습니다</p>
                <p className="text-xs text-muted-foreground">{email} 메일함을 확인해주세요</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground text-center">가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다</p>
                <input type="email" placeholder="가입한 이메일" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 rounded-xl bg-card px-4 text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 border border-border" />
                <button onClick={handleResetPassword} disabled={loading}
                  className="w-full h-11 rounded-xl text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
                  재설정 링크 보내기
                </button>
              </>
            )}
            <p className="text-center text-sm text-muted-foreground">
              <button onClick={() => { setMode("login"); setResetSent(false); }} className="text-primary font-medium">← 로그인으로 돌아가기</button>
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
              <button onClick={() => setMode("reset")} className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors">
                비밀번호를 잊으셨나요?
              </button>
            )}

            <p className="text-center text-sm text-muted-foreground">
              {mode === "login" ? "계정이 없으신가요?" : "이미 계정이 있으신가요?"}{" "}
              <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary font-medium">
                {mode === "login" ? "회원가입" : "로그인"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

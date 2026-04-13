import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase가 리다이렉트 시 자동으로 세션을 설정함
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });
    // 이미 세션이 있으면 바로 진행
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });
  }, []);

  const handleReset = async () => {
    if (!password || !confirm) {
      toast.error("비밀번호를 입력해주세요");
      return;
    }
    if (password.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다");
      return;
    }
    if (password !== confirm) {
      toast.error("비밀번호가 일치하지 않습니다");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("비밀번호가 변경되었습니다!");
    } catch (e: any) {
      toast.error(e.message || "비밀번호 변경 실패");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-xl font-bold text-foreground">비밀번호 변경 완료</h1>
          <p className="text-sm text-muted-foreground">새 비밀번호로 로그인할 수 있습니다.</p>
          <button
            onClick={() => { window.location.hash = "#/"; }}
            className="w-full h-11 rounded-xl text-white font-semibold active:scale-[0.98] transition-all"
            style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
            앱으로 이동
          </button>
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
        <h1 className="text-xl font-bold text-foreground">새 비밀번호 설정</h1>
        <p className="text-sm text-muted-foreground mt-1">새로운 비밀번호를 입력해주세요</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {!sessionReady && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 text-center">
            <p className="text-xs text-warning font-medium">이메일의 재설정 링크를 통해 접속해주세요</p>
          </div>
        )}

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type={showPw ? "text" : "password"}
            placeholder="새 비밀번호 (6자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 rounded-xl bg-card pl-10 pr-10 text-foreground placeholder-muted-foreground text-sm focus-visible:outline-none focus:ring-1 focus:ring-primary/40 border border-border"
          />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type={showPw ? "text" : "password"}
            placeholder="새 비밀번호 확인"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleReset()}
            className="w-full h-11 rounded-xl bg-card pl-10 pr-4 text-foreground placeholder-muted-foreground text-sm focus-visible:outline-none focus:ring-1 focus:ring-primary/40 border border-border"
          />
        </div>

        {/* 비밀번호 강도 표시 */}
        {password && (
          <div className="flex gap-1">
            {[1, 2, 3].map((level) => (
              <div key={level} className={`flex-1 h-1 rounded-full ${
                password.length >= level * 4
                  ? level === 3 ? "bg-success" : level === 2 ? "bg-warning" : "bg-destructive"
                  : "bg-secondary"
              }`} />
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              {password.length < 6 ? "너무 짧음" : password.length < 8 ? "보통" : "강함"}
            </span>
          </div>
        )}

        <button
          onClick={handleReset}
          disabled={loading || !sessionReady}
          className="w-full h-11 rounded-xl text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
          {loading ? "변경 중..." : "비밀번호 변경"}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          <button onClick={() => { window.location.hash = "#/"; }} className="text-primary font-medium">← 로그인으로 돌아가기</button>
        </p>
      </div>
    </div>
  );
}

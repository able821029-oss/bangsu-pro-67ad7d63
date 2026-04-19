import { useEffect, useState } from "react";
import { Shield, ArrowLeft, AlertTriangle, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminDashboard } from "./AdminDashboard";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

type AdminState =
  | { status: "loading" }
  | { status: "logged_out" }
  | { status: "not_admin" }
  | { status: "admin" }
  | { status: "error"; message: string };

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<AdminState>({ status: "loading" });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ status: "logged_out" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setState({ status: "error", message: error.message });
          return;
        }
        setState({ status: data?.is_admin === true ? "admin" : "not_admin" });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "관리자 확인 중 오류";
        setState({ status: "error", message: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const handleBackToApp = () => {
    window.location.hash = "";
    window.location.reload();
  };

  if (state.status === "admin") {
    return <AdminDashboard onLogout={handleBackToApp} />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative">
      <button
        onClick={handleBackToApp}
        className="absolute top-4 left-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> 앱으로 돌아가기
      </button>

      <div className="w-full max-w-sm glass-card p-6 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">관리자 페이지</h1>
        </div>

        {state.status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">권한 확인 중...</p>
          </div>
        )}

        {state.status === "logged_out" && (
          <div className="space-y-3 text-center">
            <div className="flex flex-col items-center gap-2 py-3">
              <LogIn className="w-6 h-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">먼저 로그인해주세요</p>
            </div>
            <Button className="w-full" onClick={handleBackToApp}>
              로그인 페이지로
            </Button>
          </div>
        )}

        {state.status === "not_admin" && (
          <div className="space-y-3 text-center">
            <div className="flex flex-col items-center gap-2 py-3">
              <AlertTriangle className="w-6 h-6 text-destructive" />
              <p className="text-sm text-foreground font-semibold">관리자 권한이 없습니다</p>
              <p className="text-xs text-muted-foreground">
                현재 계정에는 관리자 권한이 부여되지 않았습니다.
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={handleBackToApp}>
              앱으로 돌아가기
            </Button>
          </div>
        )}

        {state.status === "error" && (
          <div className="space-y-3 text-center">
            <div className="flex flex-col items-center gap-2 py-3">
              <AlertTriangle className="w-6 h-6 text-destructive" />
              <p className="text-sm text-foreground font-semibold">권한 확인 실패</p>
              <p className="text-xs text-muted-foreground break-words">{state.message}</p>
            </div>
            <Button className="w-full" onClick={() => window.location.reload()}>
              다시 시도
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

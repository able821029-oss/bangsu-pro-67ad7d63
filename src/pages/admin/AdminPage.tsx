import { useState } from "react";
import { Shield, Lock, User, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminDashboard } from "./AdminDashboard";
import { getAdminPassword, getAdminId } from "./sections/AdminPasswordChange";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [adminId, setAdminIdInput] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (!adminId || !password) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    if (adminId === getAdminId() && password === getAdminPassword()) {
      setAuthenticated(true);
      setError("");
    } else {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
  };

  const handleBackToApp = () => {
    window.location.hash = "";
    window.location.reload();
  };

  if (authenticated) {
    return <AdminDashboard onLogout={() => setAuthenticated(false)} />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative">
      <button
        onClick={handleBackToApp}
        className="absolute top-4 left-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> 앱으로 돌아가기
      </button>

      <div className="w-full max-w-sm bg-card rounded-xl border border-border p-6 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">관리자 로그인</h1>
          <p className="text-sm text-muted-foreground">관리자 계정으로 로그인하세요</p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              autoComplete="username"
              className="w-full bg-secondary rounded-lg pl-10 pr-3 py-3 text-sm outline-none text-foreground"
              placeholder="관리자 아이디"
              value={adminId}
              onChange={(e) => setAdminIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="password"
              autoComplete="current-password"
              className="w-full bg-secondary rounded-lg pl-10 pr-3 py-3 text-sm outline-none text-foreground"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button className="w-full" onClick={handleLogin}>로그인</Button>
          <p className="text-xs text-center text-muted-foreground pt-2">
            기본 계정: <span className="font-mono text-foreground">admin</span> / <span className="font-mono text-foreground">1234</span>
          </p>
        </div>
      </div>
    </div>
  );
}

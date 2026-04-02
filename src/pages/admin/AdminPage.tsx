import { useState } from "react";
import { Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminDashboard } from "./AdminDashboard";

const ADMIN_PASSWORD = "bangsu2026!";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setError("");
    } else {
      setError("비밀번호가 올바르지 않습니다.");
    }
  };

  if (authenticated) {
    return <AdminDashboard onLogout={() => setAuthenticated(false)} />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-card rounded-xl border border-border p-6 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">관리자 로그인</h1>
          <p className="text-sm text-muted-foreground">관리자 비밀번호를 입력하세요</p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="password"
              className="w-full bg-secondary rounded-lg pl-10 pr-3 py-3 text-sm outline-none text-foreground"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button className="w-full" onClick={handleLogin}>로그인</Button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Shield, Lock, User, ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminDashboard } from "./AdminDashboard";
import { getAdminPassword, getAdminId, isAdminConfigured } from "./sections/AdminPasswordChange";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;
const ATTEMPT_KEY = "sms_admin_lockout";

type LockoutState = { count: number; lockedUntil: number };

function readLockout(): LockoutState {
  try {
    const raw = localStorage.getItem(ATTEMPT_KEY);
    if (!raw) return { count: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw) as LockoutState;
    return { count: parsed.count || 0, lockedUntil: parsed.lockedUntil || 0 };
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

function writeLockout(state: LockoutState) {
  localStorage.setItem(ATTEMPT_KEY, JSON.stringify(state));
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [adminId, setAdminIdInput] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [remainingSec, setRemainingSec] = useState(0);

  const configured = isAdminConfigured();

  useEffect(() => {
    const tick = () => {
      const { lockedUntil } = readLockout();
      const diff = Math.max(0, lockedUntil - Date.now());
      setRemainingSec(Math.ceil(diff / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogin = () => {
    const now = Date.now();
    const state = readLockout();
    if (state.lockedUntil > now) {
      setError(`잠시 후 다시 시도해 주세요. (${Math.ceil((state.lockedUntil - now) / 1000)}초)`);
      return;
    }
    if (!configured) {
      setError("관리자 자격증명이 설정되지 않았습니다. 배포 환경변수(VITE_ADMIN_ID / VITE_ADMIN_PW)를 설정해 주세요.");
      return;
    }
    if (!adminId || !password) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    if (adminId === getAdminId() && password === getAdminPassword()) {
      writeLockout({ count: 0, lockedUntil: 0 });
      setAuthenticated(true);
      setError("");
      return;
    }
    const nextCount = state.count + 1;
    if (nextCount >= MAX_ATTEMPTS) {
      const until = now + LOCKOUT_MS;
      writeLockout({ count: 0, lockedUntil: until });
      setError(`로그인 ${MAX_ATTEMPTS}회 실패. ${LOCKOUT_MS / 1000}초 후 다시 시도해 주세요.`);
    } else {
      writeLockout({ count: nextCount, lockedUntil: 0 });
      setError(`아이디 또는 비밀번호가 올바르지 않습니다. (${MAX_ATTEMPTS - nextCount}회 남음)`);
    }
    setPassword("");
  };

  const handleBackToApp = () => {
    window.location.hash = "";
    window.location.reload();
  };

  if (authenticated) {
    return <AdminDashboard onLogout={() => setAuthenticated(false)} />;
  }

  const locked = remainingSec > 0;

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

        {!configured && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>관리자 자격증명이 설정되지 않았습니다.</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              autoComplete="username"
              disabled={locked}
              className="w-full bg-secondary rounded-lg pl-10 pr-3 py-3 text-sm outline-none text-foreground disabled:opacity-50"
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
              disabled={locked}
              className="w-full bg-secondary rounded-lg pl-10 pr-3 py-3 text-sm outline-none text-foreground disabled:opacity-50"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button className="w-full" onClick={handleLogin} disabled={locked}>
            {locked ? `${remainingSec}초 후 재시도` : "로그인"}
          </Button>
        </div>
      </div>
    </div>
  );
}

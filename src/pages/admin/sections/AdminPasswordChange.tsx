import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Check } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "sms_admin_password";
const DEFAULT_PASSWORD = "bangsu2026!";

export function getAdminPassword(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_PASSWORD;
}

export function AdminPasswordChange() {
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");

  const handleChange = () => {
    const savedPw = getAdminPassword();

    if (!current || !newPw || !confirm) {
      toast.error("모든 항목을 입력해주세요");
      return;
    }
    if (current !== savedPw) {
      toast.error("현재 비밀번호가 올바르지 않습니다");
      return;
    }
    if (newPw.length < 6) {
      toast.error("새 비밀번호는 6자 이상이어야 합니다");
      return;
    }
    if (newPw !== confirm) {
      toast.error("새 비밀번호가 일치하지 않습니다");
      return;
    }

    localStorage.setItem(STORAGE_KEY, newPw);
    setCurrent("");
    setNewPw("");
    setConfirm("");
    toast.success("비밀번호가 변경되었습니다");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary" /> 관리자 비밀번호 변경
        </h2>
        <p className="text-sm text-muted-foreground mt-1">관리자 페이지 접근 비밀번호를 변경합니다.</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 space-y-4 max-w-md">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">현재 비밀번호</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm outline-none text-foreground"
            placeholder="현재 비밀번호 입력"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">새 비밀번호</label>
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm outline-none text-foreground"
            placeholder="6자 이상"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">새 비밀번호 확인</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleChange()}
            className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm outline-none text-foreground"
            placeholder="새 비밀번호 다시 입력"
          />
        </div>
        <Button className="w-full" onClick={handleChange}>
          <Check className="w-4 h-4 mr-1" /> 비밀번호 변경
        </Button>
      </div>
    </div>
  );
}

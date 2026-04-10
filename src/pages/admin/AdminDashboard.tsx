import { useState } from "react";
import {
  Key, Users, Bot, LogOut, CreditCard, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminApiKeys } from "./sections/AdminApiKeys";
import { AdminPersonas } from "./sections/AdminPersonas";
import { AdminPlans } from "./sections/AdminPlans";
import { AdminUsers } from "./sections/AdminUsers";
import { AdminPasswordChange } from "./sections/AdminPasswordChange";

type AdminSection = "api" | "personas" | "plans" | "users" | "password";

const sections: { id: AdminSection; label: string; icon: React.ElementType }[] = [
  { id: "api", label: "API 키", icon: Key },
  { id: "personas", label: "페르소나", icon: Bot },
  { id: "plans", label: "요금제", icon: CreditCard },
  { id: "users", label: "가입자", icon: Users },
  { id: "password", label: "비밀번호 변경", icon: Lock },
];

export function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [active, setActive] = useState<AdminSection>("api");

  const renderSection = () => {
    switch (active) {
      case "api": return <AdminApiKeys />;
      case "personas": return <AdminPersonas />;
      case "plans": return <AdminPlans />;
      case "users": return <AdminUsers />;
      case "password": return <AdminPasswordChange />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="font-bold text-lg">관리자 대시보드</h1>
        <Button variant="ghost" size="sm" onClick={onLogout}>
          <LogOut className="w-4 h-4 mr-1" /> 로그아웃
        </Button>
      </div>

      <div className="bg-card border-b border-border px-2 overflow-x-auto">
        <div className="flex gap-1 min-w-max py-2">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active === s.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        {renderSection()}
      </div>
    </div>
  );
}

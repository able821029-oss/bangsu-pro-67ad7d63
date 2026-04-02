import { useState } from "react";
import {
  Key, MessageSquare, Users, Ticket, TrendingDown,
  CreditCard, Bot, LogOut, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminApiKeys } from "./sections/AdminApiKeys";
import { AdminPersonas } from "./sections/AdminPersonas";
import { AdminPlans } from "./sections/AdminPlans";
import { AdminCoupons } from "./sections/AdminCoupons";
import { AdminReferrals } from "./sections/AdminReferrals";
import { AdminUsers } from "./sections/AdminUsers";
import { AdminInquiries } from "./sections/AdminInquiries";
import { AdminChurn } from "./sections/AdminChurn";

type AdminSection = "api" | "personas" | "plans" | "coupons" | "referrals" | "users" | "inquiries" | "churn";

const sections: { id: AdminSection; label: string; icon: React.ElementType }[] = [
  { id: "api", label: "API 키", icon: Key },
  { id: "personas", label: "페르소나", icon: Bot },
  { id: "plans", label: "요금제", icon: CreditCard },
  { id: "coupons", label: "쿠폰", icon: Ticket },
  { id: "referrals", label: "레퍼럴", icon: BarChart3 },
  { id: "users", label: "가입자", icon: Users },
  { id: "inquiries", label: "문의", icon: MessageSquare },
  { id: "churn", label: "이탈 통계", icon: TrendingDown },
];

export function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [active, setActive] = useState<AdminSection>("api");

  const renderSection = () => {
    switch (active) {
      case "api": return <AdminApiKeys />;
      case "personas": return <AdminPersonas />;
      case "plans": return <AdminPlans />;
      case "coupons": return <AdminCoupons />;
      case "referrals": return <AdminReferrals />;
      case "users": return <AdminUsers />;
      case "inquiries": return <AdminInquiries />;
      case "churn": return <AdminChurn />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="font-bold text-lg">🛠 관리자 대시보드</h1>
        <Button variant="ghost" size="sm" onClick={onLogout}>
          <LogOut className="w-4 h-4" /> 로그아웃
        </Button>
      </div>

      {/* Tab scrollable */}
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

      {/* Content */}
      <div className="p-4 max-w-4xl mx-auto">
        {renderSection()}
      </div>
    </div>
  );
}

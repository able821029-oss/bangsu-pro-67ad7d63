import { useState } from "react";
import {
  User, CreditCard, Users, HelpCircle, MessageSquare, Bell,
  ChevronRight, LogOut, Hammer, Smile, Building2,
} from "lucide-react";
import { ProfileSettings } from "@/pages/settings/ProfileSettings";
import { PricingPlan } from "@/pages/settings/PricingPlan";
import { CouponPage } from "@/pages/settings/CouponPage";
import { ReferralPage } from "@/pages/settings/ReferralPage";
import { FaqPage } from "@/pages/settings/FaqPage";
import { ContactPage } from "@/pages/settings/ContactPage";
import { AnnouncementsPage } from "@/pages/settings/AnnouncementsPage";
import { SeoTab } from "@/pages/SeoTab";
import { FieldToolsPage } from "@/pages/FieldToolsPage";
import { HardHat } from "lucide-react";
import { useAppStore, Persona } from "@/stores/appStore";
import { TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SettingsPage = "menu" | "profile" | "pricing" | "seo" | "fieldtools" | "coupon" | "referral" | "faq" | "contact" | "announcements";

const personas: { id: Persona; label: string; icon: React.ElementType }[] = [
  { id: "장인형", label: "장인형", icon: Hammer },
  { id: "친근형", label: "친근형", icon: Smile },
  { id: "전문기업형", label: "전문기업형", icon: Building2 },
];

const myInfoItems: { id: SettingsPage; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "업체명 · 전화번호 · 지역", icon: User },
];

const appSettingsItems: { id: SettingsPage; label: string; icon: React.ElementType }[] = [
  { id: "pricing", label: "요금제 · 영상 현황", icon: CreditCard },
  { id: "fieldtools", label: "현장 도우미 (일당·날씨·임금체불)", icon: HardHat },
  { id: "seo", label: "블로그 상위노출 관리", icon: TrendingUp },
  { id: "referral", label: "지인 소개 (첫달 50% 할인)", icon: Users },
  { id: "faq", label: "자주 묻는 질문", icon: HelpCircle },
  { id: "contact", label: "문의하기", icon: MessageSquare },
  { id: "announcements", label: "공지사항", icon: Bell },
];

export function SettingsTab() {
  const [page, setPage] = useState<SettingsPage>(() => {
    const pending = sessionStorage.getItem("sms-open-settings-page") as SettingsPage | null;
    if (pending) {
      sessionStorage.removeItem("sms-open-settings-page");
      return pending;
    }
    return "menu";
  });
  const { selectedPersona, setSelectedPersona } = useAppStore();
  const { toast } = useToast();

  if (page !== "menu") {

    if (page === "fieldtools") {
      return <FieldToolsPage onBack={() => setPage("menu")} />;
    }

    if (page === "seo") {
      return (
        <div className="relative">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
            <button onClick={() => setPage("menu")} className="p-2 -ml-2 rounded-lg hover:bg-secondary">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">블로그 상위노출 관리</h1>
          </div>
          <SeoTab onNavigate={() => setPage("menu")} />
        </div>
      );
    }
    const PageComponent2: Record<string, React.FC<{ onBack: () => void }>> = {
      profile: ProfileSettings,
      pricing: PricingPlan,
      coupon: CouponPage,
      referral: ReferralPage,
      faq: FaqPage,
      contact: ContactPage,
      announcements: AnnouncementsPage,
    };
    const Component = PageComponent2[page];
    return Component ? <Component onBack={() => setPage("menu")} /> : null;
  }

  const renderGroup = (title: string, items: typeof myInfoItems) => (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground px-1">{title}</p>
      <div className="glass-card overflow-hidden">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] ${
                i < items.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <Icon className="w-5 h-5 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <User className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">설정</h1>
      </div>

      {renderGroup("내 정보", myInfoItems)}

      {/* Default Persona */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground px-1">기본 페르소나</p>
        <div className="glass-card p-4">
          <div className="flex gap-2">
            {personas.map((p) => {
              const PIcon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPersona(p.id);
                    toast({ title: `기본 페르소나: ${p.label}` });
                  }}
                  className={`flex-1 text-center py-2 rounded-lg text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                    selectedPersona === p.id
                      ? "bg-primary/10 text-primary border-2 border-primary"
                      : "bg-secondary text-muted-foreground border-2 border-transparent"
                  }`}
                >
                  <PIcon className="w-4 h-4" />
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">촬영 탭에서 기본 선택됩니다</p>
        </div>
      </div>

      {renderGroup("앱 설정", appSettingsItems)}

      {/* Logout */}
      <button
        onClick={() => toast({ title: "로그아웃", description: "앱을 재시작하면 다시 로그인할 수 있습니다." })}
        className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-destructive font-medium rounded-xl border border-border hover:bg-destructive/5 transition-colors">
        <LogOut className="w-5 h-5" />
        로그아웃
      </button>

      <div className="flex flex-col items-center gap-2 mt-6">
        <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
          <defs>
            <linearGradient id="setSg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#237FFF"/>
              <stop offset="100%" stopColor="#AB5EBE"/>
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="16" fill="url(#setSg)"/>
          <text x="8" y="52" fontFamily="Arial Black, Helvetica Neue, sans-serif" fontWeight="900" fontSize="52" fill="#FFFFFF">S</text>
        </svg>
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-black text-base" style={{ background: "linear-gradient(90deg, #237FFF, #AB5EBE)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>SMS</span>
          <span className="text-[9px] font-semibold text-muted-foreground tracking-widest uppercase">셀프마케팅서비스</span>
          <p className="text-[10px] text-muted-foreground mt-1">v1.0</p>
        </div>
      </div>
    </div>
  );
}

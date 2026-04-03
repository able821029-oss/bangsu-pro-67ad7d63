import { useState } from "react";
import {
  User, CreditCard, Ticket, Users, HelpCircle, MessageSquare, Bell,
  ChevronRight, LogOut, Hammer, Smile, Building2,
} from "lucide-react";
import { ProfileSettings } from "@/pages/settings/ProfileSettings";
import { PricingPlan } from "@/pages/settings/PricingPlan";
import { CouponPage } from "@/pages/settings/CouponPage";
import { ReferralPage } from "@/pages/settings/ReferralPage";
import { FaqPage } from "@/pages/settings/FaqPage";
import { ContactPage } from "@/pages/settings/ContactPage";
import { AnnouncementsPage } from "@/pages/settings/AnnouncementsPage";
import { useAppStore, Persona } from "@/stores/appStore";
import { useToast } from "@/hooks/use-toast";

type SettingsPage = "menu" | "profile" | "pricing" | "coupon" | "referral" | "faq" | "contact" | "announcements";

const personas: { id: Persona; label: string; icon: React.ElementType }[] = [
  { id: "장인형", label: "장인형", icon: Hammer },
  { id: "친근형", label: "친근형", icon: Smile },
  { id: "전문기업형", label: "전문기업형", icon: Building2 },
];

const myInfoItems: { id: SettingsPage; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "업체명 · 전화번호 · 지역", icon: User },
];

const appSettingsItems: { id: SettingsPage; label: string; icon: React.ElementType }[] = [
  { id: "pricing", label: "요금제 확인", icon: CreditCard },
  { id: "coupon", label: "쿠폰·혜택", icon: Ticket },
  { id: "referral", label: "지인 소개", icon: Users },
  { id: "faq", label: "자주 묻는 질문", icon: HelpCircle },
  { id: "contact", label: "문의하기", icon: MessageSquare },
  { id: "announcements", label: "공지사항", icon: Bell },
];

export function SettingsTab() {
  const [page, setPage] = useState<SettingsPage>("menu");
  const { selectedPersona, setSelectedPersona } = useAppStore();
  const { toast } = useToast();

  if (page !== "menu") {
    const PageComponent: Record<string, React.FC<{ onBack: () => void }>> = {
      profile: ProfileSettings,
      pricing: PricingPlan,
      coupon: CouponPage,
      referral: ReferralPage,
      faq: FaqPage,
      contact: ContactPage,
      announcements: AnnouncementsPage,
    };
    const Component = PageComponent[page];
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
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-destructive font-medium rounded-xl border border-border hover:bg-destructive/5 transition-colors">
        <LogOut className="w-5 h-5" />
        로그아웃
      </button>

      <div className="flex flex-col items-center gap-2 mt-6">
        <svg width="40" height="40" viewBox="0 0 64 64" fill="none">
          <rect width="64" height="64" rx="16" fill="#001130"/>
          <defs>
            <linearGradient id="setSg" x1="14" y1="10" x2="50" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#237FFF"/>
              <stop offset="52%" stopColor="#6C5CE7"/>
              <stop offset="100%" stopColor="#AB5EBE"/>
            </linearGradient>
          </defs>
          <text x="8" y="52" fontFamily="Arial Black, Helvetica Neue, sans-serif" fontWeight="900" fontSize="52" fill="url(#setSg)">S</text>
        </svg>
        <p className="text-xs text-muted-foreground">SMS v1.0 | Self Marketing Service</p>
      </div>
    </div>
  );
}

import { useState } from "react";
import {
  User, CreditCard, Ticket, Users, HelpCircle, MessageSquare, Bell,
  ChevronRight, LogOut, Link2,
} from "lucide-react";
import { ProfileSettings } from "@/pages/settings/ProfileSettings";
import { PricingPlan } from "@/pages/settings/PricingPlan";
import { CouponPage } from "@/pages/settings/CouponPage";
import { ReferralPage } from "@/pages/settings/ReferralPage";
import { FaqPage } from "@/pages/settings/FaqPage";
import { ContactPage } from "@/pages/settings/ContactPage";
import { AnnouncementsPage } from "@/pages/settings/AnnouncementsPage";

type SettingsPage = "menu" | "profile" | "pricing" | "coupon" | "referral" | "faq" | "contact" | "announcements";

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
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-secondary ${
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
      <h1 className="text-xl font-bold">⚙️ 설정</h1>

      {renderGroup("내 정보", myInfoItems)}
      {renderGroup("앱 설정", appSettingsItems)}

      {/* Logout */}
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-destructive font-medium rounded-xl border border-border hover:bg-destructive/5 transition-colors">
        <LogOut className="w-5 h-5" />
        로그아웃
      </button>

      <p className="text-center text-xs text-muted-foreground mt-6">SMS v1.0 | Self Marketing Service</p>
    </div>
  );
}

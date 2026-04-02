import { useState } from "react";
import {
  User, CreditCard, Ticket, Users, HelpCircle, MessageSquare, Bell,
  ChevronRight, ArrowLeft,
} from "lucide-react";
import { ProfileSettings } from "@/pages/settings/ProfileSettings";
import { PricingPlan } from "@/pages/settings/PricingPlan";
import { CouponPage } from "@/pages/settings/CouponPage";
import { ReferralPage } from "@/pages/settings/ReferralPage";
import { FaqPage } from "@/pages/settings/FaqPage";
import { ContactPage } from "@/pages/settings/ContactPage";
import { AnnouncementsPage } from "@/pages/settings/AnnouncementsPage";

type SettingsPage = "menu" | "profile" | "pricing" | "coupon" | "referral" | "faq" | "contact" | "announcements";

const menuItems: { id: SettingsPage; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "프로필 설정", icon: User },
  { id: "pricing", label: "요금제·결제", icon: CreditCard },
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

  return (
    <div className="px-4 pt-6 pb-24 space-y-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold">⚙️ 설정</h1>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {menuItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-secondary ${
                i < menuItems.length - 1 ? "border-b border-border" : ""
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
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  User, LogOut, Crown, FileText, Settings,
  ChevronRight, Star, Download, MessageSquare, Phone, Hammer, Shield,
  Calendar as CalendarIcon,
} from "lucide-react";
import { IconChip, type ChipColor } from "@/components/IconChip";
import { useAppStore } from "@/stores/appStore";
import { PricingPlan } from "@/pages/settings/PricingPlan";
import { ProfileSettings } from "@/pages/settings/ProfileSettings";
import { TermsPage } from "@/pages/settings/TermsPage";
import { PrivacyPage } from "@/pages/settings/PrivacyPage";
import { UserSettings } from "@/pages/settings/UserSettings";
import { ReviewsPage } from "@/pages/ReviewsPage";
import { FieldToolsPage } from "@/pages/FieldToolsPage";
import { FaqPage } from "@/pages/settings/FaqPage";
import { ContactPage } from "@/pages/settings/ContactPage";
import { DeleteAccountModal } from "@/components/DeleteAccountModal";
import { ShortsLibrary } from "@/components/ShortsLibrary";
import { Film } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const openPricing = (from: string, setPage: (p: "pricing") => void) => {
  trackEvent("upgrade_cta_clicked", { from });
  setPage("pricing");
};

type Page = "main" | "pricing" | "profile" | "terms" | "privacy" | "usersettings" | "reviews" | "fieldtools" | "faq" | "contact";

export function MyPage() {
  const { user, signOut } = useAuth();
  const subscription = useAppStore(s => s.subscription);
  const settings = useAppStore(s => s.settings);
  const shortsCount = useAppStore(s => s.shortsVideos.length);
  const [name, setName] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [page, setPage] = useState<Page>(() => {
    const pending = sessionStorage.getItem("sms-open-settings-page") as Page | null;
    if (pending) { sessionStorage.removeItem("sms-open-settings-page"); return pending; }
    return "main";
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("name").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) { setName(data.name || ""); }
      });
  }, [user]);

  // 하위 페이지 렌더링
  if (page === "pricing") return <PricingPlan onBack={() => setPage("main")} />;
  if (page === "profile") return <ProfileSettings onBack={() => setPage("main")} />;
  if (page === "terms") return <TermsPage onBack={() => setPage("main")} />;
  if (page === "privacy") return <PrivacyPage onBack={() => setPage("main")} />;
  if (page === "usersettings") return <UserSettings onBack={() => setPage("main")} />;
  if (page === "reviews") return <ReviewsPage onBack={() => setPage("main")} />;
  if (page === "fieldtools") return <FieldToolsPage onBack={() => setPage("main")} />;
  if (page === "faq") return <FaqPage onBack={() => setPage("main")} />;
  if (page === "contact") return <ContactPage onBack={() => setPage("main")} />;

  const planColor = subscription.plan === "무제한" ? "#F97316"
    : subscription.plan === "프로" ? "#AB5EBE"
    : subscription.plan === "베이직" ? "#237FFF"
    : "#888";

  const usedPct = Math.min(100, Math.round((subscription.usedCount / subscription.maxCount) * 100));
  const videoPct = Math.min(100, Math.round(((subscription.videoUsed || 0) / (subscription.maxVideo || 1)) * 100));

  const menuItems: Array<{
    icon: typeof Hammer;
    label: string;
    desc: string;
    color: ChipColor;
    onClick: () => void;
  }> = [
    { icon: Hammer, label: "현장 도우미", desc: "일당·날씨·임금체불", color: "orange", onClick: () => setPage("fieldtools") },
    { icon: Crown, label: "요금제 변경", desc: subscription.plan, color: "amber", onClick: () => openPricing("mypage_menu", setPage) },
    { icon: User, label: "업체 정보 설정", desc: settings.companyName || "미설정", color: "blue", onClick: () => setPage("profile") },
    { icon: Settings, label: "앱 설정", desc: "알림·언어·개인정보", color: "slate", onClick: () => setPage("usersettings") },
    { icon: Star, label: "사용자 리뷰", desc: "실제 사장님들의 후기", color: "purple", onClick: () => setPage("reviews") },
    { icon: FileText, label: "이용약관", desc: "", color: "indigo", onClick: () => setPage("terms") },
    { icon: Shield, label: "개인정보처리방침", desc: "정보 수집·이용·위탁", color: "slate", onClick: () => setPage("privacy") },
    { icon: MessageSquare, label: "자주 묻는 질문", desc: "FAQ", color: "green", onClick: () => setPage("faq") },
    { icon: Phone, label: "문의하기", desc: "관리자에게 메시지", color: "cyan", onClick: () => setPage("contact") },
    { icon: Shield, label: "관리자 모드", desc: "", color: "rose", onClick: () => { window.location.hash = "#/admin"; } },
  ];

  return (
    <div className="pb-28 min-h-screen bg-background">
      {/* 헤더 */}
      <div className="px-5 pt-6 pb-2">
        <h1 className="text-xl font-bold text-foreground">마이페이지</h1>
      </div>

      {/* 프로필 카드 — 글래스 카드 글로우 */}
      <div className="mx-5 mb-5">
        <button
          onClick={() => setPage("profile")}
          className="w-full text-left relative overflow-hidden glass-card-glow p-6 transition-all active:scale-[0.99]"
          aria-label="업체 정보 설정으로 이동"
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl" style={{ background: "rgba(76,142,255,0.18)" }} />
          <div className="absolute top-4 right-4 text-primary/70">
            <ChevronRight className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full p-0.5" style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
              <div className="w-full h-full rounded-full bg-background flex items-center justify-center text-2xl font-bold text-white">
                {name ? name[0] : "😊"}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-foreground">{name || user?.email?.split("@")[0] || "사장님"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="mt-4 inline-flex items-center px-3 py-1 bg-[#4C8EFF]/20 rounded-full" style={{ border: "1px solid rgba(76,142,255,0.35)" }}>
            <span className="text-xs font-bold text-primary">{subscription.plan} 플랜</span>
          </div>
        </button>
      </div>

      {/* 사용량 — 큰 숫자 + 글로우 바 */}
      <div className="mx-5 mb-5 glass-card p-5 space-y-5">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-foreground">이번 달 사용량</h3>
          <span className="text-[10px] text-muted-foreground">{subscription.plan} 플랜</span>
        </div>
        {/* 블로그 */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <IconChip icon={FileText} color="blue" size="sm" />
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">블로그 발행</span>
                <span className="stat-number text-lg">
                  {subscription.usedCount}<span className="stat-unit text-xs ml-0.5">/ {subscription.maxCount}건</span>
                </span>
              </div>
            </div>
          </div>
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${usedPct}%`,
                background: "linear-gradient(90deg,#237FFF,#4C8EFF,#AB5EBE)",
                boxShadow: "0 0 10px rgba(35,127,255,0.5)",
              }}
            />
          </div>
        </div>
        {/* 영상 */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <IconChip icon={Download} color="purple" size="sm" />
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">영상 콘텐츠 제작</span>
                <span className="stat-number text-lg">
                  {subscription.videoUsed || 0}<span className="stat-unit text-xs ml-0.5">/ {subscription.maxVideo || 1}개</span>
                </span>
              </div>
            </div>
          </div>
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${videoPct}%`,
                background: videoPct > 0 ? "linear-gradient(90deg,#AB5EBE,#F97316)" : "#414754",
                boxShadow: videoPct > 0 ? "0 0 10px rgba(171,94,190,0.5)" : undefined,
              }}
            />
          </div>
        </div>
        <button onClick={() => openPricing("mypage_cta", setPage)} className="btn-power w-full">
          플랜 업그레이드
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 내 쇼츠 보관함 */}
      <div className="mx-5 mb-5 space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Film className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">내 쇼츠 영상 ({shortsCount})</h2>
        </div>
        <ShortsLibrary />
      </div>

      {/* 구글 캘린더 */}
      <div className="mx-5 mb-5">
        <div className="glass-card p-4 flex items-center gap-3">
          <IconChip icon={CalendarIcon} color="cyan" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              구글 캘린더 연동
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${googleConnected ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-secondary text-muted-foreground"}`}>
                {googleConnected ? "연동됨" : "미연동"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {googleConnected ? "일정이 구글 캘린더에 자동 동기화됩니다" : "일정 탭 → 구글 내보내기로 연동하세요"}
            </p>
          </div>
        </div>
      </div>

      {/* 메뉴 리스트 — 컬러 아이콘 칩 */}
      <div className="mx-5 mb-5 glass-card p-2 space-y-1">
        {menuItems.map(({ icon, label, desc, color, onClick }, i) => (
          <button key={i} onClick={onClick}
            className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group">
            <div className="flex items-center gap-3">
              <IconChip icon={icon} color={color} size="sm" />
              <span className="font-medium text-[#DEE1F7]">{label}</span>
            </div>
            <div className="flex items-center gap-2">
              {desc && <span className="text-xs text-muted-foreground">{desc}</span>}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>

      {/* 로그아웃 */}
      <div className="mx-5">
        <button onClick={async () => { await signOut(); toast.success("로그아웃 되었습니다"); }}
          className="w-full h-[52px] rounded-full text-sm font-bold text-[#FFB4AB] flex items-center justify-center gap-2 hover:bg-[#FFB4AB]/5 active:scale-95 transition-all"
          style={{ border: "1px solid rgba(255,180,171,0.3)" }}>
          <LogOut className="w-4 h-4" /> 로그아웃
        </button>
      </div>

      {/* 회원 탈퇴 — 빨간색 텍스트 버튼 */}
      <div className="mx-5 pt-2">
        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full py-3 text-xs font-medium text-red-500/80 hover:text-red-500 transition-colors"
        >
          회원 탈퇴
        </button>
      </div>

      {/* 회원 탈퇴 확인 모달 */}
      {showDeleteModal && (
        <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />
      )}
    </div>
  );
}

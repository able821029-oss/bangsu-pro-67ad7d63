import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  User, LogOut, Crown, FileText, Settings,
  ChevronRight, Star, Download, MessageSquare, Phone, Hammer
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { PricingPlan } from "@/pages/settings/PricingPlan";
import { ProfileSettings } from "@/pages/settings/ProfileSettings";
import { TermsPage } from "@/pages/settings/TermsPage";
import { UserSettings } from "@/pages/settings/UserSettings";
import { ReviewsPage } from "@/pages/ReviewsPage";
import { FieldToolsPage } from "@/pages/FieldToolsPage";

type Page = "main" | "pricing" | "profile" | "terms" | "usersettings" | "reviews" | "fieldtools";

export function MyPage() {
  const { user, signOut } = useAuth();
  const subscription = useAppStore(s => s.subscription);
  const settings = useAppStore(s => s.settings);
  const [name, setName] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [page, setPage] = useState<Page>(() => {
    const pending = sessionStorage.getItem("sms-open-settings-page") as Page | null;
    if (pending) { sessionStorage.removeItem("sms-open-settings-page"); return pending; }
    return "main";
  });

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
  if (page === "usersettings") return <UserSettings onBack={() => setPage("main")} />;
  if (page === "reviews") return <ReviewsPage onBack={() => setPage("main")} />;
  if (page === "fieldtools") return <FieldToolsPage onBack={() => setPage("main")} />;

  const planColor = subscription.plan === "무제한" ? "#F97316"
    : subscription.plan === "프로" ? "#AB5EBE"
    : subscription.plan === "베이직" ? "#237FFF"
    : "#888";

  const usedPct = Math.min(100, Math.round((subscription.usedCount / subscription.maxCount) * 100));
  const videoPct = Math.min(100, Math.round(((subscription.videoUsed || 0) / (subscription.maxVideo || 1)) * 100));

  const menuItems = [
    {
      icon: Hammer, label: "현장 도우미", desc: "일당·날씨·임금체불",
      onClick: () => setPage("fieldtools"),
    },
    {
      icon: Crown, label: "요금제 변경", desc: subscription.plan,
      onClick: () => setPage("pricing"),
      accent: planColor,
    },
    {
      icon: Settings, label: "업체 정보 설정", desc: settings.companyName || "미설정",
      onClick: () => setPage("profile"),
    },
    {
      icon: Settings, label: "앱 설정", desc: "알림·언어·개인정보",
      onClick: () => setPage("usersettings"),
    },
    {
      icon: Star, label: "사용자 리뷰", desc: "실제 사장님들의 후기",
      onClick: () => setPage("reviews"),
    },
    {
      icon: FileText, label: "이용약관", desc: "",
      onClick: () => setPage("terms"),
    },
    {
      icon: Phone, label: "고객센터", desc: "카카오 채널",
      onClick: () => window.open("https://pf.kakao.com", "_blank"),
    },
  ];

  return (
    <div className="pb-28 min-h-screen bg-[#0E1322]">
      {/* 헤더 */}
      <div className="px-5 pt-6 pb-2">
        <h1 className="text-xl font-bold text-[#DEE1F7]">마이페이지</h1>
      </div>

      {/* 프로필 카드 — glass-card */}
      <div className="mx-5 mb-5">
        <div className="relative overflow-hidden rounded-2xl p-6"
          style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl" style={{ background: "rgba(173,198,255,0.1)" }} />
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full p-0.5" style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
              <div className="w-full h-full rounded-full bg-[#0E1322] flex items-center justify-center text-2xl font-bold text-white">
                {name ? name[0] : "😊"}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-[#DEE1F7]">{name || user?.email?.split("@")[0] || "사장님"}</p>
              <p className="text-sm text-[#8B90A0]">{user?.email}</p>
            </div>
          </div>
          <div className="mt-4 inline-flex items-center px-3 py-1 bg-[#4C8EFF]/20 rounded-full" style={{ border: "1px solid rgba(76,142,255,0.3)" }}>
            <span className="text-xs font-bold text-[#ADC6FF]">{subscription.plan} 플랜</span>
          </div>
        </div>
      </div>

      {/* 사용량 */}
      <div className="mx-5 mb-5 space-y-6">
        <div className="flex justify-between items-end">
          <h3 className="text-lg font-bold text-[#DEE1F7]">이번달 사용량</h3>
        </div>
        <div className="space-y-5">
          {/* 블로그 프로그레스 */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-bold">
              <span className="text-[#C1C6D7]">블로그 발행</span>
              <span className="text-[#DEE1F7]">
                {subscription.usedCount}/{subscription.maxCount}건
                <span className="text-[#ADC6FF] ml-1">({usedPct}%)</span>
              </span>
            </div>
            <div className="h-2 w-full bg-[#1A1F2F] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${usedPct}%`, background: "linear-gradient(90deg,#237FFF,#AB5EBE)" }} />
            </div>
          </div>
          {/* 영상 프로그레스 */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-bold">
              <span className="text-[#C1C6D7]">영상 콘텐츠 제작</span>
              <span className="text-[#DEE1F7]">
                {subscription.videoUsed || 0}/{subscription.maxVideo || 1}개
                <span className="text-[#8B90A0] ml-1">({videoPct}%)</span>
              </span>
            </div>
            <div className="h-2 w-full bg-[#1A1F2F] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${videoPct}%`, background: videoPct > 0 ? "linear-gradient(90deg,#AB5EBE,#F97316)" : "#414754" }} />
            </div>
          </div>
          {/* 업그레이드 CTA */}
          <button onClick={() => setPage("pricing")}
            className="w-full h-[52px] rounded-full flex items-center justify-center gap-2 text-white font-bold text-lg shadow-xl active:scale-[0.98] transition-transform mt-4"
            style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
            플랜 업그레이드
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 구글 캘린더 */}
      <div className="mx-5 mb-5">
        <div className="bg-[#1A1F2F] rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#C1C6D7] flex items-center gap-2">
                📅 구글 캘린더 연동
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${googleConnected ? "bg-green-500/10 text-green-500" : "bg-[#2F3445] text-[#8B90A0]"}`}>
                  {googleConnected ? "연동됨" : "미연동"}
                </span>
              </p>
              <p className="text-xs text-[#8B90A0] mt-0.5">
                {googleConnected ? "일정이 구글 캘린더에 자동 동기화됩니다" : "일정 탭 → 구글 내보내기로 연동하세요"}
              </p>
            </div>
            <Download className="w-4 h-4 text-[#8B90A0]" />
          </div>
        </div>
      </div>

      {/* 메뉴 리스트 */}
      <div className="mx-5 mb-5 bg-[#161B2B] rounded-2xl p-2 space-y-1">
        {menuItems.map(({ icon: Icon, label, desc, onClick }, i) => (
          <button key={i} onClick={onClick}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-xl transition-colors group">
            <div className="flex items-center gap-4">
              <Icon className="w-5 h-5 text-[#8B90A0] group-hover:text-[#ADC6FF]" />
              <span className="font-medium text-[#C1C6D7] group-hover:text-[#DEE1F7]">{label}</span>
            </div>
            <div className="flex items-center gap-2">
              {desc && <span className="text-xs text-[#8B90A0]">{desc}</span>}
              <ChevronRight className="w-4 h-4 text-[#8B90A0]" />
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
    </div>
  );
}

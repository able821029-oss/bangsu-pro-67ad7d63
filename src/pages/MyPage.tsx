import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  User, LogOut, Crown, FileText, Settings,
  ChevronRight, Star, Download, MessageSquare, Phone
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { PricingPlan } from "@/pages/settings/PricingPlan";
import { ProfileSettings } from "@/pages/settings/ProfileSettings";
import { TermsPage } from "@/pages/settings/TermsPage";
import { UserSettings } from "@/pages/settings/UserSettings";
import { ReviewsPage } from "@/pages/ReviewsPage";

type Page = "main" | "pricing" | "profile" | "terms" | "usersettings" | "reviews";

export function MyPage() {
  const { user, signOut } = useAuth();
  const subscription = useAppStore(s => s.subscription);
  const settings = useAppStore(s => s.settings);
  const [name, setName] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [page, setPage] = useState<Page>("main");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("name, google_refresh_token").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) { setName(data.name || ""); setGoogleConnected(!!data.google_refresh_token); }
      });
  }, [user]);

  // 하위 페이지 렌더링
  if (page === "pricing") return <PricingPlan onBack={() => setPage("main")} />;
  if (page === "profile") return <ProfileSettings onBack={() => setPage("main")} />;
  if (page === "terms") return <TermsPage onBack={() => setPage("main")} />;
  if (page === "usersettings") return <UserSettings onBack={() => setPage("main")} />;
  if (page === "reviews") return <ReviewsPage onBack={() => setPage("main")} />;

  const planColor = subscription.plan === "무제한" ? "#F97316"
    : subscription.plan === "프로" ? "#AB5EBE"
    : subscription.plan === "베이직" ? "#237FFF"
    : "#888";

  const usedPct = Math.min(100, Math.round((subscription.usedCount / subscription.maxCount) * 100));
  const videoPct = Math.min(100, Math.round(((subscription.videoUsed || 0) / (subscription.maxVideo || 1)) * 100));

  const menuItems = [
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
    <div className="pb-28 min-h-screen bg-background">
      {/* 헤더 */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold">마이페이지</h1>
      </div>

      {/* 프로필 카드 */}
      <div className="mx-4 mb-3">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-black"
              style={{ background: "linear-gradient(135deg,rgba(35,127,255,0.15),rgba(171,94,190,0.15))" }}>
              {name ? name[0] : "😊"}
            </div>
            <div className="flex-1">
              <p className="font-bold">{name || user?.email?.split("@")[0] || "사장님"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block"
                style={{ background: `${planColor}20`, color: planColor }}>
                {subscription.plan} 플랜
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 사용량 */}
      <div className="mx-4 mb-3">
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">이번달 사용량</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">블로그 글</span>
              <span className="font-semibold">{subscription.usedCount} / {subscription.maxCount}건</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div className="h-2 rounded-full transition-all" style={{ width: `${usedPct}%`, background: "linear-gradient(90deg,#237FFF,#AB5EBE)" }} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">쇼츠 영상</span>
              <span className="font-semibold">{subscription.videoUsed || 0} / {subscription.maxVideo || 1}개</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div className="h-2 rounded-full transition-all" style={{ width: `${videoPct}%`, background: "linear-gradient(90deg,#AB5EBE,#F97316)" }} />
            </div>
          </div>
          <button onClick={() => setPage("pricing")}
            className="w-full py-2 rounded-xl text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
            플랜 업그레이드 →
          </button>
        </div>
      </div>

      {/* 구글 캘린더 */}
      <div className="mx-4 mb-3">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium flex items-center gap-2">
                📅 구글 캘린더 연동
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${googleConnected ? "bg-green-500/10 text-green-500" : "bg-secondary text-muted-foreground"}`}>
                  {googleConnected ? "연동됨" : "미연동"}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {googleConnected ? "일정이 구글 캘린더에 자동 동기화됩니다" : "일정 탭 → 구글 내보내기로 연동하세요"}
              </p>
            </div>
            <Download className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* 메뉴 */}
      <div className="mx-4 mb-4 bg-card border border-border rounded-2xl overflow-hidden">
        {menuItems.map(({ icon: Icon, label, desc, onClick, accent }, i) => (
          <button key={i} onClick={onClick}
            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: accent ? `${accent}15` : "hsl(var(--secondary))" }}>
                <Icon className="w-4 h-4" style={{ color: accent || "hsl(var(--muted-foreground))" }} />
              </div>
              <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {desc && <span className="text-xs text-muted-foreground">{desc}</span>}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>

      {/* 로그아웃 */}
      <div className="mx-4">
        <button onClick={async () => { await signOut(); toast.success("로그아웃 되었습니다"); }}
          className="w-full py-3 rounded-xl text-sm font-semibold text-destructive border border-destructive/30 hover:bg-destructive/5 transition-colors flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" /> 로그아웃
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { NotificationPanel, type NotificationItem } from "@/components/NotificationPanel";
import {
  Camera,
  Bell,
  AlertTriangle,
  ChevronRight,
  PenLine,
  Upload,
  Film,
  Flame,
  Gauge,
  Sparkles,
  Hammer,
  FileText,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconChip } from "@/components/IconChip";
import { useAppStore, PostStatus, BlogPost } from "@/stores/appStore";
import type { TabId } from "@/components/BottomNav";

const statusBadgeVariant: Record<PostStatus, "default" | "info" | "success"> = {
  작성중: "default",
  AI생성중: "default",
  완료: "info",
  게시완료: "success",
};

const medalInfo: Record<number, { label: string; reward: string; color: string; bg: string; border: string; icon: string }> = {
  1: { label: "브론즈", reward: "", color: "#CD7F32", bg: "rgba(205,127,50,0.12)", border: "rgba(205,127,50,0.4)", icon: "🥉" },
  3: { label: "실버",   reward: "20% 할인쿠폰 자동 지급!", color: "#A8A9AD", bg: "rgba(168,169,173,0.12)", border: "rgba(168,169,173,0.4)", icon: "🥈" },
  6: { label: "골드",   reward: "1개월 무료 자동 지급!", color: "#FFD700", bg: "rgba(255,215,0,0.12)", border: "rgba(255,215,0,0.4)", icon: "🥇" },
};

function getMedalTier(months: number) {
  if (months >= 6) return 6;
  if (months >= 3) return 3;
  if (months >= 1) return 1;
  return 0;
}

function getNextTier(months: number) {
  if (months >= 6) return null;
  if (months >= 3) return { target: 6, remaining: 6 - months };
  if (months >= 1) return { target: 3, remaining: 3 - months };
  return { target: 1, remaining: 1 };
}

const allTiers = [
  { label: "브론즈", range: "1~2개월", reward: "", color: "#CD7F32", bg: "rgba(205,127,50,0.12)", border: "rgba(205,127,50,0.35)", icon: "🥉" },
  { label: "실버",   range: "3~5개월", reward: "다음달 20% 할인 쿠폰 자동 지급", color: "#A8A9AD", bg: "rgba(168,169,173,0.12)", border: "rgba(168,169,173,0.35)", icon: "🥈" },
  { label: "골드",   range: "6개월 이상", reward: "1개월 무료 자동 지급", color: "#FFD700", bg: "rgba(255,215,0,0.12)", border: "rgba(255,215,0,0.35)", icon: "🥇" },
];

// weeklyData는 컴포넌트 안에서 posts로 계산 (아래 참조)

export function HomeTab({
  onNavigate,
  onViewPost,
}: {
  onNavigate: (tab: TabId) => void;
  onViewPost: (post: BlogPost) => void;
}) {
  const posts = useAppStore((s) => s.posts);
  const settings = useAppStore((s) => s.settings);
  const subscription = useAppStore((s) => s.subscription);
  const published = posts.filter((p) => p.status === "게시완료").length;
  const completed = posts.filter((p) => p.status === "완료" || p.status === "게시완료").length;
  const videoCount = subscription.videoUsed ?? 0;

  // 실제 주간 발행 데이터 계산
  const weeklyData = (() => {
    const now = new Date();
    return [3, 2, 1, 0].map((weeksAgo) => {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() - weeksAgo * 7);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
      const count = posts.filter((p) => {
        const d = new Date(p.createdAt);
        return d >= weekStart && d <= weekEnd && (p.status === "완료" || p.status === "게시완료");
      }).length;
      return { week: `${4 - weeksAgo}주차`, count };
    });
  })();

  const usagePercent = subscription.maxCount > 0 ? (subscription.usedCount / subscription.maxCount) * 100 : 0;
  const remaining = subscription.maxCount - subscription.usedCount;

  const tier = getMedalTier(subscription.consecutiveMonths);
  const medal = tier > 0 ? medalInfo[tier] : null;
  const nextTier = getNextTier(subscription.consecutiveMonths);
  const [showBadgeSheet, setShowBadgeSheet] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifications: NotificationItem[] = [];

  const currentTierLabel = tier >= 6 ? "골드" : tier >= 3 ? "실버" : tier >= 1 ? "브론즈" : "";

  const progressColor = usagePercent >= 100 ? "#EF4444" : usagePercent >= 80 ? "#F97316" : "#237FFF";

  const seoScore = 74;
  const seoDonutData = [{ value: seoScore }, { value: 100 - seoScore }];

  const naverCount = posts.filter(
    (p) => p.platforms.includes("naver") && (p.status === "완료" || p.status === "게시완료"),
  ).length;
  const instaCount = posts.filter(
    (p) => p.platforms.includes("instagram") && (p.status === "완료" || p.status === "게시완료"),
  ).length;
  const tiktokCount = posts.filter(
    (p) => p.platforms.includes("tiktok") && (p.status === "완료" || p.status === "게시완료"),
  ).length;

  return (
    <div className="px-5 pt-6 pb-28 space-y-5 max-w-lg mx-auto">
      {/* Header — 아바타 + 인사말 + 알림 */}
      <header className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full p-0.5 bg-brand-gradient shrink-0">
          <div className="w-full h-full rounded-full bg-background overflow-hidden flex items-center justify-center">
            <span className="text-xl">👷</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-foreground truncate">
            안녕하세요, {settings.companyName ? `${settings.companyName}` : "사장님"}
          </p>
          <p className="text-xs text-muted-foreground">
            이번 달 <span className="text-primary font-semibold">{completed}건</span>의 글을 작성했어요
          </p>
        </div>
        <div className="relative">
          <button
            aria-label="알림"
            aria-expanded={showNotifications}
            aria-haspopup="dialog"
            onClick={() => setShowNotifications((v) => !v)}
            className="icon-chip relative"
          >
            <Bell size={20} strokeWidth={2} color="#237FFF" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] text-white font-bold flex items-center justify-center">
                {notifications.length}
              </span>
            )}
          </button>
          <NotificationPanel
            open={showNotifications}
            items={notifications}
            onClose={() => setShowNotifications(false)}
            anchor="right"
          />
        </div>
      </header>

      {/* Amber Warning Banner */}
      {!settings.companyName && (
        <button
          onClick={() => onNavigate("mypage")}
          aria-label="경고: 업체 정보를 먼저 입력해 주세요"
          className="w-full p-4 rounded-2xl flex justify-between items-center"
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))",
            border: "1px solid rgba(245,158,11,0.35)",
            boxShadow: "0 0 20px rgba(245,158,11,0.10)",
          }}
        >
          <div className="flex items-center gap-3">
            <IconChip icon={AlertTriangle} color="amber" size="sm" />
            <p className="text-amber-300 font-bold text-sm">업체 정보를 먼저 입력해 주세요</p>
          </div>
          <ChevronRight size={18} strokeWidth={2.2} className="text-amber-400" />
        </button>
      )}

      {/* Flagship Usage Card — 에너지 대시보드 스타일 (큰 숫자 + 듀얼 스탯) */}
      <section className="glass-card-glow p-5 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#C1C6D7]">이번 달 블로그 사용량</span>
          <span className="bg-[#4C8EFF]/20 text-[#4C8EFF] px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide border border-[#4C8EFF]/30">
            {subscription.plan} 플랜
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="stat-number text-5xl text-primary text-glow">{subscription.usedCount}</span>
            <span className="stat-unit text-base">/ {subscription.maxCount}건</span>
          </div>
          <p className="text-xs text-muted-foreground">
            남은 사용량 <span className="font-semibold text-foreground">{Math.max(remaining, 0)}건</span>
          </p>
        </div>
        {/* 글로우 바 */}
        <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(usagePercent, 100)}%`,
              background: "linear-gradient(90deg, #237FFF 0%, #4C8EFF 50%, #AB5EBE 100%)",
              boxShadow: "0 0 12px rgba(35,127,255,0.6), 0 0 4px rgba(171,94,190,0.4)",
            }}
          />
        </div>
        {/* 듀얼 스탯 — 완료된 글 / 이번달 영상 */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="flex items-center gap-3">
            <IconChip icon={FileText} color="blue" />
            <div>
              <p className="stat-number text-xl">{completed}건</p>
              <p className="text-[11px] stat-unit">완료된 글</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <IconChip icon={Film} color="purple" />
            <div>
              <p className="stat-number text-xl">{videoCount}개</p>
              <p className="text-[11px] stat-unit">이번달 영상</p>
            </div>
          </div>
        </div>
      </section>

      {/* Power CTA — 강화된 글로우 */}
      <button
        onClick={() => onNavigate("content")}
        className="btn-power w-full text-base"
      >
        <Camera className="w-5 h-5" strokeWidth={2.2} />
        <span>지금 바로 글 작성하기</span>
      </button>

      {/* 현장 도우미 바로가기 */}
      <button
        onClick={() => {
          sessionStorage.setItem("sms-open-settings-page", "fieldtools");
          onNavigate("mypage");
        }}
        className="w-full glass-card flex items-center gap-3 px-4 py-3"
      >
        <IconChip icon={Hammer} color="orange" />
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold">현장 도우미</p>
          <p className="text-xs text-muted-foreground">일당 계산 · 날씨 판단 · 임금체불 신고</p>
        </div>
        <ChevronRight size={16} className="text-primary" />
      </button>

      {/* Stats Grid — 컬러 아이콘 칩 + 큰 숫자 (픽토그램 레퍼런스) */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate("publish")}
          className="glass-card p-4 flex flex-col gap-2 text-left w-full min-h-[120px]"
        >
          <IconChip icon={PenLine} color="blue" />
          <div className="mt-auto">
            <p className="stat-number text-2xl">{completed}<span className="stat-unit text-base ml-1">건</span></p>
            <p className="text-[11px] text-muted-foreground mt-1">블로그 작성</p>
          </div>
        </button>
        <button
          onClick={() => onNavigate("publish")}
          className="glass-card p-4 flex flex-col gap-2 text-left w-full min-h-[120px]"
        >
          <IconChip icon={Upload} color="green" />
          <div className="mt-auto">
            <p className="stat-number text-2xl">{published}<span className="stat-unit text-base ml-1">건</span></p>
            <p className="text-[11px] text-muted-foreground mt-1">게시 완료</p>
          </div>
        </button>
        <button
          onClick={() => onNavigate("shorts")}
          className="glass-card p-4 flex flex-col gap-2 text-left w-full min-h-[120px]"
        >
          <IconChip icon={Film} color="purple" />
          <div className="mt-auto">
            <p className="stat-number text-2xl">{videoCount}<span className="stat-unit text-base ml-1">개</span></p>
            <p className="text-[11px] text-muted-foreground mt-1">이번 달 영상</p>
          </div>
        </button>
        <button
          onClick={() => setShowBadgeSheet(true)}
          className="glass-card p-4 flex flex-col gap-2 text-left w-full min-h-[120px]"
        >
          <IconChip icon={Flame} color="orange" />
          <div className="mt-auto">
            <p className="stat-number text-2xl">{subscription.consecutiveMonths}<span className="stat-unit text-base ml-1">개월</span></p>
            <p className="text-[11px] text-muted-foreground mt-1">연속 사용</p>
          </div>
        </button>
      </div>

      {/* Weekly Bar Chart */}
      <div className="chart-card p-4 space-y-3" role="img" aria-label="최근 4주 발행 현황 차트">
        <p className="text-sm font-semibold text-foreground">최근 4주 발행 현황</p>
        <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(215 16% 47%)" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(215 16% 47%)" }} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
                color: "hsl(var(--foreground))",
              }}
            />
            <Bar dataKey="count" fill="#237FFF" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </div>

      {/* SEO Donut + Platform Bars */}
      <div className="grid grid-cols-2 gap-3">
        {/* SEO 도넛 — 클릭 시 seo 탭 이동 */}
        <div className="chart-card p-4 flex flex-col items-center" role="img" aria-label={`블로그 SEO 점수 ${seoScore}점`}>
          <p className="text-xs font-semibold text-muted-foreground mb-2">블로그 SEO 점수</p>
          <div className="relative" aria-hidden="true">
            <PieChart width={100} height={100}>
              <Pie
                data={seoDonutData}
                innerRadius={35}
                outerRadius={48}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                <Cell fill="#237FFF" />
                <Cell fill="rgba(35,127,255,0.08)" />
              </Pie>
            </PieChart>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-foreground">{seoScore}점</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">블로그 SEO</p>
        </div>

        <div className="chart-card p-4 space-y-3" role="img" aria-label="플랫폼별 발행 현황">
          <p className="text-xs font-semibold text-muted-foreground">플랫폼별 발행</p>
          <PlatformBar
            label="네이버"
            count={naverCount}
            max={Math.max(naverCount, instaCount, tiktokCount, 1)}
            color="#03C75A"
          />
          <PlatformBar
            label="인스타"
            count={instaCount}
            max={Math.max(naverCount, instaCount, tiktokCount, 1)}
            color="#E1306C"
          />
          <PlatformBar
            label="틱톡"
            count={tiktokCount}
            max={Math.max(naverCount, instaCount, tiktokCount, 1)}
            color="#888888"
          />
        </div>
      </div>

      {/* Recent Posts */}
      <div>
        <h2 className="text-sm font-semibold mb-3 text-foreground">최근 작성글</h2>
        <div className="space-y-2">
          {posts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">아직 작성한 글이 없습니다</p>
          )}
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => onViewPost(post)}
              className="w-full flex items-center gap-3 glass-card p-3 text-left transition-colors hover:bg-secondary/50"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: post.status === "게시완료" ? "#22C55E" : post.status === "완료" ? "#237FFF" : "#888",
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{post.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {post.createdAt} ·{" "}
                  {post.platforms
                    .map((p) => (p === "naver" ? "네이버" : p === "instagram" ? "인스타" : "틱톡"))
                    .join(", ")}
                </p>
              </div>
              <Badge variant={statusBadgeVariant[post.status]}>{post.status}</Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Badge Bottom Sheet */}
      {showBadgeSheet && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => setShowBadgeSheet(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-lg bg-card rounded-t-2xl p-5 pb-8 space-y-4 animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto" />
            <h3 className="text-lg font-bold text-center">연속 사용 등급</h3>
            <div className="space-y-3">
              {allTiers.map((t) => (
                <div
                  key={t.label}
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{
                    border: `1.5px solid ${currentTierLabel === t.label ? t.border : "var(--color-border-tertiary, rgba(255,255,255,0.08))"}`,
                    background: currentTierLabel === t.label ? t.bg : "transparent",
                  }}
                >
                  <span className="text-2xl shrink-0 leading-none mt-0.5">{t.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: currentTierLabel === t.label ? t.color : "var(--foreground)" }}>
                      {t.label} <span className="text-xs text-muted-foreground font-normal">({t.range})</span>
                    </p>
                    {t.reward && <p className="text-xs mt-0.5" style={{ color: t.color }}>{t.reward}</p>}
                  </div>
                  {currentTierLabel === t.label && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ color: t.color, background: t.bg, border: `1px solid ${t.border}` }}
                    >
                      현재
                    </span>
                  )}
                </div>
              ))}
            </div>
            {nextTier && (
              <p className="text-sm text-center text-muted-foreground">
                다음 등급까지 <span className="font-semibold" style={{ color: "#237FFF" }}>{nextTier.remaining}개월</span> 남았습니다
              </p>
            )}
            {!nextTier && <p className="text-sm text-center font-bold" style={{ color: "#FFD700" }}>🥇 골드 등급 달성!</p>}
            <Button variant="outline" className="w-full" onClick={() => setShowBadgeSheet(false)}>
              닫기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlatformBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const width = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold text-foreground">{count}건</span>
      </div>
      <div className="w-full bg-white/[0.04] rounded-full h-2">
        <div className="rounded-full h-2 transition-all" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

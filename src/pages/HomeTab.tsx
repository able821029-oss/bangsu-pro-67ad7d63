import { useState } from "react";
import { Camera, TrendingUp, Award, PenLine, FileText, ChevronRight, Film } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
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

const weeklyData = [
  { week: "1주차", count: 4 },
  { week: "2주차", count: 6 },
  { week: "3주차", count: 5 },
  { week: "4주차", count: 3 },
];

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

  const usagePercent = subscription.maxCount > 0 ? (subscription.usedCount / subscription.maxCount) * 100 : 0;
  const remaining = subscription.maxCount - subscription.usedCount;

  const tier = getMedalTier(subscription.consecutiveMonths);
  const medal = tier > 0 ? medalInfo[tier] : null;
  const nextTier = getNextTier(subscription.consecutiveMonths);
  const [showBadgeSheet, setShowBadgeSheet] = useState(false);

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
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      {/* 헤더 — 설정 아이콘 제거, 로고 수정 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <svg width="36" height="36" viewBox="0 0 64 64" fill="none" className="shrink-0">
              <defs>
                <linearGradient id="hSg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#237FFF" />
                  <stop offset="100%" stopColor="#AB5EBE" />
                </linearGradient>
              </defs>
              <rect width="64" height="64" rx="16" fill="url(#hSg)" />
              <text
                x="8"
                y="52"
                fontFamily="Arial Black, Helvetica Neue, sans-serif"
                fontWeight="900"
                fontSize="52"
                fill="#FFFFFF"
              >
                S
              </text>
            </svg>
            <div className="flex flex-col gap-1">
              <span
                className="font-black text-xl leading-none"
                style={{
                  background: "linear-gradient(90deg, #237FFF, #AB5EBE)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                SMS
              </span>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 600,
                  color: "rgba(180,180,200,0.9)",
                  letterSpacing: "2px",
                  textTransform: "uppercase" as const,
                }}
              >
                셀프마케팅서비스
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* User + Plan Info */}
      <div className="glass-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{settings.companyName} 사장님</p>
            <p className="text-xs text-muted-foreground">
              {subscription.plan} · {subscription.maxCount}건 중 {subscription.usedCount}건
            </p>
          </div>
          {medal && (
            <button onClick={() => setShowBadgeSheet(true)}>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ color: medal.color, background: medal.bg, border: `1px solid ${medal.border}` }}
              >
                {medal.icon} {medal.label}
              </span>
            </button>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">이번달 사용량</span>
            <span className="text-xs font-semibold" style={{ color: progressColor }}>
              잔여 {remaining}건
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="rounded-full h-2 transition-all duration-300"
              style={{ width: `${Math.min(usagePercent, 100)}%`, backgroundColor: progressColor }}
            />
          </div>
        </div>
      </div>

      {/* Quick Start */}
      <button
        onClick={() => onNavigate("camera")}
        className="w-full rounded-2xl px-6 py-5 text-white text-lg font-bold flex items-center justify-center gap-3 shadow-lg active:scale-[0.97] transition-all"
        style={{ background: "linear-gradient(135deg, #237FFF 0%, #AB5EBE 100%)" }}
      >
        <Camera className="w-7 h-7" />
        지금 바로 글 작성하기
      </button>

      {/* 통계 카드 4개 — 클릭 시 탭 이동 */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onNavigate("publish")} className="glass-card p-4 text-center w-full">
          <p className="text-[28px] font-bold text-foreground">{completed}</p>
          <p className="text-xs text-muted-foreground">블로그 작성</p>
          <p className="text-xs text-[#22C55E] mt-1">▲ 3 지난달</p>
        </button>
        <button onClick={() => onNavigate("publish")} className="glass-card p-4 text-center w-full">
          <p className="text-[28px] font-bold text-foreground">{published}</p>
          <p className="text-xs text-muted-foreground">게시 완료</p>
          <p className="text-xs text-[#22C55E] mt-1">▲ 2 지난달</p>
        </button>
        {/* 영상 제작 — 프로+ 잠금 표시 */}
        <button onClick={() => onNavigate("shorts")} className="glass-card p-4 text-center w-full">
          <p className="text-[28px] font-bold text-foreground">3</p>
          <p className="text-xs text-muted-foreground">영상 제작</p>
          <p className="text-xs text-[#AB5EBE] mt-1">▶ 만들기</p>
        </button>
        <button onClick={() => setShowBadgeSheet(true)} className="glass-card p-4 text-center w-full">
          <p className="text-[28px] font-bold text-foreground">{subscription.consecutiveMonths}개월</p>
          <p className="text-xs text-muted-foreground">연속 사용</p>
          <p className="text-xs mt-1 font-semibold" style={{ color: tier > 0 ? medalInfo[tier].color : "var(--muted-foreground)" }}>
            {tier > 0 ? `${medalInfo[tier].icon} ${currentTierLabel}` : "등급 없음"}
          </p>
        </button>
      </div>

      {/* Weekly Bar Chart */}
      <div className="chart-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">최근 4주 발행 현황</p>
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

      {/* SEO Donut + Platform Bars */}
      <div className="grid grid-cols-2 gap-3">
        {/* SEO 도넛 — 클릭 시 seo 탭 이동 */}
        <div className="chart-card p-4 flex flex-col items-center">
          <p className="text-xs font-semibold text-muted-foreground mb-2">블로그 SEO 점수</p>
          <div className="relative">
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

        <div className="chart-card p-4 space-y-3">
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

import { useMemo, useState } from "react";
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
  Hammer,
  FileText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconChip } from "@/components/IconChip";
import { useAppStore, PostStatus, BlogPost } from "@/stores/appStore";
import { useUsageSummary } from "@/hooks/useUsageSummary";
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

  // ── 파생 집계 (posts 변경 시에만 재계산) ──────────────────────────────
  // 2026-04-24: posts 배열이 커질수록 매 렌더 filter 5~7회 반복되던 문제 해결.
  // usage_logs RPC 붙으면 monthlyUsed·weeklyData를 서버 뷰로 교체 예정.
  const stats = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7); // "2026-04"
    let published = 0;
    let completed = 0;
    let monthlyUsed = 0;
    let naverCount = 0;
    let instaCount = 0;
    let tiktokCount = 0;
    for (const p of posts) {
      const isDone = p.status === "완료" || p.status === "게시완료";
      if (p.status === "게시완료") published += 1;
      if (isDone) {
        completed += 1;
        if (typeof p.createdAt === "string" && p.createdAt.startsWith(currentMonth)) {
          monthlyUsed += 1;
        }
        if (p.platforms.includes("naver")) naverCount += 1;
        if (p.platforms.includes("instagram")) instaCount += 1;
        if (p.platforms.includes("tiktok")) tiktokCount += 1;
      }
    }
    // 주간 발행 — 4주치 버킷
    const now = new Date();
    const weeklyData = [3, 2, 1, 0].map((weeksAgo) => {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() - weeksAgo * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const count = posts.reduce((acc, p) => {
        const isDone = p.status === "완료" || p.status === "게시완료";
        if (!isDone) return acc;
        const d = new Date(p.createdAt);
        return d >= weekStart && d <= weekEnd ? acc + 1 : acc;
      }, 0);
      return { week: `${4 - weeksAgo}주차`, count };
    });
    return { published, completed, monthlyUsed, weeklyData, naverCount, instaCount, tiktokCount };
  }, [posts]);

  const { published, completed, weeklyData } = stats;

  // usage_current_month 뷰 우선 — 서버 집계가 "정답".
  // 뷰 미배포/빈 결과 시 훅 내부에서 posts 기반 파생(fallback) 자동 전환.
  // 기존 stats.monthlyUsed / subscription.videoUsed 는 fallback 내부에서 동일한 로직 사용.
  const usage = useUsageSummary();
  const monthlyUsed = usage.blogCount;
  const videoCount = usage.shortsCount;

  const usagePercent = subscription.maxCount > 0 ? (monthlyUsed / subscription.maxCount) * 100 : 0;
  const remaining = subscription.maxCount - monthlyUsed;

  const tier = getMedalTier(subscription.consecutiveMonths);
  const medal = tier > 0 ? medalInfo[tier] : null;
  const nextTier = getNextTier(subscription.consecutiveMonths);
  const [showBadgeSheet, setShowBadgeSheet] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifications: NotificationItem[] = [];

  const currentTierLabel = tier >= 6 ? "골드" : tier >= 3 ? "실버" : tier >= 1 ? "브론즈" : "";

  const progressColor = usagePercent >= 100 ? "#EF4444" : usagePercent >= 80 ? "#F97316" : "#237FFF";

  const seoScore = 74;

  const { naverCount, instaCount, tiktokCount } = stats;

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
            <span className="stat-number text-5xl text-primary text-glow">{monthlyUsed}</span>
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

      {/* Power CTA — AI 글쓰기 바로가기 (강화된 글로우) */}
      <button
        onClick={() => onNavigate("camera")}
        className="btn-power w-full text-base relative overflow-hidden"
        aria-label="AI 글쓰기 바로 시작"
      >
        <Sparkles className="w-5 h-5" strokeWidth={2.2} />
        <span>AI로 블로그 글 자동 생성</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/25 ml-1">
          추천
        </span>
      </button>

      {/* 직접 글쓰기 보조 링크 */}
      <button
        onClick={() => onNavigate("content")}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Camera className="w-3.5 h-3.5" />
        사진만 찍고 직접 글쓰기
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

      {/* Weekly Bar Chart — 심플 커스텀 바 차트 */}
      <WeeklyBarCard weeklyData={weeklyData} />

      {/* SEO + Platform Bars — 심플 레이아웃 */}
      <div className="grid grid-cols-2 gap-3">
        <SeoDonutCard score={seoScore} />
        <PlatformBarCard
          naver={naverCount}
          insta={instaCount}
          tiktok={tiktokCount}
        />
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

// ── 심플 주간 바 차트 — 순수 HTML/CSS로 구현 (recharts 불필요) ──
function WeeklyBarCard({ weeklyData }: { weeklyData: Array<{ week: string; count: number }> }) {
  const total = weeklyData.reduce((sum, w) => sum + w.count, 0);
  const max = Math.max(...weeklyData.map((w) => w.count), 1);

  return (
    <section className="glass-card p-5" aria-label="최근 4주 발행 현황">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground">최근 4주 발행</h3>
        <div className="flex items-baseline gap-1">
          <span className="stat-number text-xl">{total}</span>
          <span className="stat-unit text-xs">건</span>
        </div>
      </div>

      {total === 0 ? (
        <div className="h-[140px] flex flex-col items-center justify-center gap-1 text-center">
          <p className="text-xs text-muted-foreground">아직 발행 데이터가 없어요</p>
          <p className="text-[11px] text-muted-foreground/60">첫 글을 작성해보세요</p>
        </div>
      ) : (
        <div className="flex items-end justify-between gap-4 h-[120px]" aria-hidden="true">
          {weeklyData.map((w) => {
            const pct = Math.max(4, (w.count / max) * 100);
            return (
              <div key={w.week} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                <div className="relative flex-1 w-full flex items-end">
                  <div
                    className="w-full rounded-t-lg transition-all duration-500"
                    style={{
                      height: `${pct}%`,
                      background: w.count > 0
                        ? "linear-gradient(180deg, #4C8EFF 0%, #237FFF 100%)"
                        : "rgba(76,142,255,0.08)",
                      boxShadow: w.count > 0 ? "0 0 12px rgba(35,127,255,0.35)" : undefined,
                    }}
                  />
                  {w.count > 0 && (
                    <span
                      className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-primary"
                    >
                      {w.count}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">{w.week}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── SEO 점수 도넛 — 심플 SVG ──
function SeoDonutCard({ score }: { score: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const dash = (clamped / 100) * c;

  return (
    <section className="glass-card p-4 flex flex-col items-center justify-center gap-2" aria-label={`블로그 SEO 점수 ${score}점`}>
      <p className="text-[11px] font-medium text-muted-foreground">블로그 SEO 점수</p>
      <div className="relative" aria-hidden="true">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <defs>
            <linearGradient id="seoGrad" x1="0" y1="0" x2="96" y2="96">
              <stop offset="0%" stopColor="#4C8EFF" />
              <stop offset="100%" stopColor="#AB5EBE" />
            </linearGradient>
          </defs>
          {/* 배경 원 */}
          <circle cx="48" cy="48" r={r} stroke="rgba(76,142,255,0.12)" strokeWidth="8" fill="none" />
          {/* 진행률 */}
          <circle
            cx="48"
            cy="48"
            r={r}
            stroke="url(#seoGrad)"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${dash} ${c}`}
            transform="rotate(-90 48 48)"
            style={{ filter: "drop-shadow(0 0 6px rgba(76,142,255,0.45))" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="stat-number text-2xl">
            {score}
            <span className="stat-unit text-xs ml-0.5">점</span>
          </span>
        </div>
      </div>
    </section>
  );
}

// ── 플랫폼 발행 바 ──
const PLATFORM_META = {
  naver: { label: "네이버", color: "#03C75A" },
  instagram: { label: "인스타", color: "#E1306C" },
  tiktok: { label: "틱톡", color: "#FFFFFF" },
} as const;

function PlatformBarCard({ naver, insta, tiktok }: { naver: number; insta: number; tiktok: number }) {
  const total = naver + insta + tiktok;
  const max = Math.max(naver, insta, tiktok, 1);
  const rows: Array<{ key: keyof typeof PLATFORM_META; count: number }> = [
    { key: "naver", count: naver },
    { key: "instagram", count: insta },
    { key: "tiktok", count: tiktok },
  ];

  return (
    <section className="glass-card p-4 space-y-3" aria-label="플랫폼별 발행 현황">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-medium text-muted-foreground">플랫폼별 발행</p>
        <span className="text-[10px] text-muted-foreground">총 {total}건</span>
      </div>
      <div className="space-y-2.5" aria-hidden="true">
        {rows.map(({ key, count }) => {
          const pct = max > 0 ? (count / max) * 100 : 0;
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-foreground/80">{PLATFORM_META[key].label}</span>
                <span className="text-[11px] font-semibold text-foreground">{count}건</span>
              </div>
              <div className="w-full bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: PLATFORM_META[key].color,
                    boxShadow: count > 0 ? `0 0 8px ${PLATFORM_META[key].color}66` : undefined,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

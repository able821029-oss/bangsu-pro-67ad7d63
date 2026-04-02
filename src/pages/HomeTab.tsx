import { useState } from "react";
import { Camera, TrendingUp, Award, Upload, PenTool, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAppStore, PostStatus, BlogPost } from "@/stores/appStore";
import type { TabId } from "@/components/BottomNav";

const statusColor: Record<PostStatus, "success" | "warning" | "info" | "default"> = {
  "게시완료": "success",
  "완료": "info",
  "작성중": "warning",
  "AI생성중": "warning",
};

const medalInfo: Record<number, { emoji: string; label: string; reward: string }> = {
  1: { emoji: "🥉", label: "브론즈", reward: "" },
  3: { emoji: "🥈", label: "실버", reward: "20% 할인쿠폰 자동 지급!" },
  6: { emoji: "🥇", label: "골드", reward: "1개월 무료 자동 지급!" },
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
  { emoji: "🥉", label: "브론즈", range: "1~2개월", reward: "" },
  { emoji: "🥈", label: "실버", range: "3~5개월", reward: "다음달 20% 할인 쿠폰 자동 지급" },
  { emoji: "🥇", label: "골드", range: "6개월 이상", reward: "1개월 무료 자동 지급" },
];

export function HomeTab({ onNavigate, onViewPost }: { onNavigate: (tab: TabId) => void; onViewPost: (post: BlogPost) => void }) {
  const posts = useAppStore((s) => s.posts);
  const settings = useAppStore((s) => s.settings);
  const subscription = useAppStore((s) => s.subscription);
  const published = posts.filter((p) => p.status === "게시완료").length;
  const completed = posts.filter((p) => p.status === "완료" || p.status === "게시완료").length;

  const usagePercent = subscription.maxCount > 0 ? (subscription.usedCount / subscription.maxCount) * 100 : 0;
  const remaining = subscription.maxCount - subscription.usedCount;
  const isHighUsage = usagePercent >= 80;

  const tier = getMedalTier(subscription.consecutiveMonths);
  const medal = tier > 0 ? medalInfo[tier] : null;
  const nextTier = getNextTier(subscription.consecutiveMonths);
  const [showBadgeSheet, setShowBadgeSheet] = useState(false);

  const currentTierLabel = tier >= 6 ? "골드" : tier >= 3 ? "실버" : tier >= 1 ? "브론즈" : "";

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-[--radius] bg-primary/20 border border-primary/30 flex items-center justify-center overflow-hidden">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="로고" className="w-full h-full object-cover" />
          ) : (
            <span className="text-primary font-black text-lg">방</span>
          )}
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">
            {settings.companyName || "방수PRO"}
          </h1>
          <p className="text-muted-foreground text-xs">현장 사진 → AI 블로그 → 반자동 업로드</p>
        </div>
      </div>

      {/* Subscription + Usage */}
      <div className="bg-card rounded-[--radius] border border-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">{subscription.plan}</span>
          </div>
          <span className={`text-xs font-semibold ${isHighUsage ? "text-primary" : "text-muted-foreground"}`}>
            잔여 {remaining}건
          </span>
        </div>
        <Progress value={usagePercent} className={`h-2 ${isHighUsage ? "[&>div]:bg-primary" : ""}`} />
        {isHighUsage && (
          <div className="flex items-center justify-end">
            <Badge variant="default" className="text-xs">업그레이드 추천</Badge>
          </div>
        )}
      </div>

      {/* Medal Badge */}
      {medal && (
        <button
          onClick={() => setShowBadgeSheet(true)}
          className="w-full bg-primary/10 border border-primary/20 rounded-[--radius] px-4 py-2 text-center transition-all"
        >
          <span className="text-sm font-semibold text-primary">
            {medal.emoji} 연속 {subscription.consecutiveMonths}개월 사용 중 — {medal.label}
          </span>
        </button>
      )}

      {/* Badge Bottom Sheet */}
      {showBadgeSheet && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => setShowBadgeSheet(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-lg bg-card rounded-t-2xl p-5 pb-8 space-y-4 animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto" />
            <h3 className="text-lg font-bold text-center">연속 사용 등급</h3>
            <div className="space-y-3">
              {allTiers.map((t) => (
                <div key={t.label} className={`flex items-start gap-3 p-3 rounded-[--radius] border ${currentTierLabel === t.label ? "border-primary bg-primary/10" : "border-border"}`}>
                  <span className="text-2xl">{t.emoji}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{t.label} <span className="text-xs text-muted-foreground font-normal">({t.range})</span></p>
                    {t.reward && <p className="text-xs text-primary mt-0.5">{t.reward}</p>}
                  </div>
                  {currentTierLabel === t.label && <Badge variant="default" className="text-xs">현재</Badge>}
                </div>
              ))}
            </div>
            {nextTier && (
              <p className="text-sm text-center text-muted-foreground">
                다음 등급까지 <span className="text-primary font-semibold">{nextTier.remaining}개월</span> 남았습니다
              </p>
            )}
            {!nextTier && <p className="text-sm text-center text-primary font-semibold">🎉 최고 등급 달성!</p>}
            <Button variant="outline" className="w-full" onClick={() => setShowBadgeSheet(false)}>닫기</Button>
          </div>
        </div>
      )}

      {/* Stats Banner */}
      <div className="bg-card rounded-[--radius] border border-border p-4">
        <p className="text-sm font-semibold text-muted-foreground mb-3">📊 이달의 성과</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <PenTool className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{completed}</p>
            <p className="text-xs text-muted-foreground">AI 글 작성</p>
          </div>
          <div className="text-center">
            <TrendingUp className="w-4 h-4 text-success mx-auto mb-1" />
            <p className="text-2xl font-bold">{published}</p>
            <p className="text-xs text-muted-foreground">게시 완료</p>
          </div>
          <div className="text-center">
            <ExternalLink className="w-4 h-4 text-[#03C75A] mx-auto mb-1" />
            <p className="text-2xl font-bold">0</p>
            <button
              onClick={() => { window.location.href = "naver://blog"; }}
              className="text-xs text-[#03C75A] font-semibold mt-0.5"
            >
              네이버에서 확인 →
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="hero" size="lg" className="w-full" onClick={() => onNavigate("camera")}>
          <Camera className="w-6 h-6" />
          촬영 시작
        </Button>
        <Button variant="outline" size="lg" className="w-full" onClick={() => onNavigate("publish")}>
          <Upload className="w-6 h-6" />
          발행현황
        </Button>
      </div>

      {/* Recent Posts */}
      <div>
        <h2 className="text-lg font-bold mb-3">최근 작성글</h2>
        <div className="space-y-3">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => onViewPost(post)}
              className="w-full flex items-center gap-3 bg-card rounded-[--radius] border border-border p-3 text-left transition-colors hover:bg-secondary"
            >
              <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <Camera className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{post.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{post.createdAt}</p>
              </div>
              <Badge variant={statusColor[post.status]}>{post.status}</Badge>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

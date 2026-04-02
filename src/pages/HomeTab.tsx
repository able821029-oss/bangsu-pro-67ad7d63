import { Camera, Send, TrendingUp, Eye, FileCheck, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore, PostStatus } from "@/stores/appStore";
import type { TabId } from "@/components/BottomNav";

const statusColor: Record<PostStatus, "success" | "warning" | "info" | "default"> = {
  "게시완료": "success",
  "완료": "info",
  "작성중": "warning",
  "AI생성중": "warning",
};

export function HomeTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const posts = useAppStore((s) => s.posts);
  const settings = useAppStore((s) => s.settings);
  const subscription = useAppStore((s) => s.subscription);
  const published = posts.filter((p) => p.status === "게시완료").length;
  const completed = posts.filter((p) => p.status === "완료" || p.status === "게시완료").length;

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      {/* Header with Logo */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center overflow-hidden">
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

      {/* Subscription Badge */}
      <div className="flex items-center justify-between bg-card rounded-xl border border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{subscription.plan}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          이번달 {subscription.usedCount}/{subscription.maxCount}건
        </span>
      </div>

      {/* Consecutive Month Badge */}
      {subscription.consecutiveMonths >= 3 && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-2 text-center">
          <span className="text-sm font-semibold text-primary">
            🔥 연속 {subscription.consecutiveMonths}개월 사용 중
          </span>
        </div>
      )}

      {/* Stats Banner */}
      <div className="bg-card rounded-xl border border-border p-4">
        <p className="text-sm font-semibold text-muted-foreground mb-3">📊 이달의 성과</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <FileCheck className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{completed}</p>
            <p className="text-xs text-muted-foreground">작성 완료</p>
          </div>
          <div className="text-center">
            <TrendingUp className="w-4 h-4 text-success mx-auto mb-1" />
            <p className="text-2xl font-bold">{published}</p>
            <p className="text-xs text-muted-foreground">블로그 게시</p>
          </div>
          <div className="text-center">
            <Eye className="w-4 h-4 text-info mx-auto mb-1" />
            <p className="text-2xl font-bold">1,240</p>
            <p className="text-xs text-muted-foreground">조회수</p>
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
          <Send className="w-6 h-6" />
          게시 목록
        </Button>
      </div>

      {/* Recent Posts */}
      <div>
        <h2 className="text-lg font-bold mb-3">최근 작성글</h2>
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex items-center gap-3 bg-card rounded-xl border border-border p-3"
            >
              <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <Camera className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{post.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{post.createdAt}</p>
              </div>
              <Badge variant={statusColor[post.status]}>{post.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

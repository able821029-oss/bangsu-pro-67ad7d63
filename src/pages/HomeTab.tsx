import { Camera, Upload, TrendingUp, Eye, FileCheck } from "lucide-react";
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
  const published = posts.filter((p) => p.status === "게시완료").length;
  const completed = posts.filter((p) => p.status === "완료" || p.status === "게시완료").length;

  return (
    <div className="px-4 pt-6 pb-24 space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          방수<span className="text-primary">PRO</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">현장 사진 → AI 블로그 → 네이버 업로드</p>
      </div>

      {/* Stats Banner */}
      <div className="bg-card rounded-xl border border-border p-4">
        <p className="text-sm font-semibold text-muted-foreground mb-3">📊 이달의 성과</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <FileCheck className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{completed}</p>
            <p className="text-xs text-muted-foreground">작성 완료</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <p className="text-2xl font-bold">{published}</p>
            <p className="text-xs text-muted-foreground">블로그 게시</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Eye className="w-4 h-4 text-info" />
            </div>
            <p className="text-2xl font-bold">1,240</p>
            <p className="text-xs text-muted-foreground">조회수</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="hero" size="lg" className="w-full" onClick={() => onNavigate("camera")}>
          <Camera className="w-6 h-6" />
          사진 촬영
        </Button>
        <Button variant="outline" size="lg" className="w-full" onClick={() => onNavigate("upload")}>
          <Upload className="w-6 h-6" />
          업로드
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

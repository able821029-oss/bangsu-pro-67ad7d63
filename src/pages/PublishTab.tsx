import { useState } from "react";
import { Upload, Copy, ExternalLink, Camera, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore, BlogPost, Platform, PostStatus } from "@/stores/appStore";
import type { TabId } from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";

const platformLabels: Record<Platform, string> = {
  naver: "네이버 블로그",
  instagram: "인스타그램",
  tiktok: "틱톡",
};

const platformColors: Record<Platform, string> = {
  naver: "bg-[#03C75A] text-white hover:bg-[#03C75A]/90",
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90",
  tiktok: "bg-black text-white hover:bg-black/90",
};

const statusColor: Record<PostStatus, "success" | "warning" | "info" | "default"> = {
  게시완료: "success",
  완료: "info",
  작성중: "warning",
  AI생성중: "warning",
};

export function PublishTab({
  onNavigate,
  onViewPost,
}: {
  onNavigate: (tab: TabId) => void;
  onViewPost: (post: BlogPost) => void;
}) {
  const posts = useAppStore((s) => s.posts);
  const { toast } = useToast();

  // ✅ FIX: 반자동 툴팁 상태
  const [showSemiAutoTip, setShowSemiAutoTip] = useState(false);

  const completedPosts = posts.filter((p) => p.status === "완료" || p.status === "게시완료");
  const inProgressPosts = posts.filter((p) => p.status === "작성중" || p.status === "AI생성중");

  const getClipboardText = (post: BlogPost) => {
    let text = post.title + "\n\n";
    post.blocks.forEach((block) => {
      if (block.type === "text") text += block.content + "\n\n";
      else text += `[${block.caption || "사진"}]\n\n`;
    });
    text += post.hashtags.map((t) => `#${t}`).join(" ");
    return text;
  };

  const handleUpload = async (post: BlogPost, platform: Platform) => {
    try {
      await navigator.clipboard.writeText(getClipboardText(post));
      toast({ title: `"${post.title}" 복사 완료!` });
    } catch {
      toast({ title: "클립보드 복사 실패", variant: "destructive" });
    }

    if (platform === "naver") {
      window.location.href = "naver://blog/write";
      setTimeout(() => window.open("https://blog.naver.com/", "_blank"), 2000);
    } else if (platform === "instagram") {
      window.open("https://www.instagram.com/", "_blank");
    } else {
      window.open("https://www.tiktok.com/", "_blank");
    }
  };

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <Upload className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">발행현황</h1>

        {/* ✅ FIX: 반자동 뱃지 — 클릭 시 툴팁 */}
        <div className="relative">
          <button onClick={() => setShowSemiAutoTip(!showSemiAutoTip)}>
            <Badge variant="warning" className="text-xs cursor-pointer gap-1">
              반자동 <HelpCircle className="w-3 h-3" />
            </Badge>
          </button>
          {showSemiAutoTip && (
            <div className="absolute top-8 left-0 z-20 bg-card border border-border rounded-xl p-3 text-xs text-muted-foreground w-60 shadow-xl">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-semibold text-foreground">반자동이란?</p>
                <button onClick={() => setShowSemiAutoTip(false)}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p>AI가 글을 자동으로 작성하고, 사용자가 직접 네이버 블로그나 인스타그램에 업로드하는 방식입니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* Completed Posts */}
      {completedPosts.length > 0 ? (
        <div className="space-y-4">
          {completedPosts.map((post) => (
            <div key={post.id} className="bg-card rounded-[--radius] border border-border p-4 space-y-3">
              {/* ✅ FIX: 카드 본문만 글 상세로 이동 */}
              <button onClick={() => onViewPost(post)} className="w-full text-left">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Camera className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{post.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {post.createdAt} · {post.workType}
                    </p>
                  </div>
                  <Badge variant={statusColor[post.status]} className="shrink-0">
                    {post.status}
                  </Badge>
                </div>
              </button>

              {/* ✅ FIX: 플랫폼 버튼 — stopPropagation으로 카드 클릭과 분리 */}
              <div className="flex gap-2 flex-wrap">
                {post.platforms.map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    className={`text-xs gap-1.5 ${platformColors[p]}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpload(post, p);
                    }}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {platformLabels[p]}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-[--radius] border border-border p-8 text-center space-y-3">
          <Upload className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            작성 완료된 글이 없습니다.
            <br />
            촬영 탭에서 AI 글쓰기를 시작해주세요.
          </p>
          <Button variant="outline" onClick={() => onNavigate("camera")}>
            촬영하러 가기
          </Button>
        </div>
      )}

      {/* In Progress Posts */}
      {inProgressPosts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">작성 중인 글</p>
          {inProgressPosts.map((post) => (
            <div key={post.id} className="bg-card rounded-[--radius] border border-border p-3 space-y-2">
              <button onClick={() => onViewPost(post)} className="w-full flex items-center gap-3 text-left">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{post.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{post.createdAt}</p>
                </div>
                <Badge variant={statusColor[post.status]}>{post.status}</Badge>
              </button>
              <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => onViewPost(post)}>
                이어서 작성하기
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

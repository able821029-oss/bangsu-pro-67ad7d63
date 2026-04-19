import { useState } from "react";
import { Upload, Camera, HelpCircle, X, CheckCircle2, PenLine, Share2, FileCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconChip } from "@/components/IconChip";
import { useAppStore, BlogPost, Platform, PostStatus } from "@/stores/appStore";
import type { TabId } from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";
import { shareToKakao, isKakaoAvailable } from "@/lib/kakao";
import { trackEvent } from "@/lib/analytics";

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

  const handleKakaoShare = (post: BlogPost) => {
    if (!isKakaoAvailable()) {
      toast({
        title: "카카오 공유를 사용할 수 없습니다",
        description: "VITE_KAKAO_JAVASCRIPT_KEY 환경변수를 설정해주세요.",
        variant: "destructive",
      });
      return;
    }
    const firstTextBlock = post.blocks.find((b) => b.type === "text");
    const description =
      (firstTextBlock?.content || "").slice(0, 120) || "현장 사진으로 작성된 블로그 글입니다.";
    const imageUrl = post.photos[0]?.dataUrl?.startsWith("http")
      ? post.photos[0].dataUrl
      : `${window.location.origin}/og-image.png`;

    const ok = shareToKakao({
      title: post.title || "새 블로그 글",
      description,
      imageUrl,
      url: window.location.href,
    });
    if (ok) {
      trackEvent("share_kakao_clicked", { post_id: post.id });
    } else {
      toast({ title: "카카오 공유에 실패했습니다", variant: "destructive" });
    }
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
      {/* 요약 통계 — 컬러 아이콘 칩 + 큰 숫자 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card p-3 flex flex-col items-start gap-2">
          <IconChip icon={PenLine} color="blue" size="sm" />
          <div>
            <p className="stat-number text-xl">{completedPosts.length}</p>
            <p className="text-[10px] stat-unit mt-0.5">작성 완료</p>
          </div>
        </div>
        <div className="glass-card p-3 flex flex-col items-start gap-2">
          <IconChip icon={FileCheck} color="green" size="sm" />
          <div>
            <p className="stat-number text-xl">{posts.filter(p => p.status === "게시완료").length}</p>
            <p className="text-[10px] stat-unit mt-0.5">게시 완료</p>
          </div>
        </div>
        <div className="glass-card p-3 flex flex-col items-start gap-2">
          <IconChip icon={Clock} color="amber" size="sm" />
          <div>
            <p className="stat-number text-xl">{inProgressPosts.length}</p>
            <p className="text-[10px] stat-unit mt-0.5">작성 중</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Upload className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">발행현황</h1>

        <div className="relative">
          <button onClick={() => setShowSemiAutoTip(!showSemiAutoTip)}>
            <Badge variant="warning" className="text-xs cursor-pointer gap-1">
              반자동 <HelpCircle className="w-3 h-3" />
            </Badge>
          </button>
          {showSemiAutoTip && (
            <div className="absolute top-8 left-0 z-20 bg-card border border-border rounded-xl p-3 text-xs text-muted-foreground w-56 shadow-xl max-w-[calc(100vw-2rem)]">
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
            <div key={post.id} className="glass-card p-4 space-y-3">
                    <button onClick={() => onViewPost(post)} className="w-full text-left">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden shrink-0">
                    {post.photos.length > 0 ? (
                      <img src={post.photos[0].dataUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{post.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {post.createdAt} · {post.workType}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    {post.status === "게시완료" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    <Badge variant={statusColor[post.status]}>{post.status}</Badge>
                  </div>
                </div>
              </button>

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
                <Button
                  size="sm"
                  className="text-xs gap-1.5 bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleKakaoShare(post);
                  }}
                  aria-label="카카오톡으로 공유"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  카카오톡 공유
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-8 text-center space-y-4">
          <div className="icon-chip icon-chip-lg mx-auto">
            <PenLine className="w-6 h-6" color="#237FFF" strokeWidth={2} />
          </div>
          <div>
            <p className="font-semibold text-sm">아직 작성된 글이 없어요</p>
            <p className="text-xs text-muted-foreground mt-1">
              현장 사진만 찍으면 AI가<br />블로그 글을 자동으로 써드립니다!
            </p>
          </div>
          <Button
            className="w-full"
            style={{ background: "linear-gradient(135deg, #237FFF 0%, #AB5EBE 100%)", color: "white" }}
            onClick={() => onNavigate("camera")}
          >
            지금 바로 글 작성하기
          </Button>
        </div>
      )}

      {/* In Progress Posts */}
      {inProgressPosts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">작성 중인 글</p>
          {inProgressPosts.map((post) => (
            <div key={post.id} className="glass-card p-3 space-y-2">
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

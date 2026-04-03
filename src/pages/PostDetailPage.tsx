import { useState, useEffect } from "react";
import { ArrowLeft, Edit3, Hash, Camera, Copy, RefreshCw, Save, X, Plus, Film, CheckCircle2, Loader2, Check, AlertTriangle, TrendingUp } from "lucide-react";
import { SeoScoreBadge } from "@/components/SeoScoreBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAppStore, BlogPost, Platform, ContentBlock } from "@/stores/appStore";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { TabId } from "@/components/BottomNav";

const platformLabels: Record<Platform, string> = {
  naver: "네이버 블로그",
  instagram: "인스타그램",
  tiktok: "틱톡",
};

const statusBadgeVariant: Record<string, "default" | "info" | "success"> = {
  "작성중": "default",
  "AI생성중": "default",
  "완료": "info",
  "게시완료": "success",
};

export function PostDetailPage({ post, onBack, onNavigate }: { post: BlogPost; onBack: () => void; onNavigate?: (tab: TabId) => void }) {
  const { updatePost, updatePostStatus } = useAppStore();
  const { toast } = useToast();
  const [title, setTitle] = useState(post.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [blocks, setBlocks] = useState<ContentBlock[]>(post.blocks);
  const [hashtags, setHashtags] = useState(post.hashtags);
  const [editingBlockIdx, setEditingBlockIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editingHashtags, setEditingHashtags] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(post.status);
  const [seoResult, setSeoResult] = useState<any>(null);
  const [seoLoading, setSeoLoading] = useState(false);

  // Auto-analyze SEO on mount if post has content
  useEffect(() => {
    if (blocks.length > 0 && blocks.some(b => b.type === "text" && b.content)) {
      handleAutoSeoAnalyze();
    }
  }, []);

  const handleAutoSeoAnalyze = async () => {
    setSeoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seo-analyze", {
        body: {
          mode: "seo_score",
          title,
          blocks,
          hashtags,
          location: "",
          workType: post.workType,
        },
      });
      if (!error && !data?.error) {
        setSeoResult(data);
      }
    } catch {} finally {
      setSeoLoading(false);
    }
  };

  const seoScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const saveToDb = async (updates: Record<string, any>) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from("posts").update(updates).eq("id", post.id);
      if (error) console.error("DB update error:", error);
    } catch (e) {
      console.error("DB save error:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTitle = async () => {
    setIsEditingTitle(false);
    updatePost(post.id, { title });
    await saveToDb({ title });
    toast({ title: "✅ 제목이 수정되었습니다." });
  };

  const handleSaveEdit = async () => {
    if (editingBlockIdx === null) return;
    const newBlocks = blocks.map((b, i) => (i === editingBlockIdx ? { ...b, content: editText } : b));
    setBlocks(newBlocks);
    setEditingBlockIdx(null);
    updatePost(post.id, { blocks: newBlocks });
    await saveToDb({ blocks: newBlocks });
    toast({ title: "✅ 본문이 수정되었습니다." });
  };

  const handleRemoveTag = (idx: number) => {
    const newTags = hashtags.filter((_, i) => i !== idx);
    setHashtags(newTags);
    updatePost(post.id, { hashtags: newTags });
    saveToDb({ hashtags: newTags });
  };

  const handleAddTag = () => {
    const tag = newTagInput.trim().replace(/^#/, "");
    if (!tag || hashtags.includes(tag)) return;
    const newTags = [...hashtags, tag];
    setHashtags(newTags);
    setNewTagInput("");
    updatePost(post.id, { hashtags: newTags });
    saveToDb({ hashtags: newTags });
  };

  const handleFinishHashtags = () => {
    setEditingHashtags(false);
    toast({ title: "✅ 해시태그가 저장되었습니다." });
  };

  const handleTempSave = async () => {
    updatePost(post.id, { title, blocks, hashtags, status: "작성중" });
    setCurrentStatus("작성중");
    await saveToDb({ title, blocks, hashtags, status: "작성중" });
    toast({ title: "✅ 임시저장 완료", duration: 2000 });
  };

  const handleMarkPublished = async () => {
    updatePostStatus(post.id, "게시완료");
    setCurrentStatus("게시완료");
    await saveToDb({ status: "게시완료" });
    toast({ title: "✅ 게시완료로 변경되었습니다" });
  };

  const handleRegenerate = () => {
    toast({ title: "🔄 같은 설정으로 AI가 글을 다시 생성합니다.", description: "잠시만 기다려주세요..." });
  };

  const getClipboardText = (platform: Platform) => {
    if (platform === "instagram") {
      const textContent = blocks.filter(b => b.type === "text").map(b => b.content).join(" ");
      const caption = textContent.slice(0, 150);
      const tags = hashtags.slice(0, 20).map(t => `#${t}`).join(" ");
      return caption + "\n\n" + tags;
    }
    if (platform === "tiktok") {
      const textContent = blocks.filter(b => b.type === "text").map(b => b.content).join("\n");
      const lines = textContent.split(/\n+/).filter(Boolean).slice(0, 3);
      const tags = hashtags.slice(0, 5).map(t => `#${t}`).join(" ");
      return lines.join("\n") + "\n\n" + tags;
    }
    let text = title + "\n\n";
    blocks.forEach((block, idx) => {
      if (block.type === "text") text += block.content + "\n\n";
      else text += `[📸 사진${idx + 1} 여기에 첨부]\n\n`;
    });
    text += hashtags.slice(0, 10).map(t => `#${t}`).join(" ");
    return text;
  };

  const deeplinks: Record<Platform, string> = {
    naver: "naver://blog/write",
    instagram: "instagram://",
    tiktok: "snssdk1233://",
  };

  const platformButtonStyles: Record<Platform, string> = {
    naver: "bg-[#03C75A] hover:bg-[#03C75A]/90 text-white",
    instagram: "bg-[#E1306C] hover:bg-[#E1306C]/90 text-white",
    tiktok: "bg-black hover:bg-black/90 text-white",
  };

  const handleCopyAndOpen = async (platform: Platform) => {
    try {
      await navigator.clipboard.writeText(getClipboardText(platform));
      toast({ title: `✅ ${platformLabels[platform]}용 글이 복사되었습니다!` });
    } catch {
      toast({ title: "클립보드 복사 실패", variant: "destructive" });
    }
    window.location.href = deeplinks[platform];
  };

  const orderedPlatforms = ["naver", "instagram", "tiktok"].filter(p =>
    post.platforms.includes(p as Platform)
  ) as Platform[];

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-[--radius] hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">글 상세</h1>
        <SeoScoreBadge
          post={post}
          onImprove={(improved) => {
            setTitle(improved.title);
            setBlocks(improved.blocks);
            setHashtags(improved.hashtags);
            updatePost(post.id, improved);
            saveToDb(improved);
          }}
        />
        <Badge variant={statusBadgeVariant[currentStatus] || "default"}>{currentStatus}</Badge>
      </div>

      {/* Title */}
      <div className="bg-card rounded-[--radius] border border-border p-4">
        <label className="text-xs text-muted-foreground mb-1 block">제목</label>
        {isEditingTitle ? (
          <div className="space-y-2">
            <input className="w-full bg-secondary rounded-lg px-3 py-2 text-lg font-bold outline-none text-foreground" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveTitle}>저장</Button>
              <Button size="sm" variant="outline" onClick={() => { setIsEditingTitle(false); setTitle(post.title); }}>취소</Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setIsEditingTitle(true)} className="w-full text-left group relative">
            <p className="text-lg font-bold">{title}</p>
            <Edit3 className="w-4 h-4 text-muted-foreground absolute top-0 right-0 opacity-60" />
          </button>
        )}
      </div>

      {/* Photos */}
      {post.photos.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2">첨부 사진 ({post.photos.length}장)</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {post.photos.map((photo) => (
              <div key={photo.id} className="shrink-0 w-24 h-24 rounded-[--radius] overflow-hidden border-2 border-border">
                <img src={photo.dataUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Blocks — full body display with inline editing */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">본문</p>
        {blocks.map((block, idx) =>
          block.type === "text" ? (
            <div key={idx} className="bg-card rounded-[--radius] border border-border p-4 relative group">
              {editingBlockIdx === idx ? (
                <div className="space-y-2">
                  <textarea className="w-full bg-secondary rounded-lg p-3 text-sm outline-none min-h-[120px] text-foreground resize-none" value={editText} onChange={(e) => setEditText(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit}>저장</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingBlockIdx(null)}>취소</Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setEditingBlockIdx(idx); setEditText(block.content); }} className="w-full text-left">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{block.content}</p>
                  <Edit3 className="w-4 h-4 text-muted-foreground absolute top-2 right-2 opacity-60" />
                </button>
              )}
            </div>
          ) : (
            <div key={idx} className="bg-primary/10 border-2 border-dashed border-primary/30 rounded-[--radius] p-4 flex items-center gap-3">
              <Camera className="w-6 h-6 text-primary" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-primary">📸 사진{idx + 1} 여기 업로드 ▲</p>
                <p className="text-xs text-muted-foreground mt-0.5">{block.caption}</p>
              </div>
            </div>
          )
        )}
        {blocks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">본문이 없습니다</p>
        )}
      </div>

      {/* Hashtags */}
      <div className="bg-card rounded-[--radius] border border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Hash className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold flex-1">해시태그</p>
          <button onClick={() => setEditingHashtags(!editingHashtags)} className="text-xs text-primary font-medium">
            {editingHashtags ? "완료" : "수정"}
          </button>
        </div>
        {editingHashtags ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {hashtags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-sm gap-1 pr-1">
                  #{tag}
                  <button onClick={() => handleRemoveTag(i)} className="ml-1 p-0.5 hover:bg-destructive/20 rounded-full">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm outline-none text-foreground" value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)} placeholder="새 태그 입력" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }} />
              <Button size="sm" variant="outline" onClick={handleAddTag}><Plus className="w-4 h-4" /></Button>
            </div>
            <Button size="sm" onClick={handleFinishHashtags} className="w-full">완료</Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {hashtags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-sm">#{tag}</Badge>
            ))}
            {hashtags.length === 0 && <p className="text-xs text-muted-foreground">해시태그 없음</p>}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="bg-card rounded-[--radius] border border-border p-4 space-y-2 text-xs text-muted-foreground">
        <p>작성일: {post.createdAt}</p>
        <p>페르소나: {post.persona}</p>
        <p>플랫폼: {post.platforms.map(p => platformLabels[p]).join(", ")}</p>
      </div>

      {/* ─── Action Buttons ─── */}
      <div className="space-y-3">
        {/* Platform CTA buttons */}
        {orderedPlatforms.map((platform, i) => (
          <div key={platform}>
            <Button
              size={i === 0 ? "xl" : "lg"}
              className={`w-full gap-2 ${platformButtonStyles[platform]}`}
              onClick={() => handleCopyAndOpen(platform)}
            >
              <Copy className="w-5 h-5" />
              복사 후 {platformLabels[platform]} 열기
            </Button>
            {i === 0 && platform === "naver" && (
              <p className="text-[11px] text-center mt-1 text-muted-foreground">📋 붙여넣기 → 사진 첨부 → 발행</p>
            )}
          </div>
        ))}

        {orderedPlatforms.length > 0 && <div className="border-t border-border" />}

        {/* Mark as published */}
        {currentStatus !== "게시완료" && (
          <Button variant="outline" className="w-full gap-2 text-green-600 border-green-500/30 hover:bg-green-500/10" onClick={handleMarkPublished}>
            <CheckCircle2 className="w-5 h-5" />
            발행 완료로 표시
          </Button>
        )}

        {/* Shorts */}
        <Button variant="outline" className="w-full gap-2" onClick={() => {
          toast({ title: "🎬 이 글 기반으로 영상을 생성합니다" });
          onBack();
          onNavigate?.("camera");
        }}>
          <Film className="w-5 h-5" />
          쇼츠 영상 만들기
        </Button>

        {/* Regenerate */}
        <Button variant="outline" className="w-full gap-2" onClick={handleRegenerate}>
          <RefreshCw className="w-4 h-4" />
          AI 재생성
        </Button>

        {/* Temp save */}
        <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground" onClick={handleTempSave}>
          <Save className="w-4 h-4" />
          임시저장
        </Button>
      </div>
    </div>
  );
}

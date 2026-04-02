import { useState } from "react";
import { ArrowLeft, Edit3, Hash, Camera, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore, BlogPost, Platform } from "@/stores/appStore";
import { useToast } from "@/hooks/use-toast";

const platformLabels: Record<Platform, string> = {
  naver: "네이버 블로그",
  instagram: "인스타그램",
  tiktok: "틱톡",
};

const statusColor: Record<string, "success" | "warning" | "info" | "default"> = {
  "게시완료": "success",
  "완료": "info",
  "작성중": "warning",
  "AI생성중": "warning",
};

export function PostDetailPage({ post, onBack }: { post: BlogPost; onBack: () => void }) {
  const { updatePost } = useAppStore();
  const { toast } = useToast();
  const [title, setTitle] = useState(post.title);
  const [blocks, setBlocks] = useState(post.blocks);
  const [hashtags, setHashtags] = useState(post.hashtags);
  const [editingBlockIdx, setEditingBlockIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editingHashtags, setEditingHashtags] = useState(false);
  const [hashtagText, setHashtagText] = useState(post.hashtags.join(", "));

  const handleSaveEdit = () => {
    if (editingBlockIdx === null) return;
    const newBlocks = blocks.map((b, i) => (i === editingBlockIdx ? { ...b, content: editText } : b));
    setBlocks(newBlocks);
    setEditingBlockIdx(null);
    updatePost(post.id, { blocks: newBlocks });
  };

  const handleSaveTitle = () => {
    updatePost(post.id, { title });
    toast({ title: "✅ 제목이 수정되었습니다." });
  };

  const handleSaveHashtags = () => {
    const newTags = hashtagText.split(",").map(t => t.trim()).filter(Boolean);
    setHashtags(newTags);
    setEditingHashtags(false);
    updatePost(post.id, { hashtags: newTags });
  };

  const getClipboardText = () => {
    let text = title + "\n\n";
    blocks.forEach((block) => {
      if (block.type === "text") text += block.content + "\n\n";
      else text += `[📸 ${block.caption || "사진"}]\n\n`;
    });
    text += hashtags.map((t) => `#${t}`).join(" ");
    return text;
  };

  const handleCopyAndOpen = async (platform: Platform) => {
    try {
      await navigator.clipboard.writeText(getClipboardText());
      toast({ title: `✅ 글이 복사되었습니다! ${platformLabels[platform]}을 열어주세요.` });
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
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-[--radius] hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">글 상세</h1>
        <Badge variant={statusColor[post.status] || "default"}>{post.status}</Badge>
      </div>

      {/* Title */}
      <div className="bg-card rounded-[--radius] border border-border p-4">
        <label className="text-xs text-muted-foreground mb-1 block">제목</label>
        <input
          className="w-full bg-transparent text-lg font-bold outline-none text-foreground"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSaveTitle}
        />
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

      {/* Content Blocks */}
      {blocks.length > 0 ? (
        <div className="space-y-3">
          {blocks.map((block, idx) =>
            block.type === "text" ? (
              <div key={idx} className="bg-card rounded-[--radius] border border-border p-4 relative group">
                {editingBlockIdx === idx ? (
                  <div className="space-y-2">
                    <textarea
                      className="w-full bg-secondary rounded-lg p-3 text-sm outline-none min-h-[100px] text-foreground resize-none"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveEdit}>저장</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingBlockIdx(null)}>취소</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{block.content}</p>
                    <button
                      onClick={() => { setEditingBlockIdx(idx); setEditText(block.content); }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary p-1.5 rounded-lg"
                    >
                      <Edit3 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div key={idx} className="bg-primary/10 border-2 border-dashed border-primary/30 rounded-[--radius] p-4 flex items-center gap-3">
                <Camera className="w-6 h-6 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold text-sm text-primary">사진 위치</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{block.caption}</p>
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="bg-card rounded-[--radius] border border-border p-6 text-center text-muted-foreground text-sm">
          아직 본문이 생성되지 않았습니다.
        </div>
      )}

      {/* Hashtags */}
      <div className="bg-card rounded-[--radius] border border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Hash className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold flex-1">해시태그</p>
          <button onClick={() => { setEditingHashtags(!editingHashtags); setHashtagText(hashtags.join(", ")); }}
            className="text-xs text-primary font-medium">
            {editingHashtags ? "취소" : "수정"}
          </button>
        </div>
        {editingHashtags ? (
          <div className="space-y-2">
            <input
              className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none text-foreground"
              value={hashtagText}
              onChange={(e) => setHashtagText(e.target.value)}
              placeholder="쉼표로 구분 (예: 옥상방수, 방수공사)"
            />
            <Button size="sm" onClick={handleSaveHashtags}>저장</Button>
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

      {/* Re-publish buttons */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">플랫폼별 업로드</p>
        {post.platforms.map((p) => (
          <Button key={p} variant="outline" className="w-full justify-start gap-3" onClick={() => handleCopyAndOpen(p)}>
            <Copy className="w-4 h-4" />
            {platformLabels[p]}에 복사 후 열기
            <ExternalLink className="w-4 h-4 ml-auto" />
          </Button>
        ))}
      </div>

      {/* Meta info */}
      <div className="bg-card rounded-[--radius] border border-border p-4 space-y-2 text-xs text-muted-foreground">
        <p>작성일: {post.createdAt}</p>
        <p>공사 유형: {post.workType}</p>
        <p>페르소나: {post.persona}</p>
        <p>플랫폼: {post.platforms.map(p => platformLabels[p]).join(", ")}</p>
      </div>
    </div>
  );
}

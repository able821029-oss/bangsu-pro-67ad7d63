import { useState, useEffect } from "react";
import { Sparkles, Upload, Edit3, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore, PostStyle, ContentBlock, BlogPost } from "@/stores/appStore";
import type { TabId } from "@/components/BottomNav";

const styles: PostStyle[] = ["시공일지형", "업체홍보형", "상담유도형", "후기강조형"];

const styleEmoji: Record<PostStyle, string> = {
  "시공일지형": "📋",
  "업체홍보형": "🏢",
  "상담유도형": "📞",
  "후기강조형": "⭐",
};

export function WriterTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const { photos, selectedWorkType, selectedStyle, setSelectedStyle, setCurrentPost, addPost } = useAppStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generated, setGenerated] = useState(false);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [editingBlockIdx, setEditingBlockIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  // Mock AI generation
  const handleGenerate = () => {
    setIsGenerating(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          setGenerated(true);
          generateMockContent();
          return 100;
        }
        return p + 5;
      });
    }, 100);
  };

  const generateMockContent = () => {
    const wt = selectedWorkType || "옥상방수";
    setTitle(`${wt} 전문 시공 현장 리포트 - 완벽한 방수 솔루션`);
    const mockBlocks: ContentBlock[] = [
      { type: "text", content: `안녕하세요, 방수 전문 시공 업체입니다.\n\n오늘은 ${wt} 현장을 찾아왔습니다. 기존 방수층의 노후화로 인한 누수 문제를 해결하기 위해 전면 재시공을 진행했습니다.` },
      { type: "photo", content: photos[0]?.id || "photo-1", caption: "시공 전 현장 상태 - 기존 방수층 균열 확인" },
      { type: "text", content: "우선 기존 방수층을 완전히 제거하고, 바탕면 정리 작업을 실시했습니다. 이 과정이 가장 중요한데, 바탕면이 깨끗하지 않으면 새로운 방수층의 접착력이 떨어집니다." },
      { type: "photo", content: photos[1]?.id || "photo-2", caption: "바탕면 정리 후 프라이머 도포" },
      { type: "text", content: "프라이머 도포 후 충분한 건조 시간을 거쳐 우레탄 방수 1차 도포를 진행했습니다. 방수층의 두께가 균일하게 되도록 꼼꼼하게 시공했습니다." },
      { type: "photo", content: photos[2]?.id || "photo-3", caption: "우레탄 방수 2차 도포 완료" },
      { type: "text", content: "2차 도포까지 완료 후 마감 작업을 진행했습니다. 방수 시공은 한 번에 끝나는 것이 아니라, 정확한 공정과 충분한 건조 시간이 핵심입니다.\n\n방수 관련 문의는 언제든 연락 주세요!" },
    ];
    setBlocks(mockBlocks);
    setHashtags(["방수공사", wt, "방수전문업체", "누수해결", "방수시공"]);
  };

  const handleEditBlock = (idx: number) => {
    if (blocks[idx].type === "text") {
      setEditingBlockIdx(idx);
      setEditText(blocks[idx].content);
    }
  };

  const handleSaveEdit = () => {
    if (editingBlockIdx === null) return;
    setBlocks((prev) =>
      prev.map((b, i) => (i === editingBlockIdx ? { ...b, content: editText } : b))
    );
    setEditingBlockIdx(null);
  };

  const handleGoToUpload = () => {
    const post: BlogPost = {
      id: crypto.randomUUID(),
      title,
      photos,
      workType: selectedWorkType || "옥상방수",
      style: selectedStyle,
      blocks,
      hashtags,
      status: "완료",
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setCurrentPost(post);
    addPost(post);
    onNavigate("upload");
  };

  useEffect(() => {
    if (!generated && photos.length > 0) {
      handleGenerate();
    }
  }, []);

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        AI 글쓰기
      </h1>

      {/* Style Selection */}
      <div>
        <p className="text-sm font-semibold mb-2">글 스타일</p>
        <div className="flex gap-2 overflow-x-auto">
          {styles.map((s) => (
            <Badge
              key={s}
              variant={selectedStyle === s ? "chipActive" : "chip"}
              className="text-sm px-3 py-1.5 shrink-0 cursor-pointer"
              onClick={() => {
                setSelectedStyle(s);
                if (generated) handleGenerate();
              }}
            >
              {styleEmoji[s]} {s}
            </Badge>
          ))}
        </div>
      </div>

      {/* Progress */}
      {isGenerating && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary animate-spin" />
            <p className="font-semibold">AI가 글을 작성하고 있습니다...</p>
          </div>
          <div className="w-full bg-secondary rounded-full h-3">
            <div
              className="bg-primary rounded-full h-3 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {progress < 30 ? "사진 분석 중..." : progress < 60 ? "본문 작성 중..." : progress < 90 ? "해시태그 생성 중..." : "마무리 중..."}
          </p>
        </div>
      )}

      {/* Generated Content */}
      {generated && !isGenerating && (
        <>
          {/* Title */}
          <div className="bg-card rounded-xl border border-border p-4">
            <label className="text-xs text-muted-foreground mb-1 block">제목</label>
            <input
              className="w-full bg-transparent text-lg font-bold outline-none text-foreground"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Content Blocks */}
          <div className="space-y-3">
            {blocks.map((block, idx) =>
              block.type === "text" ? (
                <div key={idx} className="bg-card rounded-xl border border-border p-4 relative group">
                  {editingBlockIdx === idx ? (
                    <div className="space-y-2">
                      <textarea
                        className="w-full bg-secondary rounded-lg p-3 text-sm outline-none min-h-[100px] text-foreground resize-none"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                      />
                      <Button size="sm" onClick={handleSaveEdit}>저장</Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{block.content}</p>
                      <button
                        onClick={() => handleEditBlock(idx)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary p-1.5 rounded-lg"
                      >
                        <Edit3 className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div
                  key={idx}
                  className="bg-primary/10 border-2 border-dashed border-primary/30 rounded-xl p-4 flex items-center gap-3"
                >
                  <span className="text-2xl">📸</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-primary">
                      사진{idx} 여기 업로드 ▲
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{block.caption}</p>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Hashtags */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Hash className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">해시태그</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {hashtags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-sm">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Go to Upload */}
          <Button variant="hero" size="xl" className="w-full" onClick={handleGoToUpload}>
            <Upload className="w-6 h-6" />
            업로드 화면으로
          </Button>
        </>
      )}
    </div>
  );
}

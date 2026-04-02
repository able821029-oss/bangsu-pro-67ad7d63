import { useState, useEffect } from "react";
import {
  Sparkles, Copy, ExternalLink, AlertTriangle, Edit3, Hash,
  CheckCircle2, Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore, ContentBlock, BlogPost, Platform } from "@/stores/appStore";
import type { TabId } from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";

const platformLabels: Record<Platform, string> = {
  naver: "네이버 블로그",
  instagram: "인스타그램",
  tiktok: "틱톡",
};

const steps = [
  { label: "AI 글 완성", tag: "앱 자동", auto: true },
  { label: "클립보드 복사", tag: "앱 자동", auto: true },
  { label: "네이버 앱 실행", tag: "앱 자동", auto: true },
  { label: "붙여넣기 + 사진첨부 + 발행", tag: "사장님 직접", auto: false },
];

export function PublishTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const {
    photos, selectedWorkType, selectedStyle, selectedPlatforms, selectedPersona,
    setCurrentPost, addPost, currentPost,
  } = useAppStore();
  const { toast } = useToast();

  const [activePlatform, setActivePlatform] = useState<Platform>(selectedPlatforms[0] || "naver");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generated, setGenerated] = useState(!!currentPost);
  const [title, setTitle] = useState(currentPost?.title || "");
  const [blocks, setBlocks] = useState<ContentBlock[]>(currentPost?.blocks || []);
  const [hashtags, setHashtags] = useState<string[]>(currentPost?.hashtags || []);
  const [editingBlockIdx, setEditingBlockIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-generate when arriving from camera with photos
  useEffect(() => {
    if (!generated && photos.length > 0 && !isGenerating) {
      handleGenerate();
    }
  }, []);

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
      { type: "text", content: "우선 기존 방수층을 완전히 제거하고, 바탕면 정리 작업을 실시했습니다." },
      { type: "photo", content: photos[1]?.id || "photo-2", caption: "바탕면 정리 후 프라이머 도포" },
      { type: "text", content: "프라이머 도포 후 충분한 건조 시간을 거쳐 우레탄 방수 1차 도포를 진행했습니다." },
      { type: "photo", content: photos[2]?.id || "photo-3", caption: "우레탄 방수 2차 도포 완료" },
      { type: "text", content: "2차 도포까지 완료 후 마감 작업을 진행했습니다.\n\n방수 관련 문의는 언제든 연락 주세요!" },
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

  const getClipboardText = () => {
    let text = title + "\n\n";
    blocks.forEach((block) => {
      if (block.type === "text") {
        text += block.content + "\n\n";
      } else {
        text += `[📸 ${block.caption || "사진 업로드"}]\n\n`;
      }
    });
    text += hashtags.map((t) => `#${t}`).join(" ");
    return text;
  };

  const handleCopyAndOpen = async () => {
    // Save the post first
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
      platforms: selectedPlatforms,
      persona: selectedPersona,
    };
    setCurrentPost(post);
    addPost(post);

    setIsProcessing(true);
    setCurrentStep(1);
    await new Promise((r) => setTimeout(r, 600));

    try {
      await navigator.clipboard.writeText(getClipboardText());
      toast({ title: "✅ 글이 클립보드에 복사되었습니다!" });
    } catch {
      toast({ title: "클립보드 복사에 실패했습니다.", variant: "destructive" });
    }
    setCurrentStep(2);
    await new Promise((r) => setTimeout(r, 600));

    setCurrentStep(3);
    if (activePlatform === "naver") {
      window.location.href = "naver://blog/write";
      setTimeout(() => window.open("https://blog.naver.com/", "_blank"), 2000);
    } else if (activePlatform === "instagram") {
      window.open("https://www.instagram.com/", "_blank");
    } else {
      window.open("https://www.tiktok.com/", "_blank");
    }
    setIsProcessing(false);
  };

  const hasContent = generated && !isGenerating;

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold">📤 게시</h1>
        <Badge variant="warning" className="text-xs">반자동</Badge>
      </div>

      {/* Platform Tabs */}
      {selectedPlatforms.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {selectedPlatforms.map((p) => (
            <Badge
              key={p}
              variant={activePlatform === p ? "chipActive" : "chip"}
              className="text-sm px-3 py-1.5 cursor-pointer shrink-0"
              onClick={() => setActivePlatform(p)}
            >
              {platformLabels[p]}
            </Badge>
          ))}
        </div>
      )}

      {/* AI Generation Progress */}
      {isGenerating && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary animate-spin" />
            <p className="font-semibold">AI가 글을 작성하고 있습니다...</p>
          </div>
          <div className="w-full bg-secondary rounded-full h-3">
            <div className="bg-primary rounded-full h-3 transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {progress < 30 ? "사진 분석 중..." : progress < 60 ? "본문 작성 중..." : progress < 90 ? "해시태그 생성 중..." : "마무리 중..."}
          </p>
        </div>
      )}

      {/* No content state */}
      {!generated && !isGenerating && photos.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-8 text-center space-y-3">
          <Sparkles className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            촬영 탭에서 사진을 먼저 촬영하고<br />AI 글쓰기를 시작해주세요
          </p>
          <Button variant="outline" onClick={() => onNavigate("camera")}>촬영하러 가기</Button>
        </div>
      )}

      {/* Generated Content Preview */}
      {hasContent && (
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
                <div key={idx} className="bg-primary/10 border-2 border-dashed border-primary/30 rounded-xl p-4 flex items-center gap-3">
                  <span className="text-2xl">📸</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-primary">사진{idx} 여기 업로드 ▲</p>
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
                <Badge key={i} variant="secondary" className="text-sm">#{tag}</Badge>
              ))}
            </div>
          </div>

          {/* Notice */}
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning">안내</p>
              <p className="text-xs text-muted-foreground mt-1">
                네이버 블로그 API는 2020년 5월 공식 종료되었습니다. 아래 반자동 방식으로 진행합니다.
              </p>
            </div>
          </div>

          {/* Upload Steps */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-4">
            <p className="text-sm font-semibold">업로드 4단계</p>
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                {currentStep > i ? (
                  <CheckCircle2 className="w-6 h-6 text-success shrink-0" />
                ) : currentStep === i && isProcessing ? (
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                ) : (
                  <Circle className="w-6 h-6 text-muted-foreground shrink-0" />
                )}
                <p className={`text-sm font-medium flex-1 ${currentStep > i ? "text-success" : currentStep === i ? "text-foreground" : "text-muted-foreground"}`}>
                  {i + 1}단계. {step.label}
                </p>
                <Badge variant={step.auto ? "info" : "warning"} className="text-xs shrink-0">{step.tag}</Badge>
              </div>
            ))}
          </div>

          {/* Action Button */}
          <Button variant="hero" size="xl" className="w-full" onClick={handleCopyAndOpen} disabled={isProcessing}>
            <Copy className="w-6 h-6" />
            내용 복사 후 {platformLabels[activePlatform]} 열기
          </Button>

          {currentStep >= 3 && (
            <div className="bg-success/10 border border-success/30 rounded-xl p-4 text-center space-y-2">
              <p className="text-sm font-semibold text-success">✅ 복사 완료!</p>
              <p className="text-xs text-muted-foreground">
                {platformLabels[activePlatform]}에서 <strong>붙여넣기</strong> → <strong>사진 첨부</strong> → <strong>발행</strong> 해주세요
              </p>
              <Button variant="outline" size="sm" onClick={() => { window.location.href = "naver://blog/write"; }}>
                <ExternalLink className="w-4 h-4" />
                앱 다시 열기
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

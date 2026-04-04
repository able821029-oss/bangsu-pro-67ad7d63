import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Edit3,
  Hash,
  Camera,
  Copy,
  RefreshCw,
  Save,
  X,
  Plus,
  Film,
  CheckCircle2,
  Loader2,
  Check,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { SeoScoreBadge } from "@/components/SeoScoreBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAppStore, BlogPost, Platform, ContentBlock } from "@/stores/appStore";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { TabId } from "@/components/BottomNav";
import { ShortsCreator } from "@/components/ShortsCreator";

const platformLabels: Record<Platform, string> = {
  naver: "네이버 블로그",
  instagram: "인스타그램",
  tiktok: "틱톡",
};

const statusBadgeVariant: Record<string, "default" | "info" | "success"> = {
  작성중: "default",
  AI생성중: "default",
  완료: "info",
  게시완료: "success",
};

export function PostDetailPage({
  post,
  onBack,
  onNavigate,
}: {
  post: BlogPost;
  onBack: () => void;
  onNavigate?: (tab: TabId) => void;
}) {
  const { updatePost, updatePostStatus } = useAppStore();
  const subscription = useAppStore((s) => s.subscription);
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
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(post.status);
  const [seoResult, setSeoResult] = useState<any>(null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [showShortsCreator, setShowShortsCreator] = useState(false);
  const [uploadGuide, setUploadGuide] = useState<Platform | null>(null);
  const [returnPrompt, setReturnPrompt] = useState(false);


  useEffect(() => {
    if (blocks.length > 0 && blocks.some((b) => b.type === "text" && b.content)) {
      handleAutoSeoAnalyze();
    }
  }, []);

  // SNS 앱에서 복귀 감지
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && sessionStorage.getItem("sms-publishing")) {
        sessionStorage.removeItem("sms-publishing");
        setReturnPrompt(true);
        setTimeout(() => setReturnPrompt(false), 5000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const handleAutoSeoAnalyze = async () => {
    setSeoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seo-analyze", {
        body: { mode: "seo_score", title, blocks, hashtags, location: "", workType: post.workType },
      });
      if (!error && !data?.error) setSeoResult(data);
    } catch {
    } finally {
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
    toast({ title: "제목이 수정되었습니다." });
  };

  const handleSaveEdit = async () => {
    if (editingBlockIdx === null) return;
    const newBlocks = blocks.map((b, i) => (i === editingBlockIdx ? { ...b, content: editText } : b));
    setBlocks(newBlocks);
    setEditingBlockIdx(null);
    updatePost(post.id, { blocks: newBlocks });
    await saveToDb({ blocks: newBlocks });
    toast({ title: "본문이 수정되었습니다." });
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
    toast({ title: "해시태그가 저장되었습니다." });
  };

  const handleTempSave = async () => {
    updatePost(post.id, { title, blocks, hashtags });
    await saveToDb({ title, blocks, hashtags });
    toast({ title: "임시저장 완료", duration: 2000 });
  };

  const handleMarkPublished = async () => {
    updatePostStatus(post.id, "게시완료");
    setCurrentStatus("게시완료");
    await saveToDb({ status: "게시완료" });
    toast({ title: "게시완료로 변경되었습니다" });
  };

  const handleRegenerate = async () => {
    if (currentStatus === "게시완료") {
      const confirmed = window.confirm("재생성하면 현재 본문이 교체됩니다.\n계속하시겠습니까?");
      if (!confirmed) return;
    }
    setIsRegenerating(true);
    toast({ title: "AI가 글을 다시 생성합니다.", description: "잠시만 기다려주세요..." });
    try {
      const { data, error } = await supabase.functions.invoke("generate-blog", {
        body: {
          photos: post.photos.slice(0, 5).map((p) => ({ dataUrl: p.dataUrl })),
          persona: post.persona,
          platform: post.platforms[0],
          location: "",
          buildingType: "AI자동판단",
          constructionDate: post.createdAt,
        },
      });
      if (!error && !data?.error) {
        setTitle(data.title);
        setBlocks(data.blocks);
        setHashtags(data.hashtags);
        updatePost(post.id, { title: data.title, blocks: data.blocks, hashtags: data.hashtags });
        await saveToDb({ title: data.title, blocks: data.blocks, hashtags: data.hashtags });
        toast({ title: "AI 재생성 완료" });
      } else {
        toast({ title: "재생성 실패", description: "다시 시도해주세요", variant: "destructive" });
      }
    } catch {
      toast({ title: "재생성 실패", variant: "destructive" });
    } finally {
      setIsRegenerating(false);
    }
  };

  const getClipboardText = (platform: Platform) => {
    if (platform === "instagram") {
      const textContent = blocks
        .filter((b) => b.type === "text")
        .map((b) => b.content)
        .join(" ");
      return (
        textContent.slice(0, 150) +
        "\n\n" +
        hashtags
          .slice(0, 20)
          .map((t) => `#${t}`)
          .join(" ")
      );
    }
    if (platform === "tiktok") {
      const lines = blocks
        .filter((b) => b.type === "text")
        .map((b) => b.content)
        .join("\n")
        .split(/\n+/)
        .filter(Boolean)
        .slice(0, 3);
      return (
        lines.join("\n") +
        "\n\n" +
        hashtags
          .slice(0, 5)
          .map((t) => `#${t}`)
          .join(" ")
      );
    }
    let text = title + "\n\n";
    blocks.forEach((block, idx) => {
      if (block.type === "text") text += block.content + "\n\n";
      else text += `[사진${idx + 1} 여기에 첨부]\n\n`;
    });
    return (
      text +
      hashtags
        .slice(0, 10)
        .map((t) => `#${t}`)
        .join(" ")
    );
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
      setUploadGuide(platform);
    } catch {
      toast({ title: "클립보드 복사 실패", variant: "destructive" });
    }
  };

  const handleOpenPlatform = (platform: Platform) => {
    sessionStorage.setItem("sms-publishing", "true");
    setUploadGuide(null);
    window.location.href = deeplinks[platform];
  };

  const orderedPlatforms = ["naver", "instagram", "tiktok"].filter((p) =>
    post.platforms.includes(p as Platform),
  ) as Platform[];

  const platformIcons: Record<Platform, string> = {
    naver: "🟢", instagram: "🟣", tiktok: "⬛",
  };

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">

      {/* SNS 복귀 감지 토스트 */}
      {returnPrompt && (
        <div
          className="fixed top-0 left-0 right-0 z-[90] max-w-lg mx-auto px-4 pt-4"
          style={{ animation: "fadeUp .3s ease-out" }}
        >
          <div className="bg-green-600 text-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-sm font-semibold flex-1">SMS로 돌아왔습니다! 발행 완료로 표시하시겠어요?</p>
            <button
              onClick={() => { handleMarkPublished(); setReturnPrompt(false); }}
              className="text-xs font-bold bg-white/20 px-2 py-1 rounded-lg"
            >완료</button>
          </div>
        </div>
      )}

      {/* 업로드 안내 오버레이 */}
      {uploadGuide && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center" onClick={() => setUploadGuide(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-lg bg-card rounded-t-2xl p-5 pb-8 space-y-4"
            onClick={e => e.stopPropagation()}
            style={{ animation: "slideUp .3s ease-out" }}
          >
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto" />

            {/* 복사 완료 표시 */}
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-600">클립보드 복사 완료!</p>
                <p className="text-xs text-muted-foreground">{platformLabels[uploadGuide]}에 붙여넣기 하세요</p>
              </div>
            </div>

            {/* 업로드 순서 */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">업로드 순서</p>
              {uploadGuide === "naver" ? (
                <div className="space-y-1.5 text-sm">
                  <p>① 아래 버튼으로 네이버 블로그 열기</p>
                  <p>② 새 글 작성 → 본문 영역 길게 터치 → 붙여넣기</p>
                  <p>③ 현장 사진 첨부 후 발행</p>
                  <p>④ SMS 앱으로 돌아오기</p>
                </div>
              ) : (
                <div className="space-y-1.5 text-sm">
                  <p>① 아래 버튼으로 {platformLabels[uploadGuide]} 열기</p>
                  <p>② 새 게시물 → 붙여넣기 → 사진 선택</p>
                  <p>③ 업로드 완료 후 SMS 앱으로 복귀</p>
                </div>
              )}
            </div>

            {/* SMS 복귀 안내 */}
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
                <defs><linearGradient id="retSg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#237FFF"/><stop offset="100%" stopColor="#AB5EBE"/></linearGradient></defs>
                <rect width="64" height="64" rx="14" fill="url(#retSg)"/>
                <text x="8" y="52" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="52" fill="#FFFFFF">S</text>
              </svg>
              <p className="text-xs text-muted-foreground flex-1">
                업로드 후 <span className="text-primary font-semibold">SMS 아이콘</span>을 탭하거나<br/>
                스마트폰 뒤로가기로 SMS로 돌아오세요
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setUploadGuide(null)}>취소</Button>
              <Button
                onClick={() => handleOpenPlatform(uploadGuide)}
                style={{ background: "linear-gradient(135deg, #237FFF, #AB5EBE)", color: "white" }}
              >
                {platformLabels[uploadGuide]} 열기 →
              </Button>
            </div>
          </div>
        </div>
      )}
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

      {/* 제목 */}
      <div className="bg-card rounded-[--radius] border border-border p-4">
        <label className="text-xs text-muted-foreground mb-1 block">제목</label>
        {isEditingTitle ? (
          <div className="space-y-2">
            <input
              className="w-full bg-secondary rounded-lg px-3 py-2 text-lg font-bold outline-none text-foreground"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveTitle}>
                저장
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditingTitle(false);
                  setTitle(post.title);
                }}
              >
                취소
              </Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setIsEditingTitle(true)} className="w-full text-left group relative">
            <p className="text-lg font-bold">{title}</p>
            <Edit3 className="w-4 h-4 text-muted-foreground absolute top-0 right-0 opacity-60" />
          </button>
        )}
      </div>

      {/* 사진 */}
      {post.photos.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2">첨부 사진 ({post.photos.length}장)</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {post.photos.map((photo) => (
              <div
                key={photo.id}
                className="shrink-0 w-24 h-24 rounded-[--radius] overflow-hidden border-2 border-border"
              >
                <img src={photo.dataUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 본문 */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">본문</p>
        {blocks.map((block, idx) =>
          block.type === "text" ? (
            <div key={idx} className="bg-card rounded-[--radius] border border-border p-4 relative group">
              {editingBlockIdx === idx ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full bg-secondary rounded-lg p-3 text-sm outline-none min-h-[120px] text-foreground resize-none"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit}>
                      저장
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingBlockIdx(null)}>
                      취소
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingBlockIdx(idx);
                    setEditText(block.content);
                  }}
                  className="w-full text-left"
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{block.content}</p>
                  <Edit3 className="w-4 h-4 text-muted-foreground absolute top-2 right-2 opacity-60" />
                </button>
              )}
            </div>
          ) : (
            <div
              key={idx}
              className="bg-primary/10 border-2 border-dashed border-primary/30 rounded-[--radius] p-4 flex items-center gap-3"
            >
              <Camera className="w-6 h-6 text-primary" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-primary">사진{idx + 1} 여기 업로드</p>
                <p className="text-xs text-muted-foreground mt-0.5">{block.caption}</p>
              </div>
            </div>
          ),
        )}
        {blocks.length === 0 && (
          <div className="text-center py-8 space-y-3 bg-card rounded-[--radius] border border-border">
            <p className="text-sm text-muted-foreground">아직 본문이 생성되지 않았습니다</p>
            <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={isRegenerating}>
              {isRegenerating ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-1" />
              )}
              AI 글쓰기 시작
            </Button>
          </div>
        )}
      </div>

      {/* 해시태그 */}
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
                  <button
                    onClick={() => handleRemoveTag(i)}
                    className="ml-1 p-0.5 hover:bg-destructive/20 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="새 태그 입력"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button size="sm" variant="outline" onClick={handleAddTag}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <Button size="sm" onClick={handleFinishHashtags} className="w-full">
              완료
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {hashtags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-sm">
                #{tag}
              </Badge>
            ))}
            {hashtags.length === 0 && <p className="text-xs text-muted-foreground">해시태그 없음</p>}
          </div>
        )}
      </div>

      {/* SEO 점수 */}
      {(seoResult || seoLoading) && (
        <div className="bg-card rounded-[--radius] border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold flex-1">SEO 점수 분석</p>
            {seoResult && (
              <button onClick={handleAutoSeoAnalyze} className="text-xs text-primary flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> 재분석
              </button>
            )}
          </div>
          {seoLoading && !seoResult ? (
            <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">SEO 분석 중...</span>
            </div>
          ) : seoResult ? (
            <>
              <div className="flex items-center gap-3">
                <span className={`text-3xl font-extrabold ${seoScoreColor(seoResult.totalScore)}`}>
                  {seoResult.totalScore}점
                </span>
                <div className="flex-1">
                  <Progress value={seoResult.totalScore} className="h-2" />
                </div>
              </div>
              {seoResult.checklist && (
                <div className="space-y-1.5">
                  {seoResult.checklist.map((item: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      {item.passed ? (
                        <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
                      )}
                      <span className="flex-1">{item.label}</span>
                      <span className="text-muted-foreground">
                        {item.current} → {item.recommend}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {seoResult.items && (
                <div className="grid grid-cols-2 gap-2">
                  {seoResult.items.slice(0, 4).map((item: any, i: number) => (
                    <div key={i} className="bg-secondary/50 rounded-lg px-2 py-1.5 text-xs">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className={`ml-1 font-bold ${seoScoreColor(item.score)}`}>{item.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      <div className="bg-card rounded-[--radius] border border-border p-4 space-y-2 text-xs text-muted-foreground">
        <p>작성일: {post.createdAt}</p>
        <p>페르소나: {post.persona}</p>
        <p>플랫폼: {post.platforms.map((p) => platformLabels[p]).join(", ")}</p>
      </div>

      {/* 액션 버튼 */}
      <div className="space-y-2">
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
              <p className="text-[11px] text-center mt-1 text-muted-foreground">붙여넣기 → 사진 첨부 → 발행</p>
            )}
          </div>
        ))}

        {orderedPlatforms.length > 0 && <div className="border-t border-border" />}

        {currentStatus !== "게시완료" && (
          <Button
            variant="outline"
            className="w-full gap-2 text-green-600 border-green-500/30 hover:bg-green-500/10"
            onClick={handleMarkPublished}
          >
            <CheckCircle2 className="w-5 h-5" />
            발행 완료로 표시
          </Button>
        )}

        {/* 쇼츠 영상 — 테스트 모드: 사진 조건 없이 바로 실행 */}
        <div>
          <Button
            variant="outline"
            className="w-full gap-2"
            style={{ background: "linear-gradient(135deg, #237FFF 0%, #AB5EBE 100%)", color: "white", border: "none" }}
            onClick={() => setShowShortsCreator(true)}
          >
            <Film className="w-5 h-5" />
            쇼츠 영상 만들기
            <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">테스트</span>
          </Button>
        </div>

        {/* ShortsCreator 오버레이 */}
        {showShortsCreator && (
          <div className="fixed inset-0 z-[80] bg-background overflow-y-auto">
            <ShortsCreator onClose={() => setShowShortsCreator(false)} />
          </div>
        )}



        <Button variant="secondary" className="w-full gap-2" onClick={handleRegenerate} disabled={isRegenerating}>
          <RefreshCw className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`} />
          {isRegenerating ? "재생성 중..." : "AI 재생성"}
        </Button>

        <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground" onClick={handleTempSave}>
          <Save className="w-4 h-4" />
          임시저장
        </Button>
      </div>
    </div>
  );
}

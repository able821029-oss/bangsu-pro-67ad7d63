import { useRef, useState, useEffect } from "react";
import {
  Camera,
  ImagePlus,
  X,
  Sparkles,
  MapPin,
  CalendarDays,
  CheckCircle2,
  Loader2,
  PenLine,
  ArrowLeft,
  Plus,
  Type,
} from "lucide-react";
import { KeywordRecommender } from "@/components/KeywordRecommender";
import { PlatformChip } from "@/components/PlatformChip";
import { useAppStore, Platform, Persona, BlogPost, ContentBlock, DraftSection, createEmptySection, photoSrc } from "@/stores/appStore";
import type { TabId } from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { compressPhotos } from "@/lib/imageCompress";
import { uploadPostPhotos } from "@/lib/uploadPostPhoto";
import { SectionCard } from "@/pages/BlogWriterTab";
import { buildSafeTitle, buildDefaultHashtags, hasMinimumContent, normalizeHashtags } from "@/lib/postQuality";

const platformIds: Platform[] = ["naver", "instagram", "tiktok"];

const personas: { id: Persona; label: string; desc: string }[] = [
  { id: "장인형", label: "장인형", desc: "30년 경력의 장인 느낌" },
  { id: "친근형", label: "친근형", desc: "이웃집 아저씨같은 친근함" },
  { id: "전문기업형", label: "전문기업형", desc: "체계적인 전문 기업 이미지" },
];

type GeneratingStep = "analyzing" | "writing" | "done" | "error";
type WizardStep = 1 | 2;

export function CameraTab({
  onNavigate,
  onViewPost,
}: {
  onNavigate: (tab: TabId) => void;
  onViewPost: (post: BlogPost) => void;
}) {
  const {
    photos,
    selectedPlatforms,
    selectedPersona,
    addPhoto,
    removePhoto,
    togglePlatform,
    setSelectedPersona,
    addPost,
    settings,
  } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [title, setTitle] = useState("");            // 제목 (Step 1에서 입력 or Step 2에서 편집)
  const [location, setLocation] = useState("");
  const [constructionDate, setConstructionDate] = useState(new Date().toISOString().slice(0, 10));
  const [siteArea, setSiteArea] = useState("");      // 시공면적
  const [siteMethod, setSiteMethod] = useState("");  // 공법
  const [siteEtc, setSiteEtc] = useState("");        // 기타
  const [isLocating, setIsLocating] = useState(false);
  const [gpsTimedOut, setGpsTimedOut] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  // Step 2 (편집 화면) — 3블록 구조의 섹션 편집용 local state
  const [editSections, setEditSections] = useState<DraftSection[]>([createEmptySection()]);
  const [editHashtags, setEditHashtags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState<GeneratingStep>("analyzing");

  // ── 임시저장 키 ──
  const DRAFT_KEY = "sms_draft_blog";

  // ── 작성 중 이탈 방지 ──
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (photos.length > 0 || wizardStep === 2) {
        saveDraft();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [photos, wizardStep, location, constructionDate, siteArea, siteMethod, siteEtc, selectedPlatforms, selectedPersona]);

  // ── 임시저장 함수 ──
  const saveDraft = () => {
    if (photos.length === 0) return;
    const draft = {
      photos: photos.map(p => ({ id: p.id, dataUrl: p.dataUrl })),
      location,
      constructionDate,
      siteArea,
      siteMethod,
      siteEtc,
      platforms: [...selectedPlatforms],
      persona: selectedPersona,
      wizardStep,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  };

  // ── 임시저장 복원 체크 ──
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw || photos.length > 0) return;
    try {
      const draft = JSON.parse(raw);
      if (draft.photos?.length > 0) {
        setShowDraftBanner(true);
      }
    } catch {}
  }, []);

  const restoreDraft = () => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      draft.photos?.forEach((p: any) => addPhoto(p));
      if (draft.location) setLocation(draft.location);
      if (draft.constructionDate) setConstructionDate(draft.constructionDate);
      if (draft.siteArea) setSiteArea(draft.siteArea);
      if (draft.siteMethod) setSiteMethod(draft.siteMethod);
      if (draft.siteEtc) setSiteEtc(draft.siteEtc);
      if (draft.persona) setSelectedPersona(draft.persona);
      if (draft.wizardStep === 2) setWizardStep(2);
      toast({ title: "임시저장된 글을 불러왔습니다" });
    } catch {}
    setShowDraftBanner(false);
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setShowDraftBanner(false);
  };
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!location && navigator.geolocation) {
      setIsLocating(true);
      const timeoutId = setTimeout(() => {
        setIsLocating(false);
        setGpsTimedOut(true);
      }, 10000);

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          clearTimeout(timeoutId);
          try {
            const { latitude, longitude } = pos.coords;
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ko`,
            );
            const data = await res.json();
            const addr = data.address;
            const loc = addr?.borough || addr?.suburb || addr?.city_district || addr?.city || addr?.town || "";
            if (loc) setLocation(loc);
          } catch {
            setGpsTimedOut(true);
          } finally {
            setIsLocating(false);
          }
        },
        () => {
          clearTimeout(timeoutId);
          setIsLocating(false);
          setGpsTimedOut(true);
        },
        { timeout: 10000 },
      );
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (photos.length >= 10) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        addPhoto({ id: crypto.randomUUID(), dataUrl: ev.target?.result as string });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleNext = () => {
    if (photos.length === 0) {
      toast({ title: "사진을 먼저 촬영해주세요", variant: "destructive" });
      return;
    }
    // Step 1의 사진들을 섹션으로 자동 배치 (소제목/글은 비워둠 → 사용자가 직접 or AI로 채움)
    const initial: DraftSection[] = photos.map((p) => ({
      id: crypto.randomUUID(),
      subtitle: "",
      photo: { id: p.id, dataUrl: p.dataUrl },
      text: "",
    }));
    setEditSections(initial.length > 0 ? initial : [createEmptySection()]);
    setWizardStep(2);
  };

  const handleStartAI = async () => {
    if (photos.length === 0) {
      toast({ title: "사진을 먼저 촬영해주세요", variant: "destructive" });
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast({ title: "게시 플랫폼을 선택해주세요", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGenStep("analyzing");
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((p) => {
        if (p < 30) return p + 2;
        if (p < 80) return p + 0.5;
        if (p < 95) return p + 0.2;
        return p;
      });
    }, 200);

    try {
      setGenStep("analyzing");
      const primaryPlatform = selectedPlatforms[0];

      // Claude Vision에 보낼 대표 사진 1장만 더 공격적으로 압축 (400px/q=0.5) —
      // 나머지는 로컬에만 유지해 DB에 저장. Edge Function 6MB · 150s 한계 회피.
      const primaryCompressed = await compressPhotos(photos.slice(0, 1), 400);
      const { data, error } = await supabase.functions.invoke("generate-blog", {
        body: {
          photos: primaryCompressed.map((dataUrl, i) => ({ dataUrl, index: i + 1 })),
          photoCount: photos.length,
          persona: selectedPersona,
          platform: primaryPlatform,
          location,
          buildingType: "AI자동판단",
          constructionDate,
          companyName: settings.companyName,
          phoneNumber: settings.phoneNumber,
          siteArea,
          siteMethod,
          siteEtc,
        },
      });

      clearInterval(interval);

      if (error || data?.error) {
        // 서버측 월 한도 초과(429)는 플랜 업그레이드 안내 메시지로 분기
        const ctx = (error as { context?: { status?: number; clone?: () => { json: () => Promise<unknown> } } } | null)?.context;
        const status = typeof ctx?.status === "number" ? ctx.status : undefined;
        let bodyMsg = "";
        if (ctx && typeof ctx.clone === "function") {
          try {
            const body = (await ctx.clone().json()) as { error?: string };
            if (typeof body?.error === "string") bodyMsg = body.error;
          } catch {
            /* ignore */
          }
        }
        const combined = `${data?.error || ""} ${error?.message || ""} ${bodyMsg}`;
        const isQuota = status === 429 || combined.includes("한도");

        setGenStep("error");
        setProgress(0);
        toast({
          title: isQuota ? "이번 달 한도 초과" : "AI 글 생성 실패",
          description: isQuota
            ? "이번 달 블로그 개수를 모두 사용했습니다. 플랜을 업그레이드해 주세요."
            : bodyMsg || data?.error || error?.message || "다시 시도해주세요",
          variant: "destructive",
        });
        setTimeout(() => setIsGenerating(false), 1500);
        return;
      }

      setProgress(100);
      setGenStep("done");

      const aiResult = data as { title: string; blocks: ContentBlock[]; hashtags: string[] };

      // AI 결과(blocks)를 편집 가능한 sections로 변환: subtitle + 바로 뒤따르는 text/photo를 한 섹션으로 묶음
      const merged = blocksToSections(aiResult.blocks || [], photos);
      // 제목 품질 방어선 (postQuality 공통 유틸)
      setTitle(buildSafeTitle({
        title: aiResult.title || title,
        location,
        siteMethod,
      }));
      setEditSections(merged.length > 0 ? merged : editSections);
      setEditHashtags(normalizeHashtags(aiResult.hashtags || []));

      // 편집 화면(Step 2)을 유지한 채 로딩 오버레이만 닫음 → 사용자가 수정/추가/저장
      setTimeout(() => {
        setIsGenerating(false);
      }, 600);
    } catch (err: any) {
      clearInterval(interval);
      setGenStep("error");
      setProgress(0);
      toast({ title: "오류 발생", description: err.message || "네트워크 오류", variant: "destructive" });
      setTimeout(() => setIsGenerating(false), 1500);
    }
  };

  // AI 결과 blocks를 편집 가능한 sections로 변환
  function blocksToSections(blocks: ContentBlock[], photoPool: typeof photos): DraftSection[] {
    const out: DraftSection[] = [];
    let current: DraftSection | null = null;
    const pushCurrent = () => {
      if (current && (current.subtitle || current.text || current.photo)) out.push(current);
    };
    for (const b of blocks) {
      if (b.type === "subtitle") {
        pushCurrent();
        current = { id: crypto.randomUUID(), subtitle: b.content || "", photo: null, text: "" };
      } else if (b.type === "text") {
        if (!current) current = { id: crypto.randomUUID(), subtitle: "", photo: null, text: "" };
        current.text = current.text ? `${current.text}\n${b.content || ""}` : b.content || "";
      } else if (b.type === "photo") {
        if (!current) current = { id: crypto.randomUUID(), subtitle: "", photo: null, text: "" };
        const match = String(b.content || "").match(/photo-(\d+)/);
        const idx = match ? parseInt(match[1], 10) - 1 : -1;
        const pick = photoPool[idx] || photoPool[out.length] || null;
        if (pick) current.photo = { id: pick.id, dataUrl: pick.dataUrl };
      }
    }
    pushCurrent();
    return out;
  }

  const handleSavePost = async () => {
    if (!title.trim() || !hasMinimumContent(editSections)) {
      toast({
        title: "저장할 내용이 부족합니다",
        description: "제목과 '소제목+글' 또는 사진이 있는 섹션이 최소 1개 필요합니다.",
        variant: "destructive",
      });
      return;
    }
    const filled = editSections.filter((s) => s.subtitle.trim() || s.text.trim() || s.photo);
    setSaving(true);
    try {
      // 품질 보강 — 짧은 제목·빈 해시태그 자동 방어
      const safeTitle = buildSafeTitle({ title, location, siteMethod });
      const finalHashtags = normalizeHashtags(
        editHashtags.length > 0
          ? editHashtags
          : buildDefaultHashtags({ location, siteMethod, companyName: settings.companyName }),
      );

      // sections → blocks 변환 ([현장정보 요약] → [subtitle → photo → text] 반복)
      const blocks: ContentBlock[] = [];
      const siteBits: string[] = [];
      if (location) siteBits.push(`지역: ${location}`);
      if (siteArea) siteBits.push(`시공면적: ${siteArea}`);
      if (siteMethod) siteBits.push(`공법: ${siteMethod}`);
      if (siteEtc) siteBits.push(`기타: ${siteEtc}`);
      if (siteBits.length > 0) {
        blocks.push({ type: "subtitle", content: "현장 정보" });
        blocks.push({ type: "text", content: siteBits.join(" · ") });
      }
      filled.forEach((s, i) => {
        if (s.subtitle.trim()) blocks.push({ type: "subtitle", content: s.subtitle.trim() });
        if (s.photo) blocks.push({ type: "photo", content: `photo-${i + 1}`, caption: s.subtitle || "" });
        if (s.text.trim()) blocks.push({ type: "text", content: s.text.trim() });
      });

      const allPhotos = filled.map((s) => s.photo).filter((p): p is NonNullable<typeof p> => p !== null);

      // post-photos 버킷 업로드 — 성공한 항목은 dataUrl 대신 url로 교체.
      const newPostId = crypto.randomUUID();
      const uploadedPhotos = [...allPhotos];
      let uploadedOffline = false;
      if (user && allPhotos.length > 0) {
        const results = await uploadPostPhotos(
          user.id,
          newPostId,
          allPhotos.map((p) => p.dataUrl || ""),
        );
        results.forEach((url, i) => {
          if (url) {
            uploadedPhotos[i] = { id: allPhotos[i].id, url, caption: allPhotos[i].caption };
          } else if (allPhotos[i].dataUrl) {
            uploadedOffline = true;
          }
        });
      } else if (!user && allPhotos.length > 0) {
        uploadedOffline = true;
      }

      const { data: dbPost, error: dbError } = user ? await supabase
        .from("posts")
        .insert({
          id: newPostId,
          title: safeTitle,
          blocks: blocks as any,
          hashtags: finalHashtags,
          // Storage 전환: url 우선, 없으면 dataUrl fallback
          photos: uploadedPhotos.map((p) =>
            p.url ? { id: p.id, url: p.url } : { id: p.id, dataUrl: p.dataUrl ?? "" },
          ) as any,
          work_type: "AI자동판단",
          style: "시공일지형",
          persona: selectedPersona,
          platforms: [...selectedPlatforms],
          status: "완료",
          location,
          building_type: "AI자동판단",
          work_date: constructionDate,
          user_id: user.id,
        })
        .select()
        .single() : { data: null, error: null };

      if (dbError) {
        toast({ title: "DB 저장 실패", description: dbError.message, variant: "destructive" });
      }

      if (uploadedOffline) {
        toast({
          title: "오프라인 저장됨",
          description: "사진 일부가 클라우드 업로드에 실패해 기기에만 보관됐어요.",
        });
      }

      const newPost: BlogPost = {
        id: dbPost?.id || newPostId,
        title: safeTitle,
        photos: uploadedPhotos,
        workType: "기타",
        style: "시공일지형",
        blocks,
        hashtags: finalHashtags,
        status: "완료",
        createdAt: new Date().toISOString().slice(0, 10),
        platforms: [...selectedPlatforms],
        persona: selectedPersona,
        location,
        siteInfo: { area: siteArea, method: siteMethod, etc: siteEtc },
      };
      addPost(newPost);
      localStorage.removeItem(DRAFT_KEY);
      toast({ title: "글이 저장되었습니다 ✨" });
      onViewPost(newPost);
    } finally {
      setSaving(false);
    }
  };

  const handleRetryGps = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    setGpsTimedOut(false);
    const timeoutId = setTimeout(() => {
      setIsLocating(false);
      setGpsTimedOut(true);
    }, 10000);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        clearTimeout(timeoutId);
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ko`,
          );
          const data = await res.json();
          const addr = data.address;
          const loc = addr?.borough || addr?.suburb || addr?.city_district || addr?.city || addr?.town || "";
          if (loc) setLocation(loc);
        } catch {
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        clearTimeout(timeoutId);
        setIsLocating(false);
        setGpsTimedOut(true);
      },
      { timeout: 10000 },
    );
  };

  // ─── AI 생성 중 화면 (Stitch Dark) ───
  if (isGenerating) {
    return (
      <div className="px-4 pt-6 pb-28 space-y-6 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-20 h-20 rounded-full bg-[#4C8EFF]/15 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-primary animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-center text-foreground font-[Manrope]">
          {genStep === "error" ? "생성 실패" : "AI가 글을 작성하고 있습니다"}
        </h2>
        <div className="w-full max-w-xs">
          <div className="w-full bg-card rounded-full h-3">
            <div
              className="bg-gradient-to-r from-[#4C8EFF] to-[#ADC6FF] rounded-full h-3 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="space-y-3 w-full max-w-xs">
          <StepItem
            label="현장 사진 분석 중"
            active={genStep === "analyzing"}
            done={genStep === "writing" || genStep === "done"}
          />
          <StepItem label="블로그 글 작성 중" active={genStep === "writing"} done={genStep === "done"} />
          <StepItem label="작성 완료" active={false} done={genStep === "done"} />
        </div>
        {genStep === "error" && (
          <button
            onClick={() => setIsGenerating(false)}
            className="bg-secondary text-primary rounded-full h-[52px] px-8 font-bold text-sm"
          >
            돌아가기
          </button>
        )}
      </div>
    );
  }

  // ─── Step 1: 사진 + 현장 정보 (Stitch Dark) ───
  if (wizardStep === 1) {
    return (
      <div className="px-4 pt-6 pb-28 space-y-5 max-w-lg mx-auto">
        {/* 이어서 작성하기 배너 */}
        {showDraftBanner && (
          <div className="bg-[#4C8EFF]/10 border border-[#4C8EFF]/30 rounded-xl p-4 flex items-center gap-3"
            style={{ animation: "fadeUp .3s ease-out" }}>
            <span className="text-2xl">📝</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">작성 중이던 글이 있습니다</p>
              <p className="text-xs text-muted-foreground">이어서 작성하시겠어요?</p>
            </div>
            <div className="flex gap-2">
              <button onClick={discardDraft}
                className="text-xs text-muted-foreground px-2 py-1 rounded-lg hover:bg-white/5">삭제</button>
              <button onClick={restoreDraft}
                className="text-xs font-bold text-white px-3 py-1 rounded-lg"
                style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>불러오기</button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => onNavigate("home")}
            className="flex items-center gap-1 text-sm text-primary font-medium font-[Inter]"
          >
            <ArrowLeft className="w-4 h-4" /> 홈
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2 text-foreground font-[Manrope]">
            <Camera className="w-5 h-5 text-primary" /> 사진 + 현장 정보
          </h1>
          {/* Wizard progress dots */}
          <div className="flex gap-1.5 items-center">
            <div className="w-4 h-1.5 rounded-full bg-[#4C8EFF]" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#414754]" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            className="w-full h-[52px] rounded-full bg-gradient-to-r from-[#4C8EFF] to-[#6BA4FF] text-white font-bold text-sm flex items-center justify-center gap-2"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="w-5 h-5" />
            사진 촬영
          </button>
          <button
            className="w-full h-[52px] rounded-full bg-secondary text-primary font-bold text-sm flex items-center justify-center gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="w-5 h-5" />
            갤러리 선택
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Photo grid */}
        <div>
          <p className="text-sm text-muted-foreground mb-2 font-[Inter]">
            현장 사진 <span className="font-semibold text-foreground">{photos.length}</span>/10장{" "}
            {photos.length === 0 ? "— 많을수록 좋아요!" : photos.length >= 3 ? "✓ 충분해요" : "— 3장 이상 권장"}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-[#161B2B]"
              >
                <img src={photoSrc(photo)} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(photo.id)}
                  className="absolute top-0.5 right-0.5 bg-red-500/80 rounded-full p-0.5"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {photos.length === 0 && (
              <>
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-20 h-20 rounded-xl border-2 border-dashed border-border bg-[#161B2B] flex items-center justify-center">
                    <Camera className="w-6 h-6 text-muted-foreground" />
                  </div>
                ))}
                <div className="flex items-center ml-2">
                  <p className="text-xs text-muted-foreground whitespace-nowrap font-[Inter]">사진을<br/>추가해요</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Location & Date card — glass-card with glow */}
        <div className="glass-card p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1 font-[Inter]">
              <MapPin className="w-3 h-3" /> 시공 위치
            </label>
            {gpsTimedOut && !location && <p className="text-xs text-muted-foreground font-[Inter]">📍 위치를 직접 입력하거나, 아래 자동 버튼을 다시 눌러주세요</p>}
            <div className="flex gap-2">
              <input
                className="flex-1 bg-card border border-white/10 rounded-xl px-3 h-14 text-sm outline-none text-foreground placeholder:text-muted-foreground font-[Inter]"
                placeholder={isLocating ? "GPS 감지 중..." : "예) 강남구 역삼동"}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <button
                onClick={handleRetryGps}
                className="bg-[#4C8EFF]/15 text-primary rounded-xl px-3 h-14 text-xs font-medium shrink-0 flex items-center gap-1 font-[Inter]"
              >
                {isLocating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <MapPin className="w-3 h-3" /> 자동
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1 font-[Inter]">
              <CalendarDays className="w-3 h-3" /> 시공 일자
            </label>
            <div className="relative">
              <input
                type="date"
                className="w-full bg-card border border-white/10 rounded-xl px-3 h-14 text-sm outline-none text-foreground font-[Inter]"
                value={constructionDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setConstructionDate(e.target.value)}
              />
              <p className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none font-[Inter]">
                {constructionDate ? new Date(constructionDate).toLocaleDateString("ko-KR", { year:"numeric", month:"long", day:"numeric" }) : ""}
              </p>
            </div>
          </div>

          {/* 시공 정보 — 시공면적 / 공법 / 기타 */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-[Inter]">시공 면적</label>
              <input
                className="w-full bg-card border border-white/10 rounded-xl px-3 h-12 text-sm outline-none text-foreground placeholder:text-muted-foreground font-[Inter]"
                placeholder="예) 120㎡"
                value={siteArea}
                onChange={(e) => setSiteArea(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-[Inter]">공법</label>
              <input
                className="w-full bg-card border border-white/10 rounded-xl px-3 h-12 text-sm outline-none text-foreground placeholder:text-muted-foreground font-[Inter]"
                placeholder="예) 우레탄 도막방수"
                value={siteMethod}
                onChange={(e) => setSiteMethod(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-[Inter]">기타 (특이사항)</label>
            <input
              className="w-full bg-card border border-white/10 rounded-xl px-3 h-12 text-sm outline-none text-foreground placeholder:text-muted-foreground font-[Inter]"
              placeholder="예) 누수 보수 병행, 옥상 난간 포함"
              value={siteEtc}
              onChange={(e) => setSiteEtc(e.target.value)}
            />
          </div>
        </div>

        {/* 제목 — 비워두면 다음 화면에서 AI가 자동 생성 */}
        <div className="glass-card p-4 space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1 font-[Inter]">
            <Type className="w-3 h-3" /> 제목
          </label>
          <input
            className="w-full bg-card border border-white/10 rounded-xl px-3 h-12 text-sm outline-none text-foreground placeholder:text-muted-foreground font-[Inter]"
            placeholder="예) 강남구 옥상 방수 시공 완료 (비워두면 AI 자동 생성)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <KeywordRecommender
          location={location}
          onSelectKeyword={(kw) => {
            toast({ title: `"${kw}" 키워드가 반영됩니다` });
          }}
        />

        {/* CTA button — Stitch brand gradient */}
        <button
          className="w-full h-[52px] rounded-full bg-gradient-to-r from-[#4C8EFF] to-[#6BA4FF] text-white font-bold text-base flex items-center justify-center gap-2"
          onClick={handleNext}
        >
          다음 →
        </button>
      </div>
    );
  }

  // ─── Step 2: 3블록 편집 화면 (CLAUDE.md §2 고정 구조) ───
  const updateSection = (id: string, patch: Partial<DraftSection>) =>
    setEditSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSection = (id: string) =>
    setEditSections((prev) => prev.filter((s) => s.id !== id));
  const addEmptySection = () =>
    setEditSections((prev) => [...prev, createEmptySection()]);

  return (
    <div className="px-4 pt-6 pb-28 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => setWizardStep(1)} className="flex items-center gap-1 text-sm text-primary font-medium font-[Inter]">
          <ArrowLeft className="w-4 h-4" /> 이전
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2 text-foreground font-[Manrope]">
          <PenLine className="w-5 h-5 text-primary" /> 글쓰기
        </h1>
        <div className="flex gap-1.5 items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-[#414754]" />
          <div className="w-4 h-1.5 rounded-full bg-[#4C8EFF]" />
        </div>
      </div>

      {/* 1) 현장 정보 — Step 1 carry-over (편집 가능) */}
      <div className="glass-card p-4 space-y-3">
        <label className="text-xs text-muted-foreground flex items-center gap-1 font-[Inter]">
          <Type className="w-3 h-3" /> 제목
        </label>
        <input
          className="w-full bg-card border border-white/10 rounded-xl px-3 h-12 text-sm outline-none text-foreground placeholder:text-muted-foreground font-[Inter]"
          placeholder="비워두면 AI가 자동 생성"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <div>지역: <span className="text-foreground">{location || "—"}</span></div>
          <div>일자: <span className="text-foreground">{constructionDate}</span></div>
          <div>면적: <span className="text-foreground">{siteArea || "—"}</span></div>
          <div>공법: <span className="text-foreground">{siteMethod || "—"}</span></div>
          {siteEtc && <div className="col-span-2">기타: <span className="text-foreground">{siteEtc}</span></div>}
        </div>
      </div>

      {/* 페르소나 + 플랫폼 — 콤팩트 */}
      <div className="glass-card p-3 space-y-2.5">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 font-[Inter]">페르소나</p>
          <div className="flex gap-1.5">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPersona(p.id)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedPersona === p.id
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "bg-white/5 text-muted-foreground border border-white/10"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 font-[Inter]">플랫폼</p>
          <div className="flex flex-wrap gap-1.5">
            {platformIds.map((id) => (
              <PlatformChip
                key={id}
                platform={id}
                selected={selectedPlatforms.includes(id)}
                onClick={() => togglePlatform(id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 2) 섹션 영역 — 소제목·사진·글쓰기 (CLAUDE.md 고정 구조) */}
      {editSections.length === 0 && (
        <div className="glass-card p-6 text-center space-y-2">
          <Sparkles className="w-5 h-5 text-primary mx-auto" />
          <p className="text-sm font-semibold text-foreground">섹션이 비어있어요</p>
          <p className="text-xs text-muted-foreground">아래 "AI 자동 완성"으로 한번에 채우거나, "+ 글쓰기 추가"로 직접 작성하세요</p>
        </div>
      )}
      {editSections.map((s, i) => (
        <SectionCard
          key={s.id}
          section={s}
          index={i}
          onUpdate={(patch) => updateSection(s.id, patch)}
          onRemove={() => removeSection(s.id)}
        />
      ))}

      {/* 3) + 글쓰기 추가 (항시 고정) */}
      <button
        onClick={addEmptySection}
        className="w-full flex items-center justify-center gap-2 glass-card py-4 font-semibold text-primary border border-dashed border-primary/40 hover:bg-primary/5 transition-colors"
      >
        <Plus className="w-4 h-4" /> 글쓰기 추가
      </button>

      {/* AI 자동 완성 — generate-blog 호출해 섹션 일괄 채움 */}
      <button
        className={`w-full h-[52px] rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-opacity ${
          selectedPlatforms.length === 0
            ? "bg-secondary text-muted-foreground opacity-50 cursor-not-allowed"
            : "bg-gradient-to-r from-[#AB5EBE]/80 to-[#4C8EFF]/80 text-white"
        }`}
        onClick={handleStartAI}
        disabled={selectedPlatforms.length === 0 || isGenerating || saving}
      >
        <Sparkles className="w-5 h-5" />
        AI로 자동 완성
      </button>

      {/* 저장 */}
      <button
        onClick={handleSavePost}
        disabled={saving || isGenerating}
        className="btn-power w-full disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
        {saving ? "저장 중..." : "저장하기"}
      </button>
    </div>
  );
}

function StepItem({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
      ) : active ? (
        <Loader2 className="w-6 h-6 text-[#4C8EFF] animate-spin shrink-0" />
      ) : (
        <div className="w-6 h-6 rounded-full border-2 border-border shrink-0" />
      )}
      <p
        className={`text-sm font-medium font-[Inter] ${
          done ? "text-emerald-400" : active ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
    </div>
  );
}

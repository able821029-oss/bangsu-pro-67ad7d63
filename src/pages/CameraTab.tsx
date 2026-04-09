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
} from "lucide-react";
import { KeywordRecommender } from "@/components/KeywordRecommender";
import { PlatformChip } from "@/components/PlatformChip";
import { Button } from "@/components/ui/button";
import { useAppStore, Platform, Persona, BlogPost, ContentBlock } from "@/stores/appStore";
import type { TabId } from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [location, setLocation] = useState("");
  const [constructionDate, setConstructionDate] = useState(new Date().toISOString().slice(0, 10));
  const [isLocating, setIsLocating] = useState(false);
  const [gpsTimedOut, setGpsTimedOut] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

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
  }, [photos, wizardStep, location, constructionDate, selectedPlatforms, selectedPersona]);

  // ── 임시저장 함수 ──
  const saveDraft = () => {
    if (photos.length === 0) return;
    const draft = {
      photos: photos.map(p => ({ id: p.id, dataUrl: p.dataUrl })),
      location,
      constructionDate,
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

      const { data, error } = await supabase.functions.invoke("generate-blog", {
        body: {
          photos: photos.slice(0, 5).map((p) => ({ dataUrl: p.dataUrl })),
          persona: selectedPersona,
          platform: primaryPlatform,
          location,
          buildingType: "AI자동판단",
          constructionDate,
          companyName: settings.companyName,
          phoneNumber: settings.phoneNumber,
        },
      });

      clearInterval(interval);

      if (error || data?.error) {
        setGenStep("error");
        setProgress(0);
        toast({
          title: "AI 글 생성 실패",
          description: data?.error || error?.message || "다시 시도해주세요",
          variant: "destructive",
        });
        setTimeout(() => setIsGenerating(false), 1500);
        return;
      }

      setProgress(100);
      setGenStep("done");

      const aiResult = data as { title: string; blocks: ContentBlock[]; hashtags: string[] };

      const { data: dbPost, error: dbError } = await supabase
        .from("posts")
        .insert({
          title: aiResult.title,
          blocks: aiResult.blocks as any,
          hashtags: aiResult.hashtags,
          photos: photos.map((p) => ({ id: p.id, dataUrl: p.dataUrl })) as any,
          work_type: "AI자동판단",
          style: "시공일지형",
          persona: selectedPersona,
          platforms: [...selectedPlatforms],
          status: "완료",
          location,
          building_type: "AI자동판단",
          work_date: constructionDate,
        })
        .select()
        .single();

      if (dbError) {
        toast({ title: "DB 저장 실패", description: dbError.message, variant: "destructive" });
      }

      const newPost: BlogPost = {
        id: dbPost?.id || crypto.randomUUID(),
        title: aiResult.title,
        photos: [...photos],
        workType: "기타",
        style: "시공일지형",
        blocks: aiResult.blocks,
        hashtags: aiResult.hashtags,
        status: "완료",
        createdAt: new Date().toISOString().slice(0, 10),
        platforms: [...selectedPlatforms],
        persona: selectedPersona,
      };

      addPost(newPost);
      localStorage.removeItem(DRAFT_KEY); // 임시저장 삭제
      setTimeout(() => {
        setIsGenerating(false);
        onViewPost(newPost);
      }, 800);
    } catch (err: any) {
      clearInterval(interval);
      setGenStep("error");
      setProgress(0);
      toast({ title: "오류 발생", description: err.message || "네트워크 오류", variant: "destructive" });
      setTimeout(() => setIsGenerating(false), 1500);
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
          <Sparkles className="w-10 h-10 text-[#ADC6FF] animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-center text-[#DEE1F7] font-[Manrope]">
          {genStep === "error" ? "생성 실패" : "AI가 글을 작성하고 있습니다"}
        </h2>
        <div className="w-full max-w-xs">
          <div className="w-full bg-[#1A1F2F] rounded-full h-3">
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
            className="bg-[#2F3445] text-[#ADC6FF] rounded-full h-[52px] px-8 font-bold text-sm"
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
              <p className="text-sm font-semibold text-[#DEE1F7]">작성 중이던 글이 있습니다</p>
              <p className="text-xs text-[#8B90A0]">이어서 작성하시겠어요?</p>
            </div>
            <div className="flex gap-2">
              <button onClick={discardDraft}
                className="text-xs text-[#8B90A0] px-2 py-1 rounded-lg hover:bg-white/5">삭제</button>
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
            className="flex items-center gap-1 text-sm text-[#ADC6FF] font-medium font-[Inter]"
          >
            <ArrowLeft className="w-4 h-4" /> 홈
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2 text-[#DEE1F7] font-[Manrope]">
            <Camera className="w-5 h-5 text-[#ADC6FF]" /> 사진 + 현장 정보
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
            className="w-full h-[52px] rounded-full bg-[#2F3445] text-[#ADC6FF] font-bold text-sm flex items-center justify-center gap-2"
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
          <p className="text-sm text-[#8B90A0] mb-2 font-[Inter]">
            현장 사진 <span className="font-semibold text-[#DEE1F7]">{photos.length}</span>/10장{" "}
            {photos.length === 0 ? "— 많을수록 좋아요!" : photos.length >= 3 ? "✓ 충분해요" : "— 3장 이상 권장"}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-[#161B2B]"
              >
                <img src={photo.dataUrl} alt="" className="w-full h-full object-cover" />
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
                  <div key={i} className="w-20 h-20 rounded-xl border-2 border-dashed border-[#414754] bg-[#161B2B] flex items-center justify-center">
                    <Camera className="w-6 h-6 text-[#8B90A0]" />
                  </div>
                ))}
                <div className="flex items-center ml-2">
                  <p className="text-xs text-[#8B90A0] whitespace-nowrap font-[Inter]">사진을<br/>추가해요</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Location & Date card — glass-card style */}
        <div className="bg-white/[0.06] backdrop-blur-md rounded-xl border border-white/10 p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-[#8B90A0] flex items-center gap-1 font-[Inter]">
              <MapPin className="w-3 h-3" /> 시공 위치
            </label>
            {gpsTimedOut && !location && <p className="text-xs text-yellow-500 font-[Inter]">위치 감지 실패 — 직접 입력해 주세요</p>}
            <div className="flex gap-2">
              <input
                className="flex-1 bg-[#1A1F2F] border border-white/10 rounded-xl px-3 h-14 text-sm outline-none text-[#DEE1F7] placeholder:text-[#8B90A0] font-[Inter]"
                placeholder={isLocating ? "GPS 감지 중..." : "예) 강남구 역삼동"}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <button
                onClick={handleRetryGps}
                className="bg-[#4C8EFF]/15 text-[#ADC6FF] rounded-xl px-3 h-14 text-xs font-medium shrink-0 flex items-center gap-1 font-[Inter]"
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
            <label className="text-xs text-[#8B90A0] flex items-center gap-1 font-[Inter]">
              <CalendarDays className="w-3 h-3" /> 시공 일자
            </label>
            <div className="relative">
              <input
                type="date"
                className="w-full bg-[#1A1F2F] border border-white/10 rounded-xl px-3 h-14 text-sm outline-none text-[#DEE1F7] font-[Inter]"
                value={constructionDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setConstructionDate(e.target.value)}
              />
              <p className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8B90A0] pointer-events-none font-[Inter]">
                {constructionDate ? new Date(constructionDate).toLocaleDateString("ko-KR", { year:"numeric", month:"long", day:"numeric" }) : ""}
              </p>
            </div>
          </div>
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

  // ─── Step 2: 스타일 선택 (Stitch Dark) ───
  return (
    <div className="px-4 pt-6 pb-28 space-y-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => setWizardStep(1)} className="flex items-center gap-1 text-sm text-[#ADC6FF] font-medium font-[Inter]">
          <ArrowLeft className="w-4 h-4" /> 이전
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2 text-[#DEE1F7] font-[Manrope]">
          <PenLine className="w-5 h-5 text-[#ADC6FF]" /> 스타일 선택
        </h1>
        {/* Wizard progress dots */}
        <div className="flex gap-1.5 items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-[#414754]" />
          <div className="w-4 h-1.5 rounded-full bg-[#4C8EFF]" />
        </div>
      </div>

      {/* Persona cards */}
      <div>
        <p className="text-sm font-semibold mb-2 text-[#C1C6D7] font-[Inter]">글쓰기 페르소나</p>
        <div className="space-y-2">
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPersona(p.id)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                selectedPersona === p.id
                  ? "border border-[#4C8EFF] bg-[#4C8EFF]/10"
                  : "border border-white/10 bg-[#1A1F2F]"
              }`}
            >
              <p className="font-semibold text-sm text-[#DEE1F7] font-[Manrope]">{p.label}</p>
              <p className="text-xs text-[#8B90A0] font-[Inter]">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Platform selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-[#C1C6D7] font-[Inter]">게시 플랫폼 선택</p>
          {selectedPlatforms.length === 0 && (
            <span className="text-xs text-amber-500 font-medium font-[Inter]">하나 이상 선택해 주세요</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {platformIds.map((id) => (
            <PlatformChip
              key={id}
              platform={id}
              selected={selectedPlatforms.includes(id)}
              onClick={() => togglePlatform(id)}
            />
          ))}
        </div>
        {selectedPlatforms.length === 0 && (
          <div className="mt-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2">
            <p className="text-xs text-amber-500 font-[Inter]">네이버 블로그를 선택하면 검색 상위노출에 유리합니다</p>
          </div>
        )}
      </div>

      {/* CTA button — Stitch brand gradient */}
      <button
        className={`w-full h-[52px] rounded-full font-bold text-base flex items-center justify-center gap-2 transition-opacity ${
          selectedPlatforms.length === 0
            ? "bg-[#2F3445] text-[#8B90A0] opacity-50 cursor-not-allowed"
            : "bg-gradient-to-r from-[#4C8EFF] to-[#6BA4FF] text-white"
        }`}
        onClick={handleStartAI}
        disabled={selectedPlatforms.length === 0}
      >
        <Sparkles className="w-6 h-6" />
        AI 글쓰기 시작
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
        <div className="w-6 h-6 rounded-full border-2 border-[#414754] shrink-0" />
      )}
      <p
        className={`text-sm font-medium font-[Inter] ${
          done ? "text-emerald-400" : active ? "text-[#DEE1F7]" : "text-[#8B90A0]"
        }`}
      >
        {label}
      </p>
    </div>
  );
}

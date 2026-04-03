import { useRef, useState, useEffect } from "react";
import { Camera, ImagePlus, X, Sparkles, MapPin, CalendarDays, CheckCircle2, Loader2, Film, PenLine } from "lucide-react";
import { BeforeAfterComparator } from "@/components/BeforeAfterComparator";
import { ShortsCreator } from "@/components/ShortsCreator";
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

export function CameraTab({ onNavigate, onViewPost }: { onNavigate: (tab: TabId) => void; onViewPost: (post: BlogPost) => void }) {
  const {
    photos, selectedPlatforms, selectedPersona,
    addPhoto, removePhoto, togglePlatform, setSelectedPersona,
    addPost, settings,
  } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [location, setLocation] = useState("");
  const [constructionDate, setConstructionDate] = useState(new Date().toISOString().slice(0, 10));
  const [isLocating, setIsLocating] = useState(false);
  const [gpsTimedOut, setGpsTimedOut] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState<GeneratingStep>("analyzing");
  const [progress, setProgress] = useState(0);
  const [showShorts, setShowShorts] = useState(false);

  // Auto-detect GPS location on mount with 10s timeout
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
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ko`
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
        { timeout: 10000 }
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
          photos: photos.slice(0, 5).map(p => ({ dataUrl: p.dataUrl })),
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
        toast({ title: "AI 글 생성 실패", description: data?.error || error?.message || "다시 시도해주세요", variant: "destructive" });
        setTimeout(() => setIsGenerating(false), 1500);
        return;
      }

      setProgress(100);
      setGenStep("done");

      const aiResult = data as { title: string; blocks: ContentBlock[]; hashtags: string[] };

      const { data: dbPost, error: dbError } = await supabase.from("posts").insert({
        title: aiResult.title,
        blocks: aiResult.blocks as any,
        hashtags: aiResult.hashtags,
        photos: photos.map(p => ({ id: p.id, dataUrl: p.dataUrl })) as any,
        work_type: "AI자동판단",
        style: "시공일지형",
        persona: selectedPersona,
        platforms: [...selectedPlatforms],
        status: "완료",
        location,
        building_type: "AI자동판단",
        work_date: constructionDate,
      }).select().single();

      if (dbError) {
        console.error("DB save error:", dbError);
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
      setTimeout(() => { setIsGenerating(false); onViewPost(newPost); }, 800);
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
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ko`
          );
          const data = await res.json();
          const addr = data.address;
          const loc = addr?.borough || addr?.suburb || addr?.city_district || addr?.city || addr?.town || "";
          if (loc) setLocation(loc);
        } catch {} finally { setIsLocating(false); }
      },
      () => { clearTimeout(timeoutId); setIsLocating(false); setGpsTimedOut(true); },
      { timeout: 10000 }
    );
  };

  if (showShorts) {
    return <ShortsCreator onClose={() => setShowShorts(false)} autoStart />;
  }

  if (isGenerating) {
    return (
      <div className="px-4 pt-6 pb-24 space-y-6 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-primary animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-center">
          {genStep === "error" ? "생성 실패" : "AI가 글을 작성하고 있습니다"}
        </h2>
        <div className="w-full max-w-xs">
          <div className="w-full bg-secondary rounded-full h-3">
            <div className="bg-primary rounded-full h-3 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="space-y-3 w-full max-w-xs">
          <StepItem label="사진 분석 중" active={genStep === "analyzing"} done={genStep === "writing" || genStep === "done"} />
          <StepItem label="글 생성 중" active={genStep === "writing"} done={genStep === "done"} />
          <StepItem label="완료" active={false} done={genStep === "done"} />
        </div>
        {genStep === "error" && (
          <Button variant="outline" onClick={() => setIsGenerating(false)}>돌아가기</Button>
        )}
      </div>
    );
  }

  // ─── Step 1: Photos + Basic Info ───
  if (wizardStep === 1) {
    return (
      <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2"><Camera className="w-5 h-5 text-primary" /> 사진 + 현장 정보</h1>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">1 / 2</span>
        </div>

        {/* Camera & Gallery */}
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" className="w-full" onClick={() => cameraInputRef.current?.click()}>
            <Camera className="w-5 h-5" />
            사진 촬영
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus className="w-5 h-5" />
            갤러리 선택
          </Button>
        </div>

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />

        <div>
          <p className="text-sm text-muted-foreground mb-2">촬영 사진 ({photos.length}/10)</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {photos.map((photo) => (
              <div key={photo.id} className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-border">
                <img src={photo.dataUrl} alt="" className="w-full h-full object-cover" />
                <button onClick={() => removePhoto(photo.id)} className="absolute top-0.5 right-0.5 bg-destructive rounded-full p-0.5">
                  <X className="w-3 h-3 text-destructive-foreground" />
                </button>
              </div>
            ))}
            {photos.length === 0 && (
              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                <Camera className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* Location + Date */}
        <div className="bg-card rounded-[--radius] border border-border p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" /> 시공 위치
            </label>
            {gpsTimedOut && !location && (
              <p className="text-xs text-yellow-500">위치 감지 실패 — 직접 입력해 주세요</p>
            )}
            <div className="flex gap-2">
              <input
                className="flex-1 bg-secondary rounded-lg px-3 py-3 text-sm outline-none text-foreground"
                placeholder={isLocating ? "GPS 감지 중..." : "예) 강남구 역삼동"}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <button
                onClick={handleRetryGps}
                className="bg-primary/10 text-primary rounded-lg px-3 py-2 text-xs font-medium shrink-0"
              >
                {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><MapPin className="w-3 h-3" /> 자동</>}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarDays className="w-3 h-3" /> 시공 일자
            </label>
            <input type="date" className="w-full bg-secondary rounded-lg px-3 py-3 text-sm outline-none text-foreground" value={constructionDate} onChange={(e) => setConstructionDate(e.target.value)} />
          </div>
        </div>

        {/* Keyword Recommender */}
        <KeywordRecommender
          location={location}
          onSelectKeyword={(kw) => {
            toast({ title: `"${kw}" 키워드가 반영됩니다` });
          }}
        />

        {/* Before/After */}
        <BeforeAfterComparator />

        {/* Next — disabled when no photos */}
        <Button variant="hero" size="xl" className="w-full" onClick={handleNext} disabled={photos.length === 0}>
          다음 →
        </Button>

        {/* Shorts */}
        <Button variant="outline" size="xl" className="w-full" onClick={() => setShowShorts(true)}>
          <Film className="w-6 h-6" />
          쇼츠 영상 만들기
        </Button>
      </div>
    );
  }

  // ─── Step 2: Persona + Platform + Generate ───
  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={() => setWizardStep(1)} className="text-sm text-primary font-medium">← 이전</button>
        <h1 className="text-xl font-bold flex items-center gap-2"><PenLine className="w-5 h-5 text-primary" /> 스타일 선택</h1>
        <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">2 / 2</span>
      </div>

      {/* Persona */}
      <div>
        <p className="text-sm font-semibold mb-2">글쓰기 페르소나</p>
        <div className="space-y-2">
          {personas.map((p) => (
            <button key={p.id} onClick={() => setSelectedPersona(p.id)} className={`w-full text-left px-4 py-3 rounded-[--radius] border-2 transition-all ${selectedPersona === p.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
              <p className="font-semibold text-sm">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Platform */}
      <div>
        <p className="text-sm font-semibold mb-2">게시 플랫폼 (중복 가능)</p>
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
      </div>

      {/* Generate */}
      <Button variant="hero" size="xl" className="w-full" onClick={handleStartAI}>
        <Sparkles className="w-6 h-6" />
        AI 글쓰기 시작
      </Button>
    </div>
  );
}

function StepItem({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {done ? <CheckCircle2 className="w-6 h-6 text-success shrink-0" /> : active ? <Loader2 className="w-6 h-6 text-primary animate-spin shrink-0" /> : <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
      <p className={`text-sm font-medium ${done ? "text-success" : active ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
    </div>
  );
}

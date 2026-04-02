import { useRef, useState } from "react";
import { Camera, ImagePlus, X, Sparkles, MapPin, Building2, CalendarDays, CheckCircle2, Loader2, Film } from "lucide-react";
import { BeforeAfterComparator } from "@/components/BeforeAfterComparator";
import { ShortsCreator } from "@/components/ShortsCreator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore, Platform, Persona, BlogPost, ContentBlock } from "@/stores/appStore";
import type { TabId } from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const platforms: { id: Platform; label: string; emoji: string }[] = [
  { id: "naver", label: "네이버 블로그", emoji: "📗" },
  { id: "instagram", label: "인스타그램", emoji: "📷" },
  { id: "tiktok", label: "틱톡", emoji: "🎵" },
];

const personas: { id: Persona; label: string; desc: string }[] = [
  { id: "장인형", label: "🔨 장인형", desc: "30년 경력의 장인 느낌" },
  { id: "친근형", label: "😊 친근형", desc: "이웃집 아저씨같은 친근함" },
  { id: "전문기업형", label: "🏢 전문기업형", desc: "체계적인 전문 기업 이미지" },
];

const buildingTypes = ["아파트", "상가", "단독주택", "기타"] as const;

type GeneratingStep = "analyzing" | "writing" | "done" | "error";

export function CameraTab({ onNavigate, onViewPost }: { onNavigate: (tab: TabId) => void; onViewPost: (post: BlogPost) => void }) {
  const {
    photos, selectedWorkType, selectedPlatforms, selectedPersona,
    addPhoto, removePhoto, setWorkType, togglePlatform, setSelectedPersona,
    addPost, settings,
  } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [location, setLocation] = useState("");
  const [buildingType, setBuildingType] = useState<string>("아파트");
  const [constructionDate, setConstructionDate] = useState(new Date().toISOString().slice(0, 10));

  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState<GeneratingStep>("analyzing");
  const [progress, setProgress] = useState(0);
  const [showShorts, setShowShorts] = useState(false);

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

  const handleStartAI = async () => {
    if (photos.length === 0) {
      toast({ title: "사진을 먼저 촬영해주세요", variant: "destructive" });
      return;
    }
    if (!selectedWorkType) {
      toast({ title: "공사 유형을 선택해주세요", variant: "destructive" });
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast({ title: "게시 플랫폼을 선택해주세요", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGenStep("analyzing");
    setProgress(0);

    // Progress animation
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
      
      // Use the first selected platform for generation
      const primaryPlatform = selectedPlatforms[0];

      const { data, error } = await supabase.functions.invoke("generate-blog", {
        body: {
          photos: photos.slice(0, 5).map(p => ({ dataUrl: p.dataUrl })),
          workType: selectedWorkType,
          persona: selectedPersona,
          platform: primaryPlatform,
          location,
          buildingType,
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

      // Save to Supabase DB
      const { data: dbPost, error: dbError } = await supabase.from("posts").insert({
        title: aiResult.title,
        blocks: aiResult.blocks as any,
        hashtags: aiResult.hashtags,
        photos: photos.map(p => ({ id: p.id, dataUrl: p.dataUrl })) as any,
        work_type: selectedWorkType,
        style: "시공일지형",
        persona: selectedPersona,
        platforms: [...selectedPlatforms],
        status: "완료",
        location,
        building_type: buildingType,
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
        workType: selectedWorkType,
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

  if (showShorts) {
    return <ShortsCreator onClose={() => setShowShorts(false)} />;
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

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <h1 className="text-xl font-bold">📷 현장 촬영</h1>

      {/* 1. Site Info Fields */}
      <div className="bg-card rounded-[--radius] border border-border p-4 space-y-4">
        <p className="text-sm font-semibold">📍 현장 정보</p>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" /> 시공 위치
          </label>
          <input
            className="w-full bg-secondary rounded-lg px-3 py-3 text-sm outline-none text-foreground"
            placeholder="예) 강남구 역삼동"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Building2 className="w-3 h-3" /> 건물 종류
          </label>
          <p className="text-xs text-muted-foreground">어떤 건물인지 (아파트·상가 등)</p>
          <div className="flex flex-wrap gap-2">
            {buildingTypes.map((bt) => (
              <Badge key={bt} variant={buildingType === bt ? "chipActive" : "chip"} className="text-sm px-3 py-1.5 cursor-pointer" onClick={() => setBuildingType(bt)}>
                {bt}
              </Badge>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarDays className="w-3 h-3" /> 시공 일자
          </label>
          <input type="date" className="w-full bg-secondary rounded-lg px-3 py-3 text-sm outline-none text-foreground" value={constructionDate} onChange={(e) => setConstructionDate(e.target.value)} />
        </div>
      </div>

      {/* 2. Camera & Gallery */}
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

      {/* 3. Work Type */}
      <div>
        <p className="text-sm font-semibold mb-1">공사 종류 선택</p>
        <p className="text-xs text-muted-foreground mb-2">어떤 공사인지 (옥상방수·균열보수 등)</p>
        <div className="flex flex-wrap gap-2">
          {workTypes.map((type) => (
            <Badge key={type} variant={selectedWorkType === type ? "chipActive" : "chip"} className="text-base px-4 py-2 cursor-pointer" onClick={() => setWorkType(type)}>
              {type}
            </Badge>
          ))}
        </div>
      </div>

      {/* 4. Platform */}
      <div>
        <p className="text-sm font-semibold mb-2">게시 플랫폼 (중복 가능)</p>
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => (
            <Badge key={p.id} variant={selectedPlatforms.includes(p.id) ? "chipActive" : "chip"} className="text-base px-4 py-2 cursor-pointer" onClick={() => togglePlatform(p.id)}>
              {p.emoji} {p.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* 5. Persona */}
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

      {/* 6. Before/After */}
      <BeforeAfterComparator />

      {/* 7. Start AI */}
      <Button variant="hero" size="xl" className="w-full" onClick={handleStartAI}>
        <Sparkles className="w-6 h-6" />
        AI 글쓰기 시작
      </Button>

      {/* 8. Shorts Video */}
      <Button variant="outline" size="xl" className="w-full" onClick={() => setShowShorts(true)}>
        <Film className="w-6 h-6" />
        쇼츠 영상 만들기
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

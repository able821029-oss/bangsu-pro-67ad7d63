import { useRef } from "react";
import { Camera, ImagePlus, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore, WorkType, Platform, Persona } from "@/stores/appStore";
import type { TabId } from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";

const workTypes: WorkType[] = ["옥상방수", "외벽방수", "지하방수", "균열보수", "욕실방수", "기타"];

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

export function CameraTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const {
    photos, selectedWorkType, selectedPlatforms, selectedPersona,
    addPhoto, removePhoto, setWorkType, togglePlatform, setSelectedPersona,
  } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (photos.length >= 10) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        addPhoto({
          id: crypto.randomUUID(),
          dataUrl: ev.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleStartAI = () => {
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
    onNavigate("publish");
  };

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <h1 className="text-xl font-bold">📷 현장 사진 촬영</h1>

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

      {/* Photo Thumbnails */}
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

      {/* Work Type */}
      <div>
        <p className="text-sm font-semibold mb-2">공사 유형 선택</p>
        <div className="flex flex-wrap gap-2">
          {workTypes.map((type) => (
            <Badge
              key={type}
              variant={selectedWorkType === type ? "chipActive" : "chip"}
              className="text-base px-4 py-2 cursor-pointer"
              onClick={() => setWorkType(type)}
            >
              {type}
            </Badge>
          ))}
        </div>
      </div>

      {/* Platform Selection */}
      <div>
        <p className="text-sm font-semibold mb-2">게시 플랫폼 (중복 가능)</p>
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => (
            <Badge
              key={p.id}
              variant={selectedPlatforms.includes(p.id) ? "chipActive" : "chip"}
              className="text-base px-4 py-2 cursor-pointer"
              onClick={() => togglePlatform(p.id)}
            >
              {p.emoji} {p.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Persona Selection */}
      <div>
        <p className="text-sm font-semibold mb-2">글쓰기 페르소나</p>
        <div className="space-y-2">
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPersona(p.id)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                selectedPersona === p.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card"
              }`}
            >
              <p className="font-semibold text-sm">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Start AI */}
      <Button variant="hero" size="xl" className="w-full" onClick={handleStartAI}>
        <Sparkles className="w-6 h-6" />
        AI 글쓰기 시작
      </Button>
    </div>
  );
}

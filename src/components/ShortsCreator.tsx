import { useState, useEffect, useRef } from "react";
import { Film, Sparkles, CheckCircle2, Loader2, Download, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores/appStore";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type VideoStyle = "시공일지형" | "홍보형" | "Before/After형";
type NarrationType = "남성" | "여성" | "없음";
type ShortsStep = "config" | "scripting" | "narration" | "rendering" | "done" | "error";

const videoStyles: { id: VideoStyle; label: string; desc: string; emoji: string }[] = [
  { id: "시공일지형", label: "시공일지형", desc: "시공 전→중→후 순서", emoji: "📋" },
  { id: "홍보형", label: "홍보형", desc: "완료컷 강조 + 업체 정보", emoji: "📢" },
  { id: "Before/After형", label: "Before/After형", desc: "전후 비교 중심", emoji: "🔄" },
];

const narrationTypes: { id: NarrationType; label: string; emoji: string }[] = [
  { id: "남성", label: "남성 (기본)", emoji: "🎙️" },
  { id: "여성", label: "여성", emoji: "🎤" },
  { id: "없음", label: "없음 (BGM만)", emoji: "🎵" },
];

// Plan limits
const PLAN_LIMITS: Record<string, number> = {
  "무료": 0,
  "베이직": 5,
  "프로": 20,
  "비즈니스": 50,
  "무제한": 999,
};

function UsageMeter({ used, max, plan }: { used: number; max: number; plan: string }) {
  const ratio = max > 0 ? used / max : 1;
  const barColor = ratio >= 1 ? "#EF4444" : ratio >= 0.8 ? "#F97316" : "#237FFF";
  const percentage = Math.min(ratio * 100, 100);

  return (
    <div className="bg-card rounded-[--radius] border border-border p-4 space-y-2">
      <div className="flex justify-between items-baseline">
        <p className="text-sm font-semibold">🎬 이번 달 영상</p>
        <p className="text-sm font-bold" style={{ color: barColor }}>
          {used} / {max}개
        </p>
      </div>
      <div className="w-full bg-secondary rounded-full h-2.5">
        <div
          className="rounded-full h-2.5 transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: barColor }}
        />
      </div>
      {ratio >= 1 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
          <p className="text-xs text-destructive font-medium">
            이번 달 영상 횟수를 모두 사용했습니다.
            {plan === "베이직" && " 프로 플랜으로 업그레이드하면 월 20개까지 가능해요."}
            {plan === "프로" && " 비즈니스 플랜으로 업그레이드하면 월 50개까지 가능해요."}
          </p>
          {plan !== "비즈니스" && plan !== "무제한" && (
            <Button size="sm" variant="outline" className="text-xs" style={{ borderColor: "#237FFF", color: "#237FFF" }}>
              플랜 업그레이드
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function ShortsCreator({ onClose }: { onClose: () => void }) {
  const { photos, settings, subscription } = useAppStore();
  const { toast } = useToast();

  const [videoStyle, setVideoStyle] = useState<VideoStyle>("시공일지형");
  const [narration, setNarration] = useState<NarrationType>("남성");
  const [step, setStep] = useState<ShortsStep>("config");
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<number | null>(null);
  const pollCountRef = useRef(0);

  // Usage tracking (mock — would come from DB in production)
  const videoLimit = PLAN_LIMITS[subscription.plan] || 5;
  const [videoUsed] = useState(2); // TODO: fetch from DB

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleGenerate = async () => {
    if (photos.length < 2) {
      toast({ title: "사진이 2장 이상 필요합니다", variant: "destructive" });
      return;
    }
    if (videoUsed >= videoLimit) {
      toast({ title: "이번 달 영상 횟수를 모두 사용했습니다", variant: "destructive" });
      return;
    }

    setStep("scripting");
    setProgress(10);
    setErrorMsg("");

    try {
      // 1. Create DB record
      const { data: dbVideo, error: dbErr } = await supabase.from("videos").insert({
        video_style: videoStyle,
        narration_type: narration,
        status: "생성중",
      }).select().single();

      if (dbErr) throw new Error(dbErr.message);
      const vid = dbVideo.id;
      setVideoId(vid);

      // 2. Generate script
      const { data: scriptData, error: scriptErr } = await supabase.functions.invoke("generate-shorts", {
        body: {
          action: "generate-script",
          photos: photos.slice(0, 5).map(p => ({ dataUrl: p.dataUrl })),
          workType: "자동판단",
          videoStyle,
          narrationType: narration,
          location: "",
          buildingType: "",
          constructionDate: new Date().toISOString().slice(0, 10),
          companyName: settings.companyName,
          phoneNumber: settings.phoneNumber,
        },
      });

      if (scriptErr) throw new Error(scriptErr.message);
      setProgress(40);
      setStep("narration");

      await supabase.from("videos").update({ script: scriptData }).eq("id", vid);
      setProgress(50);
      setStep("rendering");

      // 3. Render
      const { data: renderData, error: renderErr } = await supabase.functions.invoke("generate-shorts", {
        body: {
          action: "render",
          script: scriptData,
          photos: photos.slice(0, 5).map(p => ({ dataUrl: p.dataUrl })),
          videoId: vid,
        },
      });

      if (renderErr || renderData?.error) {
        throw new Error(renderData?.error || renderErr?.message || "다시 시도해 주세요");
      }

      setProgress(60);
      const rdId = renderData.renderId;
      pollCountRef.current = 0;

      // 4. Poll — max 20 times (100 seconds)
      pollRef.current = window.setInterval(async () => {
        pollCountRef.current++;

        if (pollCountRef.current > 20) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setErrorMsg("잠시 후 다시 시도해 주세요");
          setStep("error");
          return;
        }

        try {
          const { data: statusData } = await supabase.functions.invoke("generate-shorts", {
            body: { action: "check-status", renderId: rdId, videoId: vid },
          });

          if (statusData?.status === "완료") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setVideoUrl(statusData.videoUrl);
            setProgress(100);
            setStep("done");
          } else if (statusData?.status === "실패") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setErrorMsg(statusData?.error || "다시 시도해 주세요");
            setStep("error");
          } else {
            setProgress(p => Math.min(p + 2, 95));
          }
        } catch {
          // keep polling
        }
      }, 5000);

    } catch (err: any) {
      console.error("Shorts generation error:", err);
      setStep("error");
      setErrorMsg(err.message || "다시 시도해 주세요");
      toast({ title: "영상 생성 실패", description: err.message, variant: "destructive" });
    }
  };

  const handleDownload = () => {
    if (videoUrl) {
      const a = document.createElement("a");
      a.href = videoUrl;
      a.download = "shorts-video.mp4";
      a.click();
      toast({ title: "✅ 영상이 다운로드됩니다" });
    }
  };

  const handleDeeplink = (platform: string) => {
    const links: Record<string, string> = {
      tiktok: "snssdk1233://",
      instagram: "instagram://",
    };
    window.location.href = links[platform] || "";
  };

  const quotaExceeded = videoUsed >= videoLimit;

  // ─── Config screen ───
  if (step === "config") {
    return (
      <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">🎬 쇼츠 영상 만들기</h1>
          <button onClick={onClose}><X className="w-6 h-6 text-muted-foreground" /></button>
        </div>

        {photos.length < 2 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
            ⚠️ 사진이 2장 이상 필요합니다 (현재 {photos.length}장)
          </div>
        )}

        <div className="bg-card rounded-[--radius] border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">🎥 영상 스타일</p>
          <div className="space-y-2">
            {videoStyles.map(s => (
              <button key={s.id} onClick={() => setVideoStyle(s.id)}
                className={`w-full text-left px-4 py-3 rounded-[--radius] border-2 transition-all ${videoStyle === s.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <p className="font-semibold text-sm">{s.emoji} {s.label}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-[--radius] border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">🎤 나레이션 목소리</p>
          <div className="flex flex-wrap gap-2">
            {narrationTypes.map(n => (
              <Badge key={n.id} variant={narration === n.id ? "chipActive" : "chip"}
                className="text-sm px-4 py-2 cursor-pointer" onClick={() => setNarration(n.id)}>
                {n.emoji} {n.label}
              </Badge>
            ))}
          </div>
        </div>

        <UsageMeter used={videoUsed} max={videoLimit} plan={subscription.plan} />

        <Button variant="hero" size="xl" className="w-full" onClick={handleGenerate}
          disabled={photos.length < 2 || quotaExceeded}>
          <Film className="w-6 h-6" />
          영상 생성 시작
        </Button>
      </div>
    );
  }

  // ─── Progress screen ───
  if (step === "scripting" || step === "narration" || step === "rendering") {
    const stepOrder: ShortsStep[] = ["scripting", "narration", "rendering", "done"];
    const currentIdx = stepOrder.indexOf(step);
    return (
      <div className="px-4 pt-6 pb-24 space-y-6 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Film className="w-10 h-10 text-primary animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-center">영상을 생성하고 있습니다</h2>
        <div className="w-full max-w-xs">
          <div className="w-full bg-secondary rounded-full h-3">
            <div className="bg-primary rounded-full h-3 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="space-y-3 w-full max-w-xs">
          <StepItem label="🎬 스크립트 생성 중..." active={currentIdx === 0} done={currentIdx > 0} />
          <StepItem label="🎵 나레이션 생성 중..." active={currentIdx === 1} done={currentIdx > 1} />
          <StepItem label="🎥 영상 렌더링 중..." active={currentIdx === 2} done={currentIdx > 2} />
          <StepItem label="✅ 영상 완성!" active={false} done={false} />
        </div>
        {step === "rendering" && (
          <p className="text-xs text-muted-foreground text-center">렌더링에 약 30~60초 소요됩니다.<br/>다른 작업을 하셔도 됩니다.</p>
        )}
      </div>
    );
  }

  // ─── Done screen ───
  if (step === "done") {
    return (
      <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>
        <h2 className="text-xl font-bold">영상이 완성되었습니다!</h2>

        {videoUrl && (
          <video src={videoUrl} controls className="w-full max-w-xs rounded-xl border border-border aspect-[9/16]" />
        )}

        <div className="w-full max-w-xs space-y-3">
          <Button className="w-full" onClick={handleDownload}>
            <Download className="w-5 h-5" /> 갤러리에 저장
          </Button>
          <Button variant="outline" className="w-full" style={{ borderColor: "#000", color: "#000" }}
            onClick={() => handleDeeplink("tiktok")}>
            🎵 틱톡 앱 열기
          </Button>
          <Button variant="outline" className="w-full" style={{ borderColor: "#E1306C", color: "#E1306C" }}
            onClick={() => handleDeeplink("instagram")}>
            📷 인스타 릴스 열기
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => { setStep("config"); setProgress(0); setVideoUrl(null); }}>
            <RotateCcw className="w-5 h-5" /> 다시 만들기
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>돌아가기</Button>
        </div>
      </div>
    );
  }

  // ─── Error screen ───
  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
        <X className="w-10 h-10 text-destructive" />
      </div>
      <h2 className="text-xl font-bold">영상 생성 실패</h2>
      <p className="text-sm text-muted-foreground text-center">{errorMsg || "다시 시도해 주세요"}</p>
      <div className="space-y-3 w-full max-w-xs">
        <Button className="w-full" onClick={() => { setStep("config"); setProgress(0); setErrorMsg(""); }}>
          <RotateCcw className="w-5 h-5" /> 다시 시도
        </Button>
        <Button variant="ghost" className="w-full" onClick={onClose}>돌아가기</Button>
      </div>
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

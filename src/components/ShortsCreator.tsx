import { useState, useCallback, useEffect, useRef } from "react";
import { Film, CheckCircle2, Download, RotateCcw, X, Play, Check, Loader2, Square, Camera, ImagePlus } from "lucide-react";
import { TestModeBadge } from "@/components/TestModeBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores/appStore";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { renderMirraVideo, isRecordingSupported, isIOSDevice, type MirraScene, type VoiceConfig } from "@/lib/mirraRenderer";

type VideoStyle = "시공일지형" | "홍보형" | "Before/After형";
type BgmType = "upbeat" | "calm" | "none";
type ShortsStep = "config" | "generating" | "done" | "error";

interface VoiceOption {
  id: string;
  label: string;
  desc: string;
  gender: "male" | "female";
  lang: string;
  pitch: number;
  rate: number;
  voiceNameHint: string[];
}

// Web Speech API voices — mapped to Korean-compatible system voices
const VOICES: VoiceOption[] = [
  { id: "male_calm", label: "남성 — 차분한", desc: "낮고 안정적", gender: "male", lang: "ko-KR", pitch: 0.85, rate: 0.85, voiceNameHint: ["Google 한국의", "Yuna", "Korean Male"] },
  { id: "male_pro", label: "남성 — 전문적", desc: "신뢰감 있는", gender: "male", lang: "ko-KR", pitch: 0.95, rate: 0.9, voiceNameHint: ["Google 한국의", "Korean Male"] },
  { id: "male_strong", label: "남성 — 힘있는", desc: "에너지 넘치는", gender: "male", lang: "ko-KR", pitch: 1.0, rate: 1.0, voiceNameHint: ["Google 한국의", "Korean Male"] },
  { id: "female_friendly", label: "여성 — 친근한", desc: "따뜻하고 밝은", gender: "female", lang: "ko-KR", pitch: 1.1, rate: 0.9, voiceNameHint: ["Google 한국의", "Yuna", "Korean Female"] },
  { id: "female_pro", label: "여성 — 전문적", desc: "자신감 있는", gender: "female", lang: "ko-KR", pitch: 1.0, rate: 0.95, voiceNameHint: ["Google 한국의", "Yuna", "Korean Female"] },
  { id: "female_bright", label: "여성 — 밝은", desc: "젊고 활기찬", gender: "female", lang: "ko-KR", pitch: 1.2, rate: 1.0, voiceNameHint: ["Google 한국의", "Yuna", "Korean Female"] },
];

const videoStyles: { id: VideoStyle; label: string; desc: string; emoji: string }[] = [
  { id: "시공일지형", label: "시공일지형", desc: "시공 전→중→후 순서", emoji: "📋" },
  { id: "홍보형", label: "홍보형", desc: "완료컷 강조 + 업체 정보", emoji: "📢" },
  { id: "Before/After형", label: "Before/After형", desc: "전후 비교 중심", emoji: "🔄" },
];

const bgmOptions: { id: BgmType; label: string; emoji: string }[] = [
  { id: "upbeat", label: "경쾌한", emoji: "🎵" },
  { id: "calm", label: "잔잔한", emoji: "🎶" },
  { id: "none", label: "없음", emoji: "🔇" },
];

const PLAN_LIMITS: Record<string, number> = {
  "무료": 0, "베이직": 5, "프로": 20, "비즈니스": 50, "무제한": 999,
};

const PREVIEW_TEXT = "안녕하세요. 방수 전문 시공업체입니다.";

function getKoreanVoice(voiceOption: VoiceOption): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  const koVoices = voices.filter(v => v.lang.startsWith("ko"));

  // Try matching by hint names
  for (const hint of voiceOption.voiceNameHint) {
    const match = koVoices.find(v => v.name.includes(hint));
    if (match) return match;
  }

  // Fallback to any Korean voice
  return koVoices[0] || null;
}

function UsageMeter({ used, max, plan }: { used: number; max: number; plan: string }) {
  const ratio = max > 0 ? used / max : 1;
  const barColor = ratio >= 1 ? "#EF4444" : ratio >= 0.8 ? "#F97316" : "#237FFF";
  const pct = Math.min(ratio * 100, 100);

  return (
    <div className="bg-card rounded-[--radius] border border-border p-4 space-y-2">
      <div className="flex justify-between items-baseline">
        <p className="text-sm font-semibold">🎬 이번 달 영상</p>
        <p className="text-sm font-bold" style={{ color: barColor }}>{used} / {max}개</p>
      </div>
      <div className="w-full bg-secondary rounded-full h-2.5">
        <div className="rounded-full h-2.5 transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      {ratio >= 1 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
          <p className="text-xs text-destructive font-medium">
            이번 달 영상 횟수를 모두 사용했습니다.
            {plan === "베이직" && " 프로 플랜으로 업그레이드하면 월 20개까지 가능해요."}
            {plan === "프로" && " 비즈니스 플랜으로 업그레이드하면 월 50개까지 가능해요."}
          </p>
          {plan !== "비즈니스" && plan !== "무제한" && (
            <Button size="sm" variant="outline" className="text-xs border-primary text-primary">
              플랜 업그레이드
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function VoiceCard({
  voice, selected, onSelect, onPreview, isPlaying,
}: {
  voice: VoiceOption; selected: boolean; onSelect: () => void;
  onPreview: () => void; isPlaying: boolean;
}) {
  const genderEmoji = voice.gender === "male" ? "👨" : "👩";

  return (
    <button
      onClick={onSelect}
      className="relative w-full text-left p-3 rounded-xl transition-all"
      style={{
        border: selected ? "2px solid hsl(215 100% 50%)" : "1px solid hsl(var(--border))",
        backgroundColor: selected ? "hsl(215 100% 97%)" : "hsl(var(--card))",
      }}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "#237FFF" }}>
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      <p className="text-sm font-semibold text-foreground">{genderEmoji} {voice.label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{voice.desc}</p>
      <button
        onClick={(e) => { e.stopPropagation(); onPreview(); }}
        className="mt-2 flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors"
        style={{
          backgroundColor: isPlaying ? "hsl(215 100% 50%)" : "hsl(var(--secondary))",
          color: isPlaying ? "white" : "hsl(var(--muted-foreground))",
        }}
      >
        {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        {isPlaying ? "정지" : "미리 듣기"}
      </button>
    </button>
  );
}

export function ShortsCreator({ onClose, autoStart = false }: { onClose: () => void; autoStart?: boolean }) {
  const { photos, settings, subscription, addPhoto, removePhoto, posts } = useAppStore();
  const hasAutoStarted = useRef(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);

  const [videoStyle, setVideoStyle] = useState<VideoStyle>("시공일지형");
  const [bgm, setBgm] = useState<BgmType>("upbeat");
  const [selectedVoice, setSelectedVoice] = useState<string | null>("male_calm");
  const [step, setStep] = useState<ShortsStep>("config");
  const [progressText, setProgressText] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [pendingNarration, setPendingNarration] = useState<{ texts: string[]; voiceConfig: VoiceConfig } | null>(null);

  // Play TTS only after the result screen is visible
  useEffect(() => {
    if (step !== "done" || !videoUrl || !pendingNarration) return;
    const { texts, voiceConfig: vc } = pendingNarration;
    setPendingNarration(null);

    let cancelled = false;
    (async () => {
      for (const text of texts) {
        if (cancelled || !text) continue;
        await new Promise<void>((resolve) => {
          if (!window.speechSynthesis) {
            resolve();
            return;
          }
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = vc.lang;
          utterance.pitch = vc.pitch;
          utterance.rate = vc.rate;
          const voices = speechSynthesis.getVoices();
          const koVoices = voices.filter(v => v.lang.startsWith("ko"));
          for (const hint of vc.voiceNameHint) {
            const match = koVoices.find(v => v.name.includes(hint));
            if (match) { utterance.voice = match; break; }
          }
          if (!utterance.voice && koVoices[0]) utterance.voice = koVoices[0];
          const timeout = setTimeout(() => resolve(), 15000);
          utterance.onend = () => { clearTimeout(timeout); resolve(); };
          utterance.onerror = () => { clearTimeout(timeout); resolve(); };
          speechSynthesis.speak(utterance);
        });
      }
    })();

    return () => {
      cancelled = true;
      if (window.speechSynthesis) speechSynthesis.cancel();
    };
  }, [step, videoUrl, pendingNarration]);

  const videoLimit = PLAN_LIMITS[subscription.plan] || 5;
  const [videoUsed] = useState(2);
  const quotaExceeded = videoUsed >= videoLimit;

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
    // Auto-scroll to style section when enough photos
    setTimeout(() => {
      if (photos.length >= 1 && styleRef.current) {
        styleRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 300);
  };

  // Preload voices
  useEffect(() => {
    speechSynthesis.getVoices();
    const handler = () => speechSynthesis.getVoices();
    speechSynthesis.addEventListener("voiceschanged", handler);
    return () => speechSynthesis.removeEventListener("voiceschanged", handler);
  }, []);

  // Auto-start generation when opened with autoStart prop
  useEffect(() => {
    if (autoStart && !hasAutoStarted.current && photos.length >= 2) {
      hasAutoStarted.current = true;
      handleGenerate();
    }
  }, [autoStart]);

  const handlePreviewVoice = useCallback((voice: VoiceOption) => {
    // Stop any current speech
    speechSynthesis.cancel();

    if (playingVoice === voice.id) {
      setPlayingVoice(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(PREVIEW_TEXT);
    utterance.lang = voice.lang;
    utterance.pitch = voice.pitch;
    utterance.rate = voice.rate;

    const synthVoice = getKoreanVoice(voice);
    if (synthVoice) utterance.voice = synthVoice;

    utterance.onend = () => setPlayingVoice(null);
    utterance.onerror = () => setPlayingVoice(null);

    setPlayingVoice(voice.id);
    speechSynthesis.speak(utterance);
  }, [playingVoice]);

  const handleGenerate = useCallback(async () => {
    if (photos.length < 2) {
      toast({ title: "사진이 2장 이상 필요합니다", variant: "destructive" });
      return;
    }

    if (!isRecordingSupported()) {
      toast({ title: "이 기기에서는 영상 생성을 지원하지 않습니다", description: "최신 Chrome 또는 Safari 브라우저를 사용해 주세요.", variant: "destructive" });
      return;
    }

    if (isIOSDevice()) {
      toast({ title: "📱 아이폰 안내", description: "아이폰에서는 영상 자동 저장이 제한됩니다.\n제어센터 → 화면 기록 버튼으로 저장해 주세요." });
    }

    if (window.speechSynthesis) speechSynthesis.cancel();
    setPlayingVoice(null);
    setPendingNarration(null);
    setErrorMsg("");

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    setStep("generating");
    setProgressText("🎬 AI 스크립트 생성 중...");
    setProgressPct(10);

    const narrationEnabled = selectedVoice !== null;
    const voice = VOICES.find(v => v.id === selectedVoice);

    try {
      const { data: scriptData, error: scriptErr } = await supabase.functions.invoke("generate-shorts", {
        body: {
          photos: photos.slice(0, 5).map(p => ({ dataUrl: p.dataUrl })),
          workType: "자동판단",
          videoStyle,
          narrationType: narrationEnabled ? "있음" : "없음",
          location: "",
          buildingType: "",
          constructionDate: new Date().toISOString().slice(0, 10),
          companyName: settings.companyName,
          phoneNumber: settings.phoneNumber,
        },
      });

      if (scriptErr) throw new Error(scriptErr.message);

      const scenes: MirraScene[] = scriptData?.scenes || [];
      if (scenes.length === 0) throw new Error("스크립트 생성 실패");

      setProgressText("🎥 텍스트 애니메이션 렌더링 중...");
      setProgressPct(25);

      const voiceConfig = narrationEnabled && voice ? {
        lang: voice.lang,
        pitch: voice.pitch,
        rate: voice.rate,
        voiceNameHint: voice.voiceNameHint,
      } : undefined;

      const result = await renderMirraVideo(
        photos.slice(0, 5).map(p => ({ dataUrl: p.dataUrl })),
        scenes,
        settings.companyName,
        settings.phoneNumber,
        narrationEnabled,
        (current, total) => {
          const pct = 25 + Math.round((current / total) * 70);
          setProgressPct(pct);
          setProgressText(`🎥 장면 렌더링 중... (${current}/${total})`);
        },
        undefined,
        voiceConfig,
      );

      const url = URL.createObjectURL(result.blob);
      setVideoUrl(url);
      setProgressPct(100);
      setStep("done");

      if (narrationEnabled && voiceConfig && result.narrationTexts.some(Boolean)) {
        requestAnimationFrame(() => {
          setPendingNarration({ texts: result.narrationTexts, voiceConfig });
        });
      }

      toast({ title: "✅ 영상이 완성되었습니다!" });


    } catch (err: any) {
      console.error("Shorts generation error:", err);
      setStep("error");
      if (err.message === "UNSUPPORTED") {
        setErrorMsg("이 기기에서는 영상 생성을 지원하지 않습니다. 최신 Chrome 브라우저를 사용해 주세요.");
      } else {
        setErrorMsg(err.message || "다시 시도해 주세요");
      }
    }
  }, [photos, videoStyle, selectedVoice, settings, toast]);

  const handleDownload = () => {
    if (videoUrl) {
      const a = document.createElement("a");
      a.href = videoUrl;
      a.download = `sms_shorts_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: "✅ 영상이 다운로드됩니다" });
    }
  };

  const handleDeeplink = (platform: string) => {
    const links: Record<string, string> = { tiktok: "snssdk1233://", instagram: "instagram://" };
    window.location.href = links[platform] || "";
  };

  const handleReset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (window.speechSynthesis) speechSynthesis.cancel();
    setPendingNarration(null);
    setPlayingVoice(null);
    setStep("config");
    setProgressPct(0);
    setVideoUrl(null);
    setErrorMsg("");
  };

  // ─── Config ───
  if (step === "config") {
    return (
      <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">🎬 쇼츠 영상 만들기</h1>
          <button onClick={onClose}><X className="w-6 h-6 text-muted-foreground" /></button>
        </div>

        {/* Photo upload area */}
        <div className="bg-card rounded-[--radius] border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">📷 사진 추가하기</p>
          {photos.length < 2 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
              ⚠️ 사진이 2장 이상 필요합니다 (현재 {photos.length}장)
            </div>
          )}

          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {photos.map((photo) => (
                <div key={photo.id} className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-border">
                  <img src={photo.dataUrl} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(photo.id)} className="absolute top-0.5 right-0.5 bg-destructive rounded-full p-0.5">
                    <X className="w-3 h-3 text-destructive-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="w-4 h-4" /> 갤러리에서 선택
            </Button>
            <Button variant="secondary" size="sm" className="w-full" onClick={() => cameraInputRef.current?.click()}>
              <Camera className="w-4 h-4" /> 카메라로 촬영
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">최대 10장, 최소 2장</p>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

        <div ref={styleRef} className="bg-card rounded-[--radius] border border-border p-4 space-y-3">
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
          <p className="text-sm font-semibold">🎙️ 나레이션 목소리</p>
          <div className="grid grid-cols-2 gap-2">
            {VOICES.map(v => (
              <VoiceCard
                key={v.id}
                voice={v}
                selected={selectedVoice === v.id}
                onSelect={() => setSelectedVoice(v.id)}
                onPreview={() => handlePreviewVoice(v)}
                isPlaying={playingVoice === v.id}
              />
            ))}
          </div>
          <button
            onClick={() => { setSelectedVoice(null); speechSynthesis.cancel(); setPlayingVoice(null); }}
            className="w-full text-center py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              border: selectedVoice === null ? "2px solid hsl(215 100% 50%)" : "1px solid hsl(var(--border))",
              backgroundColor: selectedVoice === null ? "hsl(215 100% 97%)" : "hsl(var(--card))",
              color: selectedVoice === null ? "hsl(215 100% 50%)" : "hsl(var(--muted-foreground))",
            }}
          >
            🔇 나레이션 없음 — BGM만
          </button>
        </div>

        <div className="bg-card rounded-[--radius] border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">🎵 배경 음악</p>
          <div className="flex flex-wrap gap-2">
            {bgmOptions.map(b => (
              <Badge key={b.id} variant={bgm === b.id ? "chipActive" : "chip"}
                className="text-sm px-4 py-2 cursor-pointer" onClick={() => setBgm(b.id)}>
                {b.emoji} {b.label}
              </Badge>
            ))}
          </div>
        </div>

        <UsageMeter used={videoUsed} max={videoLimit} plan={subscription.plan} />

        <div className="space-y-2">
          {(() => {
            const hasPhotos = photos.length >= 2;
            const latestPost = posts.length > 0 ? posts[0] : null;
            const hasText = latestPost && latestPost.blocks.length > 0 && latestPost.blocks.some((b: any) => b.type === "text" && b.content);
            const canGenerate = hasPhotos && hasText && !quotaExceeded;
            const message = !hasPhotos && !hasText
              ? "사진과 글이 모두 필요합니다"
              : !hasPhotos
              ? "사진을 2장 이상 추가해 주세요"
              : !hasText
              ? "AI 글쓰기를 먼저 완료해 주세요"
              : null;
            return (
              <>
                <Button
                  size="xl"
                  className="w-full"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  style={canGenerate ? { background: "linear-gradient(135deg, #237FFF 0%, #AB5EBE 100%)", color: "white" } : {}}
                  variant={canGenerate ? "default" : "secondary"}
                >
                  <Film className="w-6 h-6" /> 영상 생성 시작
                </Button>
                {message && (
                  <p className="text-xs text-muted-foreground text-center">{message}</p>
                )}
              </>
            );
          })()}
          <div className="flex justify-center">
            <TestModeBadge label="테스트 모드" inline />
          </div>
        </div>
      </div>
    );
  }

  // ─── Generating ───
  if (step === "generating") {
    return (
      <div className="px-4 pt-6 pb-24 space-y-6 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Film className="w-10 h-10 text-primary animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-center">영상을 생성하고 있습니다</h2>
        <p className="text-sm text-muted-foreground">{progressText}</p>
        <div className="w-full max-w-xs">
          <div className="w-full bg-secondary rounded-full h-3">
            <div className="bg-primary rounded-full h-3 transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">약 15~30초 소요됩니다</p>
      </div>
    );
  }

  // ─── Done ───
  if (step === "done") {
    return (
      <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-[#22C55E]" />
        </div>
        <h2 className="text-xl font-bold">영상이 완성되었습니다!</h2>

        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            autoPlay
            playsInline
            className="w-full max-w-xs rounded-xl border border-border aspect-[9/16]"
          />
        ) : (
          <div className="w-full max-w-xs rounded-xl border border-border aspect-[9/16] flex items-center justify-center bg-card">
            <p className="text-sm text-muted-foreground">미리보기를 불러오는 중...</p>
          </div>
        )}

        <div className="w-full max-w-xs space-y-3">
          <Button className="w-full" onClick={handleDownload} disabled={!videoUrl}>
            <Download className="w-5 h-5" /> 갤러리에 저장
          </Button>
          <Button variant="outline" className="w-full" style={{ borderColor: "#000", color: "#000" }}
            onClick={() => handleDeeplink("tiktok")}>
            틱톡 앱 열기
          </Button>
          <Button variant="outline" className="w-full" style={{ borderColor: "#E1306C", color: "#E1306C" }}
            onClick={() => handleDeeplink("instagram")}>
            인스타 릴스 열기
          </Button>
          <Button variant="secondary" className="w-full" onClick={handleReset}>
            <RotateCcw className="w-5 h-5" /> 다시 만들기
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>돌아가기</Button>
        </div>
      </div>
    );
  }

  // ─── Error ───
  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
        <X className="w-10 h-10 text-destructive" />
      </div>
      <h2 className="text-xl font-bold">영상 생성 실패</h2>
      <p className="text-sm text-muted-foreground text-center">{errorMsg || "다시 시도해 주세요"}</p>
      <div className="space-y-3 w-full max-w-xs">
        <Button className="w-full" onClick={handleReset}>
          <RotateCcw className="w-5 h-5" /> 다시 시도
        </Button>
        <Button variant="ghost" className="w-full" onClick={onClose}>돌아가기</Button>
      </div>
    </div>
  );
}

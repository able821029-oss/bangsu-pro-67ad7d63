import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { Film, CheckCircle2, Download, RotateCcw, X, Play, Check, Loader2, Square, Camera, ImagePlus, Music, VolumeX, Mic, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores/appStore";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { previewBgm, preloadLogo, isRecordingSupported, isIOSDevice, type MirraScene, type VoiceConfig, type BgmType } from "@/lib/bgmSynth";
import { compressPhotos } from "@/lib/imageCompress";
import { fetchWithRetry, invokeWithRetry } from "@/lib/fetchWithRetry";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { mirraToRemotionScene, type SmsScene, type SmsVideoProps } from "@/remotion/types";

// Remotion Player is heavy and uses browser APIs that can fail in embedded
// WebViews (KakaoTalk inapp). Lazy-load so opening the shorts tab never crashes
// on module evaluation.
const ShortsPlayer = lazy(() => import("@/components/ShortsPlayer"));

type VideoStyle = "시공일지형" | "홍보형" | "Before/After형";
type ShortsStep = "config" | "generating" | "done" | "error" | "ios_guide";

/** KakaoTalk/라인/페이스북 등 카카오·SNS 인앱 브라우저 감지 */
function isInAppBrowser(): { isInApp: boolean; name: string } {
  if (typeof navigator === "undefined") return { isInApp: false, name: "" };
  const ua = navigator.userAgent || "";
  if (/KAKAOTALK/i.test(ua)) return { isInApp: true, name: "카카오톡" };
  if (/\bLine\//i.test(ua)) return { isInApp: true, name: "라인" };
  if (/FBAN|FBAV|Instagram/i.test(ua)) return { isInApp: true, name: "페이스북/인스타" };
  if (/NAVER\(inapp/i.test(ua)) return { isInApp: true, name: "네이버" };
  return { isInApp: false, name: "" };
}

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
  { id: "male_calm", label: "남성 — 차분한", desc: "낮고 안정적", gender: "male", lang: "ko-KR", pitch: 0.5, rate: 0.6, voiceNameHint: ["Google 한국의", "Korean Male"] },
  { id: "male_pro", label: "남성 — 전문적", desc: "신뢰감 있는", gender: "male", lang: "ko-KR", pitch: 0.7, rate: 0.7, voiceNameHint: ["Google 한국의", "Korean Male"] },
  { id: "male_strong", label: "남성 — 힘있는", desc: "에너지 넘치는", gender: "male", lang: "ko-KR", pitch: 0.9, rate: 0.85, voiceNameHint: ["Google 한국의", "Korean Male"] },
  { id: "female_friendly", label: "여성 — 친근한", desc: "따뜻하고 밝은", gender: "female", lang: "ko-KR", pitch: 1.4, rate: 0.7, voiceNameHint: ["Google 한국의", "Yuna", "Korean Female"] },
  { id: "female_pro", label: "여성 — 전문적", desc: "자신감 있는", gender: "female", lang: "ko-KR", pitch: 1.15, rate: 0.75, voiceNameHint: ["Google 한국의", "Yuna", "Korean Female"] },
  { id: "female_bright", label: "여성 — 밝은", desc: "젊고 활기찬", gender: "female", lang: "ko-KR", pitch: 1.7, rate: 0.9, voiceNameHint: ["Google 한국의", "Yuna", "Korean Female"] },
];

const videoStyles: { id: VideoStyle; label: string; desc: string; icon: string }[] = [
  { id: "시공일지형", label: "작업일지형", desc: "준비 → 작업 → 완성 순서", icon: "clipboard" },
  { id: "홍보형", label: "홍보형", desc: "완성컷 강조 + 업체 정보", icon: "megaphone" },
  { id: "Before/After형", label: "Before/After형", desc: "전후 비교 중심", icon: "refresh" },
];

const bgmOptions: { id: BgmType; label: string; emoji: string; desc: string }[] = [
  { id: "upbeat",    label: "에너지",     emoji: "⚡", desc: "강한 비트 · 다이나믹" },
  { id: "hiphop",   label: "트렌디",      emoji: "🔥", desc: "틱톡 트랩 · MZ 스타일" },
  { id: "corporate", label: "프로페셔널", emoji: "💼", desc: "신뢰감 · 전문 느낌" },
  { id: "emotional", label: "감동",       emoji: "✨", desc: "성취감 · 완성 무드" },
  { id: "calm",      label: "잔잔함",     emoji: "🌿", desc: "깨끗하고 차분한 톤" },
  { id: "none",      label: "없음",        emoji: "🔇", desc: "무음" },
];

const PLAN_LIMITS: Record<string, number> = {
  "무료": 1, "베이직": 5, "프로": 20, "비즈니스": 50, "무제한": 999,
};

const PREVIEW_TEXT = "안녕하세요. 오늘도 정성껏 작업합니다.";

function UsageMeter({ used, max, plan, onUpgrade }: { used: number; max: number; plan: string; onUpgrade: () => void }) {
  const ratio = max > 0 ? used / max : 1;
  const barColor = ratio >= 1 ? "#EF4444" : ratio >= 0.8 ? "#F97316" : "#237FFF";
  const pct = Math.min(ratio * 100, 100);

  return (
    <div className="bg-card rounded-[--radius] border border-border p-4 space-y-2">
      <div className="flex justify-between items-baseline">
        <p className="text-sm font-semibold flex items-center gap-1.5"><Film className="w-4 h-4 text-primary" /> 이번 달 영상</p>
        <p className="text-sm font-bold" style={{ color: barColor }}>{used} / {max}개</p>
      </div>
      <div className="w-full bg-secondary rounded-full h-2.5">
        <div className="rounded-full h-2.5 transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      {ratio >= 1 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
          <p className="text-xs text-destructive font-medium">
            이번 달 영상 횟수를 모두 사용했습니다.
            {plan === "무료" && " 베이직 플랜으로 업그레이드하면 월 5개까지 가능해요."}
            {plan === "베이직" && " 프로 플랜으로 업그레이드하면 월 20개까지 가능해요."}
            {plan === "프로" && " 비즈니스 플랜으로 업그레이드하면 월 50개까지 가능해요."}
          </p>
          {plan !== "비즈니스" && plan !== "무제한" && (
            <Button size="sm" variant="outline" className="text-xs border-primary text-primary"
              onClick={onUpgrade}>
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
  const genderIcon = voice.gender === "male" ? "M" : "F";

  return (
    <button
      onClick={onSelect}
      className="relative w-full text-left p-3 rounded-xl transition-all"
      style={{
        border: selected ? "2px solid hsl(215 100% 50%)" : "1px solid hsl(var(--border))",
        backgroundColor: selected ? "hsl(var(--muted))" : "hsl(var(--card))",
      }}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center bg-primary">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      <p className="text-sm font-semibold text-foreground">{genderIcon} {voice.label}</p>
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

export function ShortsCreator({ onClose, onNavigate, autoStart = false }: { onClose: () => void; onNavigate?: (tab: string) => void; autoStart?: boolean }) {
  const { photos, settings, subscription, addPhoto, removePhoto, posts, addShortsVideo } = useAppStore();
  const { user } = useAuth();
  const hasAutoStarted = useRef(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);

  const [videoStyle, setVideoStyle] = useState<VideoStyle>("시공일지형");
  const [bgm, setBgm] = useState<BgmType>("upbeat");
  const [previewingBgm, setPreviewingBgm] = useState<BgmType | null>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string | null>("male_calm");
  const [scriptMode, setScriptMode] = useState<"ai" | "manual">("ai");
  const [manualScript, setManualScript] = useState("");
  const [workTopic, setWorkTopic] = useState(""); // 오늘의 작업 한 줄 (AI 힌트)
  const [step, setStep] = useState<ShortsStep>("config");
  const [remotionScenes, setRemotionScenes] = useState<SmsScene[]>([]);
  const [progressText, setProgressText] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const pendingAudioRef = useRef<{
    narrationAudios: (string | null)[];
    narrationTexts: string[];
    voiceConfig: VoiceConfig | null;
    bgmType: BgmType;
  } | null>(null);
  const audioPlayedRef = useRef(false);
  const bgmCtxRef = useRef<AudioContext | null>(null);
  const narrationAudioRefs = useRef<HTMLAudioElement[]>([]);

  // Play narration + BGM when done screen appears
  useEffect(() => {
    if (step !== "done") return;
    const audio = pendingAudioRef.current;
    if (!audio || audioPlayedRef.current) return;
    audioPlayedRef.current = true; // 한 번만 재생

    const { narrationAudios, narrationTexts, voiceConfig, bgmType } = audio;
    let cancelled = false;

    // ── 1. BGM 재생 ──
    if (bgmType !== "none") {
      try {
        const bgmCtx = previewBgm(bgmType);
        bgmCtxRef.current = bgmCtx;
        const totalSec = remotionScenes.reduce((sum, s) => sum + s.durationInFrames, 0) / 30 + 5;
        setTimeout(() => {
          if (!cancelled && bgmCtxRef.current) {
            bgmCtxRef.current.close().catch(() => {});
            bgmCtxRef.current = null;
          }
        }, totalSec * 1000);
      } catch (e) {
        console.warn("[BGM] 재생 실패:", e);
      }
    }

    // ── 2. 나레이션 재생 ──
    (async () => {
      // 약간 딜레이 후 나레이션 시작 (BGM과 겹치도록)
      await new Promise(r => setTimeout(r, 500));

      const hasElevenLabsAudio = narrationAudios.some(Boolean);

      if (hasElevenLabsAudio) {
        for (let i = 0; i < narrationAudios.length; i++) {
          if (cancelled) break;
          const b64 = narrationAudios[i];
          if (!b64) continue;

          await new Promise<void>((resolve) => {
            try {
              const binary = atob(b64);
              const bytes = new Uint8Array(binary.length);
              for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
              const blob = new Blob([bytes], { type: "audio/mpeg" });
              const url = URL.createObjectURL(blob);
              const a = new Audio(url);
              narrationAudioRefs.current.push(a);
              const timeout = setTimeout(() => resolve(), 20000);
              a.onended = () => { clearTimeout(timeout); URL.revokeObjectURL(url); resolve(); };
              a.onerror = () => { clearTimeout(timeout); URL.revokeObjectURL(url); resolve(); };
              a.play().catch(() => { clearTimeout(timeout); resolve(); });
            } catch {
              resolve();
            }
          });
          if (!cancelled) await new Promise(r => setTimeout(r, 300));
        }
      }
      // ElevenLabs 오디오가 없으면 무음 재생 (Web Speech API 폴백 제거)
    })();

    return () => {
      cancelled = true;
      narrationAudioRefs.current.forEach(a => { a.pause(); a.src = ""; });
      narrationAudioRefs.current = [];
      if (bgmCtxRef.current) { bgmCtxRef.current.close().catch(() => {}); bgmCtxRef.current = null; }
    };
  }, [step]);

  // 심플 월 영상 횟수 시스템
  const { useVideo } = useAppStore();
  const videoUsed = subscription.videoUsed ?? 0;
  const videoLimit = subscription.maxVideo ?? 1;
  const quotaExceeded = videoUsed >= videoLimit;

  const incrementVideoUsed = () => { useVideo(); };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (photos.length >= 6) return;
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

  // Auto-start generation when opened with autoStart prop
  useEffect(() => {
    if (autoStart && !hasAutoStarted.current && photos.length >= 2) {
      hasAutoStarted.current = true;
      handleGenerate();
    }
  }, [autoStart]);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 브라우저 내장 TTS(무료, 즉시) — 미리듣기 전용. 최종 영상은 ElevenLabs 사용.
  const playWithWebSpeech = useCallback((voice: VoiceOption): boolean => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    try {
      // 기존 재생 중이면 즉시 중단
      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(PREVIEW_TEXT);
      utter.lang = voice.lang || "ko-KR";
      utter.pitch = voice.pitch ?? 1;
      utter.rate = voice.rate ?? 1;

      // 사용 가능한 한국어 음성 중 성별 힌트에 맞는 것 선택
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const koVoices = voices.filter((v) => v.lang?.startsWith("ko"));
        const pool = koVoices.length > 0 ? koVoices : voices;
        const byHint = pool.find((v) =>
          voice.voiceNameHint?.some((h) => v.name?.toLowerCase().includes(h.toLowerCase())),
        );
        utter.voice = byHint ?? pool[0];
      }

      utter.onend = () => { setPlayingVoice(null); speechUtteranceRef.current = null; };
      utter.onerror = () => { setPlayingVoice(null); speechUtteranceRef.current = null; };
      speechUtteranceRef.current = utter;
      window.speechSynthesis.speak(utter);
      return true;
    } catch {
      return false;
    }
  }, []);

  const handlePreviewVoice = useCallback(async (voice: VoiceOption) => {
    // 현재 재생 중이면 정지
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (speechUtteranceRef.current && typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
      speechUtteranceRef.current = null;
    }

    if (playingVoice === voice.id) {
      setPlayingVoice(null);
      return;
    }

    setPlayingVoice(voice.id);

    // 1) ElevenLabs 우선 — 최종 영상과 동일한 음성 프로필로 미리듣기 (품질 우선)
    try {
      const { data, error } = await supabase.functions.invoke("tts-preview", {
        body: { voiceId: voice.id, text: PREVIEW_TEXT },
      });
      if (!error && data?.ok && data?.audio) {
        const binary = atob(data.audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        previewAudioRef.current = audio;
        audio.onended = () => { setPlayingVoice(null); URL.revokeObjectURL(url); previewAudioRef.current = null; };
        audio.onerror = () => { setPlayingVoice(null); URL.revokeObjectURL(url); previewAudioRef.current = null; };
        await audio.play();
        return;
      }
      if (data?.error) console.warn("[TTS] ElevenLabs 응답 에러:", data.error, data.detail);
    } catch (err) {
      console.warn("[TTS] ElevenLabs 호출 실패:", err);
    }

    // 2) 폴백: 브라우저 내장 Web Speech API — ElevenLabs 할당량 초과/네트워크 오류 시
    if (playWithWebSpeech(voice)) return;

    setPlayingVoice(null);
    toast({
      title: "음성 미리듣기를 사용할 수 없어요",
      description: "최신 크롬/사파리를 사용해 주세요.",
      variant: "destructive",
    });
  }, [playingVoice, toast, playWithWebSpeech]);

  const handleBgmPreview = (id: BgmType) => {
    // 이미 재생 중이면 정지
    if (previewCtxRef.current) {
      previewCtxRef.current.close().catch(() => {});
      previewCtxRef.current = null;
    }
    if (previewingBgm === id || id === "none") {
      setPreviewingBgm(null);
      return;
    }
    setPreviewingBgm(id);
    const ctx = previewBgm(id);
    previewCtxRef.current = ctx;
    // 6초 후 자동 종료
    setTimeout(() => {
      if (previewCtxRef.current === ctx) {
        ctx?.close().catch(() => {});
        previewCtxRef.current = null;
        setPreviewingBgm(null);
      }
    }, 6200);
  };

  const handleGenerate = useCallback(async () => {
    // 미리듣기 중이면 정지
    if (previewCtxRef.current) {
      previewCtxRef.current.close().catch(() => {});
      previewCtxRef.current = null;
      setPreviewingBgm(null);
    }
    if (photos.length < 2) {
      toast({ title: "사진이 2장 이상 필요합니다", variant: "destructive" });
      return;
    }

    // 필수 입력 검증 — AI 자동 모드일 때만
    if (scriptMode === "ai") {
      if (!workTopic.trim()) {
        toast({
          title: "오늘의 작업을 한 줄 입력해 주세요",
          description: "예) 욕실 방수 시공 / 외벽 균열 보수 / 옥상 방수",
          variant: "destructive",
        });
        return;
      }
    }

    if (!isRecordingSupported()) {
      toast({ title: "이 기기에서는 영상 생성을 지원하지 않습니다", description: "최신 Chrome 또는 Safari 브라우저를 사용해 주세요.", variant: "destructive" });
      return;
    }

    if (isIOSDevice()) {
      setStep("ios_guide");
      return;
    }


    if (bgmCtxRef.current) { bgmCtxRef.current.close().catch(() => {}); bgmCtxRef.current = null; }
    narrationAudioRefs.current.forEach(a => { a.pause(); a.src = ""; });
    narrationAudioRefs.current = [];
    pendingAudioRef.current = null;
    audioPlayedRef.current = false;
    setPlayingVoice(null);
    setErrorMsg("");

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    // 업체 로고 프리로드 (엔딩 카드에 표시)
    preloadLogo(settings.logoUrl || "");

    setStep("generating");
    setProgressText("📝 사진 분석 중...");
    setProgressPct(10);

    const narrationEnabled = selectedVoice !== null;
    const voice = VOICES.find(v => v.id === selectedVoice);

    try {
      // 사진 압축 (Edge Function 6MB 제한 대응)
      const compressedPhotos = await compressPhotos(photos.slice(0, 6));
      const { data: scriptData, error: scriptErr } = await invokeWithRetry(supabase, "generate-shorts", {
        photos: compressedPhotos.map((dataUrl, i) => ({ dataUrl, index: i + 1 })),
        workType: "자동판단",
        videoStyle,
        narrationType: narrationEnabled ? "있음" : "없음",
        voiceId: selectedVoice || "male_pro",
        scriptMode,
        manualScript: scriptMode === "manual" ? manualScript : undefined,
        maxDurationSec: 120, // 2분 제한
        location: settings.serviceArea || "",
        buildingType: "",
        constructionDate: new Date().toISOString().slice(0, 10),
        companyName: settings.companyName,
        phoneNumber: settings.phoneNumber,
        workTopic: workTopic.trim(),                        // 오늘의 작업 한 줄
      });

      if (scriptErr) throw new Error(scriptErr.message);

      const scenes: MirraScene[] = scriptData?.scenes || [];
      if (scenes.length === 0) throw new Error("스크립트 생성 실패");

      // Remotion 형식으로 변환
      const rScenes = scenes.map((s, i) => mirraToRemotionScene(s, i));
      setRemotionScenes(rScenes);
      console.warn("[SMS] 영상 장면:", rScenes.map((s, i) => `${i}: ${s.title}`).join(" | "));

      setProgressText("🎬 텍스트 애니메이션 합성 중...");
      setProgressPct(25);

      const voiceConfig = narrationEnabled && voice ? {
        lang: voice.lang,
        pitch: voice.pitch,
        rate: voice.rate,
        voiceNameHint: voice.voiceNameHint,
      } : undefined;

      const narrationAudios: (string | null)[] = scriptData?.narrationAudios || [];
      console.warn(`[SMS] 나레이션: ${narrationAudios.filter(Boolean).length}/${narrationAudios.length}개 ElevenLabs 오디오, BGM: ${bgm}`);

      // ── Railway 서버 직접 호출 (Supabase 150s 제한 우회) ──
      setProgressText("🖥️ 서버에서 영상 렌더링 중...");
      setProgressPct(20);

      // env가 https:// 없이 도메인만 세팅된 경우 자동 보정 (CF Pages 설정 실수 방어)
      const rawUrl =
        (import.meta.env.VITE_VIDEO_SERVER_URL as string | undefined) ||
        "https://bangsu-pro-67ad7d63-production-6e2e.up.railway.app";
      const RAILWAY_URL = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

      let renderData: { videoUrl?: string; error?: string; detail?: string } | null = null;
      let renderErrMsg: string | null = null;
      try {
        // 일시적 502/504/네트워크 오류 시 자동으로 최대 2회 재시도 (총 3번 시도).
        // Remotion 렌더는 길어질 수 있어 timeout 3분.
        const r = await fetchWithRetry(`${RAILWAY_URL}/render-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenes,
            photos: compressedPhotos,
            narrationAudios,
            companyName: settings.companyName,
            phoneNumber: settings.phoneNumber,
            bgmType: bgm,
          }),
          retries: 2,
          retryDelayMs: 1500,
          timeoutMs: 180_000,
        });
        renderData = await r.json().catch(() => null);
        if (!r.ok) renderErrMsg = renderData?.error || `HTTP ${r.status}`;
      } catch (e: any) {
        renderErrMsg = e?.message || "네트워크 오류";
      }

      const serverRenderOk = !renderErrMsg && !renderData?.error && !!renderData?.videoUrl;
      if (serverRenderOk && renderData?.videoUrl) {
        // 서버 렌더링 성공 → MP4에 나레이션/BGM이 이미 합쳐져 있음 (이중 재생 방지)
        setVideoUrl(renderData.videoUrl);

        // 보관함에 저장 — 나중에 다시 다운로드할 수 있도록
        const savedVideo = {
          id: crypto.randomUUID(),
          title: workTopic.trim() || scenes[0]?.title || "무제 쇼츠",
          videoUrl: renderData.videoUrl,
          thumbnailDataUrl: compressedPhotos[0] || undefined,
          videoStyle,
          voiceId: selectedVoice || undefined,
          bgmType: bgm,
          scenesPreview: scenes.slice(0, 6).map((s) => s.title || "").filter(Boolean),
          photoCount: photos.length,
          createdAt: new Date().toISOString(),
        };
        addShortsVideo(savedVideo);

        if (user) {
          // DB에 저장 (실패해도 로컬 보관함은 유지)
          void supabase.from("shorts_videos").insert({
            id: savedVideo.id,
            user_id: user.id,
            title: savedVideo.title,
            video_url: savedVideo.videoUrl,
            thumbnail_data_url: savedVideo.thumbnailDataUrl || null,
            video_style: savedVideo.videoStyle || null,
            voice_id: savedVideo.voiceId || null,
            bgm_type: savedVideo.bgmType || null,
            scenes_preview: savedVideo.scenesPreview || null,
            photo_count: savedVideo.photoCount,
          }).then(({ error }) => {
            if (error) console.warn("[shorts_videos] DB insert 실패 (테이블 미생성일 수 있음):", error.message);
          });
        }
      } else {
        console.warn("[SMS] 서버 렌더링 실패:", renderData?.error || renderErrMsg);
      }

      // 나레이션 + BGM 재생 예약 (서버 렌더 실패 시 클라이언트 폴백 재생)
      audioPlayedRef.current = false;
      pendingAudioRef.current = {
        narrationAudios: !serverRenderOk && narrationEnabled ? narrationAudios : [],
        narrationTexts: [],
        voiceConfig: null,
        bgmType: serverRenderOk ? "none" : bgm,
      };

      setProgressPct(100);
      setStep("done");
      toast({ title: "영상이 완성되었습니다! 🎬" });
      incrementVideoUsed();

    } catch (err: any) {
      console.error("Shorts generation error:", err);
      setStep("error");
      if (err.message === "UNSUPPORTED") {
        setErrorMsg("이 기기에서는 영상 생성을 지원하지 않습니다. 최신 Chrome 브라우저를 사용해 주세요.");
      } else {
        setErrorMsg((err.message || "다시 시도해 주세요").slice(0, 200));
      }
    }
  }, [photos, videoStyle, selectedVoice, settings, toast, workTopic, scriptMode, manualScript, bgm, videoUrl]);

  const handleDownload = async () => {
    if (!videoUrl) {
      toast({
        title: "영상이 아직 준비되지 않았어요",
        description: "서버 렌더링이 지연되거나 실패했습니다. '다시 만들기'로 재시도해 주세요.",
        variant: "destructive",
      });
      return;
    }
    try {
      // blob으로 다운로드 — 직접 a[download]는 크로스도메인에서 무시될 수 있음
      const res = await fetch(videoUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sms_shorts_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: "영상이 다운로드됩니다" });
    } catch {
      // 폴백: 새 창으로 열어 브라우저가 다운로드 처리
      window.open(videoUrl, "_blank");
      toast({ title: "새 창에서 영상을 저장해 주세요", description: "우클릭 → 다른 이름으로 저장" });
    }
  };

  const handleDeeplink = (platform: string) => {
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    const links: Record<string, { mobile: string; pc: string }> = {
      tiktok: { mobile: "snssdk1233://", pc: "https://www.tiktok.com/upload" },
      instagram: { mobile: "instagram://", pc: "https://www.instagram.com/" },
    };
    const target = links[platform];
    if (!target) return;
    window.open(isMobile ? target.mobile : target.pc, "_blank");
  };

  const handleReset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);

    if (bgmCtxRef.current) { bgmCtxRef.current.close().catch(() => {}); bgmCtxRef.current = null; }
    narrationAudioRefs.current.forEach(a => { a.pause(); a.src = ""; });
    narrationAudioRefs.current = [];
    pendingAudioRef.current = null;
    audioPlayedRef.current = false;
    setPlayingVoice(null);
    setStep("config");
    setProgressPct(0);
    setVideoUrl(null);
    setErrorMsg("");
  };

  // ─── Config ───
  if (step === "config") {
    return (
      <div
        className="bg-background px-4 pt-6 pb-32 space-y-5 max-w-lg mx-auto"
        style={{
          minHeight: "100dvh",
          paddingBottom: "calc(8rem + env(safe-area-inset-bottom, 0px))",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2"><Film className="w-5 h-5 text-primary" /> 쇼츠 영상 만들기</h1>
          <button onClick={onClose} aria-label="닫기"><X className="w-6 h-6 text-muted-foreground" /></button>
        </div>

        {/* 인앱 브라우저 경고 — KakaoTalk/Line/FB 인앱에서는 영상 기능 제한적 */}
        {(() => {
          const { isInApp, name } = isInAppBrowser();
          if (!isInApp) return null;
          return (
            <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 space-y-2">
              <p className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {name} 내부 브라우저 안내
              </p>
              <p className="text-xs text-amber-200 leading-relaxed">
                현재 <b>{name}</b> 안에서 앱을 열고 계십니다. 내부 브라우저는 일부 영상/오디오
                기능이 제한되어 쇼츠 제작이 정상 동작하지 않을 수 있습니다.
              </p>
              <p className="text-xs text-amber-200">
                우측 상단 <b>⋮</b> 또는 <b>공유</b> 아이콘을 눌러{" "}
                <b>Chrome · Safari 브라우저로 열기</b>를 선택해 주세요.
              </p>
            </div>
          );
        })()}

        {/* Photo upload area */}
        <div className="bg-card rounded-[--radius] border border-border p-4 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-1.5"><Camera className="w-4 h-4 text-primary" /> 사진 추가하기</p>
          {photos.length < 2 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" /> 사진이 2장 이상 필요합니다 (현재 {photos.length}장)
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
          <p className="text-sm font-semibold flex items-center gap-1.5"><Film className="w-4 h-4 text-primary" /> 영상 스타일</p>
          <div className="space-y-2">
            {videoStyles.map(s => (
              <button key={s.id} onClick={() => setVideoStyle(s.id)}
                className={`w-full text-left px-4 py-3 rounded-[--radius] border-2 transition-all ${videoStyle === s.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <p className="font-semibold text-sm">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 스크립트 작성 모드 */}
        <div className="bg-card rounded-[--radius] border border-border p-4 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: "16px" }}>edit_note</span>
            스크립트 작성
          </p>
          <div className="flex gap-2">
            <button onClick={() => setScriptMode("ai")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${scriptMode === "ai" ? "bg-[#4C8EFF] text-[#00285C]" : "bg-[#25293A] text-[#8B90A0]"}`}>
              🤖 AI 자동 작성
            </button>
            <button onClick={() => setScriptMode("manual")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${scriptMode === "manual" ? "bg-[#4C8EFF] text-[#00285C]" : "bg-[#25293A] text-[#8B90A0]"}`}>
              ✍️ 직접 작성
            </button>
          </div>
          {scriptMode === "manual" && (
            <div className="space-y-2">
              <textarea
                value={manualScript}
                onChange={e => setManualScript(e.target.value)}
                placeholder={"장면별 나레이션을 줄바꿈으로 구분해주세요\n\n예시:\n오늘 준비를 시작합니다\n정성껏 작업을 진행합니다\n만족스럽게 완성했습니다\n편하게 문의 주세요"}
                rows={6}
                className="w-full bg-[#161B2B] border border-white/5 rounded-xl p-3 text-sm text-[#DEE1F7] placeholder-[#8B90A0] focus-visible:outline-none focus:ring-1 focus:ring-[#ADC6FF]/40 resize-none"
              />
              <p className="text-[10px] text-[#8B90A0]">
                최대 2분 영상 · 줄바꿈 = 장면 구분 · {manualScript.split("\n").filter(Boolean).length}개 장면
              </p>
            </div>
          )}
          {scriptMode === "ai" && (
            <div className="space-y-3">
              <p className="text-xs text-[#8B90A0]">
                사진과 오늘의 작업 힌트를 조합하여 AI가 시공 현장에 맞는 나레이션을 생성합니다.
              </p>

              {/* 오늘의 작업 한 줄 (필수) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  오늘의 작업 <span className="text-[#EF4444]">*</span>
                  <span className="text-[10px] font-normal text-muted-foreground ml-auto">
                    {workTopic.length}/30
                  </span>
                </label>
                <input
                  type="text"
                  value={workTopic}
                  maxLength={30}
                  onChange={(e) => setWorkTopic(e.target.value)}
                  placeholder="예) 욕실 방수 시공 / 신메뉴 파스타 / 커트+염색"
                  className="w-full bg-[#161B2B] border border-white/5 rounded-xl px-3 py-3 text-sm text-[#DEE1F7] placeholder-[#8B90A0] focus-visible:outline-none focus:ring-1 focus:ring-[#ADC6FF]/40"
                />
                <p className="text-[10px] text-muted-foreground">
                  짧고 구체적으로 써주세요. AI가 이 문구를 힌트로 스크립트를 생성합니다.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-card rounded-[--radius] border border-border p-4 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-1.5"><Mic className="w-4 h-4 text-primary" /> 나레이션 목소리</p>
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
            onClick={() => { setSelectedVoice(null); setPlayingVoice(null); }}
            className="w-full text-center py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              border: selectedVoice === null ? "2px solid hsl(215 100% 50%)" : "1px solid hsl(var(--border))",
              backgroundColor: selectedVoice === null ? "hsl(var(--muted))" : "hsl(var(--card))",
              color: selectedVoice === null ? "hsl(215 100% 50%)" : "hsl(var(--muted-foreground))",
            }}
          >
            <VolumeX className="w-4 h-4 inline mr-1" /> 나레이션 없음 — BGM만
          </button>
        </div>

        <div className="bg-card rounded-[--radius] border border-border p-4 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-1.5"><Music className="w-4 h-4 text-primary" /> 배경 음악</p>
          <div className="grid grid-cols-2 gap-2">
            {bgmOptions.map(b => (
              <div
                key={b.id}
                onClick={() => setBgm(b.id)}
                className="text-left p-3 rounded-xl transition-all cursor-pointer"
                style={{
                  border: bgm === b.id ? "2px solid #237FFF" : "1px solid rgba(255,255,255,0.12)",
                  background: bgm === b.id ? "rgba(35,127,255,0.1)" : "hsl(var(--card))",
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base">{b.emoji}</span>
                  {bgm === b.id && <Check className="w-3.5 h-3.5 text-primary" />}
                </div>
                <p className="text-xs font-semibold leading-none mb-0.5">{b.label}</p>
                <p className="text-[10px] text-muted-foreground leading-none mb-2">{b.desc}</p>
                {b.id !== "none" && (
                  <button
                    onClick={e => { e.stopPropagation(); handleBgmPreview(b.id); }}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full w-full justify-center font-medium"
                    style={{
                      background: previewingBgm === b.id ? "#237FFF" : "rgba(35,127,255,0.15)",
                      color: previewingBgm === b.id ? "#fff" : "#237FFF",
                      border: "1px solid rgba(35,127,255,0.3)",
                    }}
                  >
                    {previewingBgm === b.id
                      ? <><Square className="w-2.5 h-2.5 mr-0.5" /> 정지</>
                      : <><Play className="w-2.5 h-2.5 mr-0.5" /> 미리듣기</>}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 이번달 영상 현황 */}
        <UsageMeter used={videoUsed} max={videoLimit} plan={subscription.plan}
          onUpgrade={() => { sessionStorage.setItem("sms-open-settings-page", "pricing"); if (onNavigate) { onNavigate("mypage"); } }} />

        <div className="space-y-2">
          {(() => {
            const hasPhotos = photos.length >= 2;
            const canGenerate = hasPhotos && !quotaExceeded;
            const message = !hasPhotos
              ? "사진을 2장 이상 추가해 주세요"
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
          </div>
        </div>
      </div>
    );
  }

  // ─── Generating ───
  if (step === "generating") {
    const stages = [
      { label: "사진 분석 및 스크립트 생성", done: progressPct >= 25 },
      { label: "나레이션 음성 합성", done: progressPct >= 30 },
      { label: "장면 렌더링", done: progressPct >= 95 },
      { label: "영상 완성", done: progressPct >= 100 },
    ];
    return (
      <div className="px-4 pt-6 pb-24 space-y-6 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Film className="w-10 h-10 text-primary animate-pulse" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold">영상을 생성하고 있습니다</h2>
          <p className="text-sm text-muted-foreground">{progressText}</p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>진행률</span><span className="font-semibold text-primary">{Math.round(progressPct)}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-3">
            <div className="bg-primary rounded-full h-3 transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="w-full max-w-xs space-y-2">
          {stages.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              {s.done
                ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                : i === stages.findIndex(st => !st.done)
                  ? <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                  : <div className="w-5 h-5 rounded-full border-2 border-border shrink-0" />}
              <p className={`text-sm ${s.done ? "text-green-500" : i === stages.findIndex(st => !st.done) ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">사진이 많을수록 영상이 길어집니다 (15~60초 소요)</p>
      </div>
    );
  }

  // ─── Done ───
  if (step === "done") {
    return (
      <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>
        <h2 className="text-xl font-bold">영상이 완성되었습니다!</h2>
        {/* ElevenLabs 연동 완료 시 안내 제거, 미연동 시 안내 표시 */}

        {remotionScenes.length > 0 ? (
          <div className="w-full max-w-xs rounded-xl border border-border overflow-hidden">
            <ErrorBoundary fallbackTitle="미리보기를 표시할 수 없습니다">
              <Suspense
                fallback={
                  <div className="aspect-[9/16] flex items-center justify-center bg-muted">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <ShortsPlayer
                  scenes={remotionScenes}
                  photos={photos.slice(0, 6).map(p => p.dataUrl)}
                  companyName={settings.companyName || "SMS"}
                  phoneNumber={settings.phoneNumber || ""}
                  logoUrl={settings.logoUrl || undefined}
                  bgmType={bgm}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        ) : videoUrl ? (
          <video src={videoUrl} controls autoPlay playsInline
            className="w-full max-w-xs rounded-xl border border-border aspect-[9/16]" />
        ) : (
          <div className="w-full max-w-xs rounded-xl border border-border aspect-[9/16] flex items-center justify-center bg-card">
            <p className="text-sm text-muted-foreground">미리보기를 불러오는 중...</p>
          </div>
        )}

        <div className="w-full max-w-xs space-y-3">
          {/* 저장 — videoUrl이 없으면(서버 렌더 실패) 비활성화 + 설명 */}
          {videoUrl ? (
            <Button
              className="w-full gap-2"
              style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)", color: "white" }}
              onClick={handleDownload}
            >
              <Download className="w-5 h-5" /> 갤러리에 저장
            </Button>
          ) : (
            <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <p className="text-xs text-amber-500 font-semibold">⚠️ 서버 렌더링이 실패했어요</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                잠시 서버가 바쁘거나 일시적 오류일 수 있습니다. 아래 <strong>다시 만들기</strong>를
                눌러 재시도해 주세요.
              </p>
            </div>
          )}
          {/* SNS 업로드 */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center font-medium">SNS 업로드</p>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => handleDeeplink("tiktok")}
                className="flex flex-col items-center gap-1 py-3 rounded-xl border border-border text-xs font-medium hover:bg-secondary transition-colors">
                <span className="text-lg">⬛</span> 틱톡
              </button>
              <button onClick={() => handleDeeplink("instagram")}
                className="flex flex-col items-center gap-1 py-3 rounded-xl border border-[#E1306C]/40 text-[#E1306C] text-xs font-medium hover:bg-[#E1306C]/5 transition-colors">
                <span className="text-lg">🟣</span> 릴스
              </button>
              <button onClick={() => window.open("https://m.youtube.com/upload", "_blank")}
                className="flex flex-col items-center gap-1 py-3 rounded-xl border border-[#FF0000]/40 text-[#FF0000] text-xs font-medium hover:bg-[#FF0000]/5 transition-colors">
                <span className="text-lg">🔴</span> 쇼츠
              </button>
            </div>
          </div>
          <div className="border-t border-border pt-2 space-y-2">
            <Button variant="secondary" className="w-full gap-2" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" /> 다시 만들기
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>홈으로 돌아가기</Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (step === "error") {
    return (
      <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <X className="w-10 h-10 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold">영상 생성 실패</h2>
          <p className="text-sm text-muted-foreground mt-2">{errorMsg || "다시 시도해 주세요"}</p>
        </div>
        <div className="space-y-2 w-full max-w-xs">
          <Button className="w-full" onClick={handleReset}><RotateCcw className="w-4 h-4" /> 다시 시도</Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>돌아가기</Button>
        </div>
      </div>
    );
  }

  // ─── iOS Guide ───
  if (step === "ios_guide") {
    return (
      <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="text-5xl">📱</div>
        <h2 className="text-xl font-bold">아이폰 화면 녹화 안내</h2>
        <p className="text-sm text-muted-foreground">
          아이폰(iOS)은 브라우저에서 영상 저장이 제한됩니다.<br/>
          아래 순서로 화면 녹화로 저장하세요.
        </p>
        <div className="w-full bg-card border border-border rounded-2xl p-4 space-y-3 text-left">
          {[
            "아이폰 설정 → 제어 센터 → 화면 기록 추가",
            "SMS 앱으로 돌아와 아래 '영상 재생 시작' 버튼 클릭",
            "화면 상단 오른쪽 아래로 스와이프 → 제어 센터 열기",
            "화면 기록 버튼(⏺) 3초 누르기 → 녹화 시작",
            "SMS로 돌아와 영상 재생 — 완료 후 녹화 중지",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
              <p className="text-sm">{step}</p>
            </div>
          ))}
        </div>
        <Button
          className="w-full"
          style={{ background: "linear-gradient(135deg, #237FFF, #AB5EBE)", color: "white" }}
          onClick={() => { setStep("config"); handleGenerate(); }}
        >
          <Film className="w-5 h-5" /> 영상 재생 시작
        </Button>
        <Button variant="ghost" className="w-full" onClick={onClose}>취소</Button>
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

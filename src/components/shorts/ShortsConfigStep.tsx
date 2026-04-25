// 쇼츠 Config 화면 — 사진·스타일·스크립트·음성·BGM·워크토픽
// 2026-04-24 Phase 4 — ShortsCreator.tsx의 config step 분리.
// 미리듣기(음성/BGM) 및 파일 선택 관련 state/refs/handler 일체 내부화.

import { useCallback, useRef, useState } from "react";
import {
  Film, X, Play, Check, Square, Camera, ImagePlus, Music, VolumeX, Mic, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { previewBgm, type BgmType } from "@/lib/bgmSynth";
import type { PhotoItem } from "@/stores/appStore";
import type { VideoStyle, VoiceOption } from "./types";
import { VOICES, VIDEO_STYLES, BGM_OPTIONS, PREVIEW_TEXT, isInAppBrowser } from "./constants";
import { UsageMeter } from "./UsageMeter";
import { VoiceCard } from "./VoiceCard";

export interface ShortsConfigStepProps {
  photos: PhotoItem[];
  onAddPhoto: (photo: { id: string; dataUrl: string }) => void;
  onRemovePhoto: (id: string) => void;

  videoStyle: VideoStyle;
  setVideoStyle: (v: VideoStyle) => void;

  bgm: BgmType;
  setBgm: (v: BgmType) => void;

  selectedVoice: string | null;
  setSelectedVoice: (v: string | null) => void;

  scriptMode: "ai" | "manual";
  setScriptMode: (v: "ai" | "manual") => void;

  manualScript: string;
  setManualScript: (v: string) => void;

  workTopic: string;
  setWorkTopic: (v: string) => void;

  subscription: { videoUsed?: number; maxVideo?: number; plan: string };

  onUpgradeNavigate: () => void;
  onClose: () => void;
  onGenerate: () => void;
  toast: (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
}

export function ShortsConfigStep({
  photos, onAddPhoto, onRemovePhoto,
  videoStyle, setVideoStyle,
  bgm, setBgm,
  selectedVoice, setSelectedVoice,
  scriptMode, setScriptMode,
  manualScript, setManualScript,
  workTopic, setWorkTopic,
  subscription,
  onUpgradeNavigate, onClose, onGenerate, toast,
}: ShortsConfigStepProps) {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [previewingBgm, setPreviewingBgm] = useState<BgmType | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);

  const videoUsed = subscription.videoUsed ?? 0;
  const videoLimit = subscription.maxVideo ?? 1;
  const quotaExceeded = videoUsed >= videoLimit;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (photos.length >= 6) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        onAddPhoto({ id: crypto.randomUUID(), dataUrl: ev.target?.result as string });
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

  // 브라우저 내장 TTS(무료, 즉시) — 미리듣기 전용. 최종 영상은 ElevenLabs 사용.
  const playWithWebSpeech = useCallback((voice: VoiceOption): boolean => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    try {
      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(PREVIEW_TEXT);
      utter.lang = voice.lang || "ko-KR";
      utter.pitch = voice.pitch ?? 1;
      utter.rate = voice.rate ?? 1;

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

    // 1) ElevenLabs 우선 — 최종 영상과 동일한 음성 프로필
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

    // 2) 폴백: 브라우저 내장 Web Speech API
    if (playWithWebSpeech(voice)) return;

    setPlayingVoice(null);
    toast({
      title: "음성 미리듣기를 사용할 수 없어요",
      description: "최신 크롬/사파리를 사용해 주세요.",
      variant: "destructive",
    });
  }, [playingVoice, toast, playWithWebSpeech]);

  const handleBgmPreview = (id: BgmType) => {
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
    setTimeout(() => {
      if (previewCtxRef.current === ctx) {
        ctx?.close().catch(() => {});
        previewCtxRef.current = null;
        setPreviewingBgm(null);
      }
    }, 6200);
  };

  // "영상 생성 시작" — 내부 미리듣기 정지 후 외부 onGenerate 호출
  const handleStartGenerate = useCallback(() => {
    if (previewCtxRef.current) {
      previewCtxRef.current.close().catch(() => {});
      previewCtxRef.current = null;
      setPreviewingBgm(null);
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (speechUtteranceRef.current && typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
      speechUtteranceRef.current = null;
    }
    setPlayingVoice(null);
    onGenerate();
  }, [onGenerate]);

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

      {/* 인앱 브라우저 경고 */}
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
                <button onClick={() => onRemovePhoto(photo.id)} className="absolute top-0.5 right-0.5 bg-destructive rounded-full p-0.5">
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
          {VIDEO_STYLES.map(s => (
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
          <p className="text-xs text-[#8B90A0]">
            사진과 오늘의 작업 힌트를 조합하여 AI가 시공 현장에 맞는 나레이션을 생성합니다.
            <br />
            <span className="text-[#AB5EBE] font-semibold">↓ 아래 &quot;오늘의 작업&quot; 입력란을 채워 주세요</span>
          </p>
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
          {BGM_OPTIONS.map(b => (
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
      <UsageMeter used={videoUsed} max={videoLimit} plan={subscription.plan} onUpgrade={onUpgradeNavigate} />

      {/* 오늘의 작업 */}
      {scriptMode === "ai" && (
        <div
          className="rounded-2xl p-4 space-y-2 shadow-lg"
          style={{
            background: "linear-gradient(135deg, rgba(35,127,255,0.12), rgba(171,94,190,0.12))",
            border: `1.5px solid ${workTopic.trim() ? "rgba(35,127,255,0.45)" : "rgba(239,68,68,0.55)"}`,
            boxShadow: workTopic.trim()
              ? "0 0 18px rgba(35,127,255,0.18)"
              : "0 0 18px rgba(239,68,68,0.22)",
          }}
        >
          <label className="flex items-center gap-2 text-sm font-bold text-foreground">
            <span className="inline-flex w-6 h-6 rounded-full items-center justify-center bg-gradient-to-br from-[#237FFF] to-[#AB5EBE] text-white text-[11px] font-black">!</span>
            오늘의 작업
            <span className="text-[#EF4444]">*</span>
            <span className="text-[10px] font-normal text-muted-foreground ml-auto">
              {workTopic.length}/30
            </span>
          </label>
          <input
            type="text"
            value={workTopic}
            maxLength={30}
            onChange={(e) => setWorkTopic(e.target.value)}
            placeholder="예) 욕실 방수 시공 / 옥상 우레탄 도장 / 외벽 보수"
            className="w-full bg-background/80 border border-white/10 rounded-xl px-4 py-3 text-[15px] font-semibold text-foreground placeholder:text-muted-foreground placeholder:font-normal focus-visible:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            짧고 구체적으로 써주세요. AI가 이 문구를 힌트로 스크립트와 나레이션을 생성합니다.
            {!workTopic.trim() && (
              <span className="block mt-1 text-[#EF4444] font-semibold">⚠ 비워두면 영상 생성이 안 됩니다</span>
            )}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {(() => {
          const hasPhotos = photos.length >= 2;
          const canGenerate = hasPhotos && !quotaExceeded;
          const message = !hasPhotos ? "사진을 2장 이상 추가해 주세요" : null;
          return (
            <>
              <Button
                size="xl"
                className="w-full"
                onClick={handleStartGenerate}
                disabled={!canGenerate}
                style={canGenerate ? { background: "linear-gradient(135deg, #237FFF 0%, #AB5EBE 100%)", color: "white" } : {}}
                variant={canGenerate ? "default" : "secondary"}
              >
                <Film className="w-6 h-6" /> 자막 만들기 (영상은 다음 단계)
              </Button>
              {message && (
                <p className="text-xs text-muted-foreground text-center">{message}</p>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ShortsCreator — 쇼츠 제작 오케스트레이터
// 2026-04-24 Phase 4 — 735줄 → ~120줄. 5개 Step 컴포넌트로 위임.
//
// 책임:
//  - Config 선택 state(videoStyle/bgm/voice/scriptMode/manualScript/workTopic) 보유
//  - useShortsPipeline 훅 호출 (generate/reset/진행률/videoUrl 전부 훅이 관리)
//  - step에 따라 적절한 Step 컴포넌트 렌더
//  - useAppStore/useAuth/useToast는 여기서만 호출하고 props로 전달
//  - autoStart: 부모에서 자동으로 generate 트리거

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import type { BgmType } from "@/lib/bgmSynth";
import type { VideoStyle } from "./shorts/types";
import { useShortsPipeline } from "./shorts/useShortsPipeline";
import { ShortsConfigStep } from "./shorts/ShortsConfigStep";
import { ShortsGeneratingStep } from "./shorts/ShortsGeneratingStep";
import { ShortsDoneStep } from "./shorts/ShortsDoneStep";
import { ShortsErrorStep } from "./shorts/ShortsErrorStep";
import { ShortsIosGuideStep } from "./shorts/ShortsIosGuideStep";
import { ShortsScriptReviewStep } from "./shorts/ShortsScriptReviewStep";

interface ShortsCreatorProps {
  onClose: () => void;
  onNavigate?: (tab: string) => void;
  autoStart?: boolean;
}

export function ShortsCreator({ onClose, onNavigate, autoStart = false }: ShortsCreatorProps) {
  const { photos, settings, subscription, addPhoto, removePhoto, addShortsVideo, useVideo } = useAppStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const hasAutoStarted = useRef(false);

  // Config 선택 state — 훅 입력
  const [videoStyle, setVideoStyle] = useState<VideoStyle>("시공일지형");
  const [bgm, setBgm] = useState<BgmType>("upbeat");
  const [selectedVoice, setSelectedVoice] = useState<string | null>("male_calm");
  const [scriptMode, setScriptMode] = useState<"ai" | "manual">("ai");
  const [manualScript, setManualScript] = useState("");
  const [workTopic, setWorkTopic] = useState("");

  // 파이프라인 훅 — 생성/리셋/진행률/videoUrl 전부 훅이 관리
  const pipeline = useShortsPipeline({
    photos,
    videoStyle,
    bgm,
    selectedVoice,
    scriptMode,
    manualScript,
    workTopic,
    settings,
    user: user ? { id: user.id } : null,
    onUsed: () => { useVideo(); },
    onSaved: addShortsVideo,
    toast,
  });
  const {
    step,
    setStep,
    progressText,
    progressPct,
    elapsedSec,
    videoUrl,
    remotionScenes,
    errorMsg,
    scenes,
    setScenes,
    generateScript,
    generateVideo,
    reset,
  } = pipeline;

  // Auto-start: 자막 생성 단계부터 자동 시작 (검수 후 사용자 클릭으로 영상 진입)
  useEffect(() => {
    if (autoStart && !hasAutoStarted.current && photos.length >= 2) {
      hasAutoStarted.current = true;
      void generateScript();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const handleUpgradeNavigate = useCallback(() => {
    sessionStorage.setItem("sms-open-settings-page", "pricing");
    if (onNavigate) onNavigate("mypage");
  }, [onNavigate]);

  // iOS Guide → '영상 재생 시작' 클릭 시: config로 돌아간 뒤 자막 단계부터 다시
  const handleIosStartPlayback = useCallback(() => {
    setStep("config");
    void generateScript();
  }, [setStep, generateScript]);

  if (step === "config") {
    return (
      <ShortsConfigStep
        photos={photos}
        onAddPhoto={addPhoto}
        onRemovePhoto={removePhoto}
        videoStyle={videoStyle}
        setVideoStyle={setVideoStyle}
        bgm={bgm}
        setBgm={setBgm}
        selectedVoice={selectedVoice}
        setSelectedVoice={setSelectedVoice}
        scriptMode={scriptMode}
        setScriptMode={setScriptMode}
        manualScript={manualScript}
        setManualScript={setManualScript}
        workTopic={workTopic}
        setWorkTopic={setWorkTopic}
        subscription={subscription}
        onUpgradeNavigate={handleUpgradeNavigate}
        onClose={onClose}
        onGenerate={() => { void generateScript(); }}
        toast={toast}
      />
    );
  }

  // 자막 생성 중 (5~10초) — generating 과 동일한 진행 화면
  if (step === "script_loading") {
    return (
      <ShortsGeneratingStep
        progressText={progressText || "📝 자막 생성 중..."}
        progressPct={progressPct}
        elapsedSec={elapsedSec}
      />
    );
  }

  // 자막 검수·수정 화면 — 사용자가 영상 만들기 전에 텍스트 점검
  if (step === "script_review") {
    return (
      <ShortsScriptReviewStep
        scenes={scenes}
        photos={photos}
        onChange={setScenes}
        onBack={reset}
        onRegenerate={() => { void generateScript(); }}
        onConfirm={() => { void generateVideo(); }}
      />
    );
  }

  if (step === "generating") {
    return (
      <ShortsGeneratingStep
        progressText={progressText}
        progressPct={progressPct}
        elapsedSec={elapsedSec}
      />
    );
  }

  if (step === "done") {
    return (
      <ShortsDoneStep
        videoUrl={videoUrl}
        remotionScenes={remotionScenes}
        photos={photos}
        settings={settings}
        bgm={bgm}
        onReset={reset}
        onClose={onClose}
        toast={toast}
      />
    );
  }

  if (step === "ios_guide") {
    return (
      <ShortsIosGuideStep
        onStartPlayback={handleIosStartPlayback}
        onClose={onClose}
      />
    );
  }

  // error (기본 fallback 포함)
  return (
    <ShortsErrorStep
      errorMsg={errorMsg}
      onRetry={reset}
      onClose={onClose}
      onUpgrade={() => {
        // MyPage의 요금제 서브페이지로 진입
        sessionStorage.setItem("sms-open-settings-page", "pricing");
        if (onNavigate) onNavigate("mypage");
        else onClose();
      }}
    />
  );
}

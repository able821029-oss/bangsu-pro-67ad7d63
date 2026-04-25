// useShortsPipeline — 쇼츠 생성 파이프라인 훅
// 2026-04-24 추출 — ShortsCreator.tsx의 handleGenerate(365줄) + 재생/리셋 로직 이관.
// 2026-04-25 Railway 제거 — Shotstack 렌더 + generate-shorts-status 폴링으로 단순화.
//
// 불변 규칙 (기능 회귀 방지용 체크리스트):
//  1. 사전 게이트 ①: narrationEnabled && validAudioCount === 0 → 차단 (throw)
//  2. 부분 실패 허용: failedScenes.length > 0 && validAudioCount > 0 → 토스트만
//  3. iOS 감지: isIOSDevice() → step = "ios_guide"
//  4. 서버 렌더 실패 시 '완성' 오인 방지: serverRenderOk=false → throw (→ error step)
//  5. shorts_videos 404 격리: isTableKnownMissing/markTableMissing 사용
//  6. Web Speech 폴백 완전 제거 (서버 MP4 내장 오디오만 재생)
//  7. (삭제됨 — Railway 제거)
//  8. Shotstack 폴링: generate-shorts-status 3초 간격, 5분 타임아웃
//  9. 서버 progress(0~100) → 클라 30~92 구간 매핑 (progressCeiling 단조 증가)

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  previewBgm,
  preloadLogo,
  isRecordingSupported,
  isIOSDevice,
  type MirraScene,
  type VoiceConfig,
  type BgmType,
} from "@/lib/bgmSynth";
import { compressPhotos } from "@/lib/imageCompress";
import { invokeWithRetry } from "@/lib/fetchWithRetry";
import {
  isTableKnownMissing,
  markTableMissing,
  isTableMissingError,
} from "@/lib/tableFlags";
import { mirraToRemotionScene, type SmsScene } from "@/remotion/types";
import type { PhotoItem, ShortsVideo } from "@/stores/appStore";
import type { ShortsStep, VideoStyle } from "./types";
import { VOICES } from "./constants";

// ── 외부에서 주입하는 입력 묶음 ─────────────────────────────────
export interface ShortsPipelineInputs {
  photos: PhotoItem[];
  videoStyle: VideoStyle;
  bgm: BgmType;
  selectedVoice: string | null;
  scriptMode: "ai" | "manual";
  manualScript: string;
  workTopic: string;
  settings: {
    companyName: string;
    phoneNumber: string;
    serviceArea: string;
    logoUrl: string;
  };
  user: { id: string } | null;
  onUsed: () => void; // 사용량 증가 콜백 (useVideo)
  onSaved: (video: ShortsVideo) => void; // 보관함 저장
  toast: (args: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
}

// 나레이션/BGM 재생 대기 큐 (done step 진입 시 소비)
interface PendingAudio {
  narrationAudios: (string | null)[];
  narrationTexts: string[];
  voiceConfig: VoiceConfig | null;
  bgmType: BgmType;
}

export interface ShortsPipelineReturn {
  step: ShortsStep;
  setStep: React.Dispatch<React.SetStateAction<ShortsStep>>;
  progressText: string;
  progressPct: number;
  elapsedSec: number;
  videoUrl: string | null;
  remotionScenes: SmsScene[];
  errorMsg: string;
  generate: () => Promise<void>;
  reset: () => void;
}

export function useShortsPipeline(
  inputs: ShortsPipelineInputs,
): ShortsPipelineReturn {
  // 최신 inputs를 ref로 고정 — useCallback deps를 비워도 항상 현재 값 참조
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;

  const [step, setStep] = useState<ShortsStep>("config");
  const [remotionScenes, setRemotionScenes] = useState<SmsScene[]>([]);
  const [progressText, setProgressText] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const pendingAudioRef = useRef<PendingAudio | null>(null);
  const audioPlayedRef = useRef(false);
  const bgmCtxRef = useRef<AudioContext | null>(null);
  const narrationAudioRefs = useRef<HTMLAudioElement[]>([]);

  // ── done step 진입 시 나레이션 + BGM 재생 ─────────────────────
  // 서버 렌더 MP4에 이미 오디오가 박혀 있으므로 보통 이 effect는 무음.
  // pendingAudioRef.current 가 채워져 있을 때만 재생(향후 클라이언트 폴백 재도입 대비).
  useEffect(() => {
    if (step !== "done") return;
    const audio = pendingAudioRef.current;
    if (!audio || audioPlayedRef.current) return;
    audioPlayedRef.current = true;

    const { narrationAudios, bgmType } = audio;
    let cancelled = false;

    if (bgmType !== "none") {
      try {
        const bgmCtx = previewBgm(bgmType);
        bgmCtxRef.current = bgmCtx;
        const totalSec =
          remotionScenes.reduce((sum, s) => sum + s.durationInFrames, 0) / 30 + 5;
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

    (async () => {
      await new Promise((r) => setTimeout(r, 500));
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
              for (let j = 0; j < binary.length; j++)
                bytes[j] = binary.charCodeAt(j);
              const blob = new Blob([bytes], { type: "audio/mpeg" });
              const url = URL.createObjectURL(blob);
              const a = new Audio(url);
              narrationAudioRefs.current.push(a);
              const timeout = setTimeout(() => resolve(), 20000);
              a.onended = () => {
                clearTimeout(timeout);
                URL.revokeObjectURL(url);
                resolve();
              };
              a.onerror = () => {
                clearTimeout(timeout);
                URL.revokeObjectURL(url);
                resolve();
              };
              a.play().catch(() => {
                clearTimeout(timeout);
                resolve();
              });
            } catch {
              resolve();
            }
          });
          if (!cancelled) await new Promise((r) => setTimeout(r, 300));
        }
      }
      // ElevenLabs 오디오가 없으면 무음 재생 (Web Speech API 폴백 제거)
    })();

    return () => {
      cancelled = true;
      narrationAudioRefs.current.forEach((a) => {
        a.pause();
        a.src = "";
      });
      narrationAudioRefs.current = [];
      if (bgmCtxRef.current) {
        bgmCtxRef.current.close().catch(() => {});
        bgmCtxRef.current = null;
      }
    };
  }, [step, remotionScenes]);

  // ── 메인 파이프라인 ──────────────────────────────────────────
  const generate = useCallback(async () => {
    const i = inputsRef.current;
    const { photos, videoStyle, bgm, selectedVoice, scriptMode, manualScript, workTopic, settings, user, onUsed, onSaved, toast } = i;

    if (photos.length < 2) {
      toast({ title: "사진이 2장 이상 필요합니다", variant: "destructive" });
      return;
    }

    // AI 모드일 때 workTopic 필수
    if (scriptMode === "ai" && !workTopic.trim()) {
      toast({
        title: "오늘의 작업을 한 줄 입력해 주세요",
        description: "예) 욕실 방수 시공 / 외벽 균열 보수 / 옥상 방수",
        variant: "destructive",
      });
      return;
    }

    if (!isRecordingSupported()) {
      toast({
        title: "이 기기에서는 영상 생성을 지원하지 않습니다",
        description: "최신 Chrome 또는 Safari 브라우저를 사용해 주세요.",
        variant: "destructive",
      });
      return;
    }

    if (isIOSDevice()) {
      setStep("ios_guide");
      return;
    }

    // 이전 재생 리소스 정리
    if (bgmCtxRef.current) {
      bgmCtxRef.current.close().catch(() => {});
      bgmCtxRef.current = null;
    }
    narrationAudioRefs.current.forEach((a) => {
      a.pause();
      a.src = "";
    });
    narrationAudioRefs.current = [];
    pendingAudioRef.current = null;
    audioPlayedRef.current = false;
    setErrorMsg("");

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    // 업체 로고 프리로드 (엔딩 카드)
    preloadLogo(settings.logoUrl || "");

    setStep("generating");
    setProgressText("📝 사진 분석 중...");
    setProgressPct(10);
    setElapsedSec(0);

    // 경과 시간 카운터 — "10% 정체" 체감 제거
    const startedAt = Date.now();
    const elapsedTimer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    // 진행률 자동 증가 — 단계별 상한 올려가며 끊김 없이
    let progressCeiling = 24;
    const progressTimer = setInterval(() => {
      setProgressPct((prev) => {
        if (prev >= progressCeiling) return prev;
        const gap = progressCeiling - prev;
        const inc = gap > 20 ? 1.5 : gap > 10 ? 0.9 : 0.4;
        return Math.min(prev + inc, progressCeiling);
      });
    }, 700);

    const narrationEnabled = selectedVoice !== null;
    const voice = VOICES.find((v) => v.id === selectedVoice);

    try {
      const compressedPhotos = await compressPhotos(photos.slice(0, 6));
      const { data: scriptData, error: scriptErr } = await invokeWithRetry(
        supabase,
        "generate-shorts",
        {
          photos: compressedPhotos.map((dataUrl, i) => ({
            dataUrl,
            index: i + 1,
          })),
          workType: "자동판단",
          videoStyle,
          narrationType: narrationEnabled ? "있음" : "없음",
          voiceId: selectedVoice || "male_pro",
          scriptMode,
          manualScript: scriptMode === "manual" ? manualScript : undefined,
          maxDurationSec: 120,
          location: settings.serviceArea || "",
          buildingType: "",
          constructionDate: new Date().toISOString().slice(0, 10),
          companyName: settings.companyName,
          phoneNumber: settings.phoneNumber,
          workTopic: workTopic.trim(),
        },
      );

      if (scriptErr) {
        // 서버측 월 한도 초과(429)는 플랜 업그레이드 안내 메시지로 분기
        const ctx = (scriptErr as { context?: { status?: number; json?: () => Promise<unknown>; clone?: () => { json: () => Promise<unknown> } } }).context;
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
        const combined = `${scriptErr.message} ${bodyMsg}`;
        if (status === 429 || combined.includes("한도")) {
          throw new Error("이번 달 영상 개수를 모두 사용했습니다. 플랜을 업그레이드해 주세요.");
        }
        throw new Error(bodyMsg || scriptErr.message);
      }

      const scenes: MirraScene[] = scriptData?.scenes || [];
      if (scenes.length === 0) throw new Error("스크립트 생성 실패");

      const rScenes = scenes.map((s, idx) => mirraToRemotionScene(s, idx));
      setRemotionScenes(rScenes);
      console.warn(
        "[SMS] 영상 장면:",
        rScenes.map((s, idx) => `${idx}: ${s.title}`).join(" | "),
      );

      setProgressText("🎬 텍스트 애니메이션 합성 중...");
      progressCeiling = 29;
      setProgressPct((p) => Math.max(p, 25));

      const voiceConfig: VoiceConfig | undefined =
        narrationEnabled && voice
          ? {
              lang: voice.lang,
              pitch: voice.pitch,
              rate: voice.rate,
              voiceNameHint: voice.voiceNameHint,
            }
          : undefined;

      const narrationAudios: (string | null)[] =
        scriptData?.narrationAudios || [];
      const validAudioCount = narrationAudios.filter(Boolean).length;
      const failedScenes: number[] = Array.isArray(scriptData?.failedScenes)
        ? scriptData.failedScenes
        : [];
      console.warn(
        `[SMS] 나레이션: ${validAudioCount}/${narrationAudios.length}개 ElevenLabs 오디오, 실패 씬 [${failedScenes.join(",")}], BGM: ${bgm}`,
      );

      // ── 사전 게이트 ①: 나레이션 ON인데 유효 오디오 0개면 차단 ──
      if (narrationEnabled && validAudioCount === 0) {
        throw new Error(
          "나레이션 음성 생성이 전부 실패했습니다 (ElevenLabs 응답 없음). 잠시 후 다시 시도해 주세요.",
        );
      }
      if (narrationEnabled && failedScenes.length > 0) {
        toast({
          title: "일부 장면 음성 생성 실패",
          description: `${failedScenes.length}개 장면은 음성 없이 진행합니다.`,
        });
      }

      // ── Shotstack 렌더 (generate-shorts-status 폴링) ──
      setProgressText("🎬 영상 렌더링 중... (1~2분 소요)");
      progressCeiling = 92;
      setProgressPct((p) => Math.max(p, 30));

      const renderId: string | undefined = scriptData?.renderId;
      if (!renderId) {
        throw new Error("렌더 ID를 받지 못했습니다. 다시 시도해 주세요.");
      }
      console.warn(`[SMS] Shotstack renderId: ${renderId}`);

      type StatusJson = {
        status?: string; // queued | fetching | rendering | saving | done | failed | error
        progress?: number;
        stage?: string;
        videoUrl?: string;
        error?: string;
      };

      let renderData: { videoUrl?: string; error?: string } | null = null;
      let renderErrMsg: string | null = null;

      const applyStatus = (s: StatusJson): "done" | "error" | "continue" => {
        if (typeof s.progress === "number") {
          const serverMapped = 30 + Math.round((s.progress / 100) * 62);
          progressCeiling = Math.min(
            92,
            Math.max(progressCeiling, serverMapped),
          );
          setProgressPct((p) => Math.max(p, serverMapped));
        }
        if (s.stage) setProgressText(`🎬 ${s.stage}...`);
        if (s.status === "done" && s.videoUrl) {
          renderData = { videoUrl: s.videoUrl };
          return "done";
        }
        if (s.status === "failed" || s.status === "error") {
          renderErrMsg = s.error || "서버 렌더 실패";
          return "error";
        }
        return "continue";
      };

      // 3초 간격 폴링, 5분 타임아웃 (Shotstack은 보통 1분 내 완성)
      const pollDeadline = Date.now() + 5 * 60 * 1000;
      let consecutiveErrors = 0;
      while (Date.now() < pollDeadline) {
        await new Promise((r) => setTimeout(r, 3000));
        const { data: statusJson, error: statusErr } =
          await supabase.functions.invoke<StatusJson>(
            "generate-shorts-status",
            { body: { renderId } },
          );
        if (statusErr) {
          consecutiveErrors++;
          console.warn(
            `[SMS] 상태 조회 일시 오류 (${consecutiveErrors}):`,
            statusErr.message,
          );
          // 연속 5회 실패 시 중단
          if (consecutiveErrors >= 5) {
            renderErrMsg = "상태 조회 실패가 반복됩니다. 다시 시도해 주세요.";
            break;
          }
          continue;
        }
        consecutiveErrors = 0;
        if (!statusJson) continue;
        const r = applyStatus(statusJson);
        if (r !== "continue") break;
      }

      if (!renderData && !renderErrMsg) {
        renderErrMsg = "렌더 타임아웃 (5분 초과)";
      }

      const serverRenderOk =
        !renderErrMsg && !renderData?.error && !!renderData?.videoUrl;

      // ── 서버 렌더 실패 시 즉시 error (완성 오인 방지) ──
      if (!serverRenderOk) {
        throw new Error(
          renderErrMsg ||
            renderData?.error ||
            "서버 렌더링에 실패했습니다. 다시 시도해 주세요.",
        );
      }

      if (serverRenderOk && renderData?.videoUrl) {
        setVideoUrl(renderData.videoUrl);

        // 보관함 저장
        const savedVideo: ShortsVideo = {
          id: crypto.randomUUID(),
          title: workTopic.trim() || scenes[0]?.title || "무제 쇼츠",
          videoUrl: renderData.videoUrl,
          thumbnailDataUrl: compressedPhotos[0] || undefined,
          videoStyle,
          voiceId: selectedVoice || undefined,
          bgmType: bgm,
          scenesPreview: scenes
            .slice(0, 6)
            .map((s) => s.title || "")
            .filter(Boolean),
          photoCount: photos.length,
          createdAt: new Date().toISOString(),
        };
        onSaved(savedVideo);

        // shorts_videos 테이블 404 격리
        if (user && !isTableKnownMissing("shorts_videos")) {
          void supabase
            .from("shorts_videos")
            .insert({
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
            })
            .then(({ error }) => {
              if (!error) return;
              if (
                isTableMissingError(
                  error as { message?: string; code?: string },
                )
              ) {
                markTableMissing("shorts_videos");
                return;
              }
              console.warn("[shorts_videos] DB insert 실패:", error.message);
            });
        }
      }

      // 클라이언트 폴백 재생 제거된 상태 유지 (2026-04-20)
      audioPlayedRef.current = false;
      pendingAudioRef.current = {
        narrationAudios: [],
        narrationTexts: [],
        voiceConfig: voiceConfig ?? null,
        bgmType: "none",
      };

      setProgressPct(100);
      setStep("done");
      toast({ title: "영상이 완성되었습니다! 🎬" });
      onUsed();
    } catch (err: unknown) {
      console.error("Shorts generation error:", err);
      setStep("error");
      const msg = err instanceof Error ? err.message : "다시 시도해 주세요";
      if (msg === "UNSUPPORTED") {
        setErrorMsg(
          "이 기기에서는 영상 생성을 지원하지 않습니다. 최신 Chrome 브라우저를 사용해 주세요.",
        );
      } else {
        setErrorMsg(msg.slice(0, 200));
      }
    } finally {
      clearInterval(progressTimer);
      clearInterval(elapsedTimer);
    }
  }, [videoUrl]);

  // ── 리셋 ──
  const reset = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (bgmCtxRef.current) {
      bgmCtxRef.current.close().catch(() => {});
      bgmCtxRef.current = null;
    }
    narrationAudioRefs.current.forEach((a) => {
      a.pause();
      a.src = "";
    });
    narrationAudioRefs.current = [];
    pendingAudioRef.current = null;
    audioPlayedRef.current = false;
    setStep("config");
    setProgressPct(0);
    setElapsedSec(0);
    setVideoUrl(null);
    setErrorMsg("");
  }, [videoUrl]);

  return {
    step,
    setStep,
    progressText,
    progressPct,
    elapsedSec,
    videoUrl,
    remotionScenes,
    errorMsg,
    generate,
    reset,
  };
}

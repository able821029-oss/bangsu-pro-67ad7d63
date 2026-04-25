// useShortsPipeline — 쇼츠 생성 파이프라인 훅 (Shotstack 전환판)
// 2026-04-25 Railway 제거 — Shotstack 렌더 + generate-shorts-status 폴링.
//
// Edge Function 흐름:
//   1) generate-shorts        → Claude/Gemini 스크립트 + ElevenLabs MP3 + Storage 업로드
//                                + Shotstack POST → renderId 반환
//   2) generate-shorts-status → renderId 폴링 → { status, url } 반환
//
// 불변 규칙 (기능 회귀 방지):
//  1. 사진 < 2장 → 차단
//  2. AI 모드인데 workTopic 비어있으면 차단
//  3. 부분 실패 허용: failedScenes.length > 0 → 토스트만, 진행 계속
//  4. iOS 감지: setStep("ios_guide")
//  5. Shotstack status === "failed" 즉시 throw → error step
//  6. 5분 폴링 타임아웃 → throw
//  7. shorts_videos 404 격리 (markTableMissing 사용)
//  8. ElevenLabs 전체 실패는 Edge Function 측에서 500 으로 차단되므로 클라 사전 게이트 불필요

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  isRecordingSupported,
  isIOSDevice,
  type BgmType,
} from "@/lib/bgmSynth";
import { compressPhotos } from "@/lib/imageCompress";
import { invokeWithRetry } from "@/lib/fetchWithRetry";
import {
  isTableKnownMissing,
  markTableMissing,
  isTableMissingError,
} from "@/lib/tableFlags";
import type { SmsScene } from "@/remotion/types";
import type { PhotoItem, ShortsVideo } from "@/stores/appStore";
import type { ShortsStep, VideoStyle } from "./types";

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
  onUsed: () => void;
  onSaved: (video: ShortsVideo) => void;
  toast: (args: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
}

export interface ShortsPipelineReturn {
  step: ShortsStep;
  setStep: React.Dispatch<React.SetStateAction<ShortsStep>>;
  progressText: string;
  progressPct: number;
  elapsedSec: number;
  videoUrl: string | null;
  /**
   * 호환성 유지용 — Shotstack 전환 후 미리보기는 항상 `<video>` 태그가 처리하므로 빈 배열.
   * ShortsDoneStep 이 length > 0 분기에서 Remotion Player 를 띄우므로, 빈 배열 상태에서는
   * 자동으로 video 태그 폴백이 동작한다.
   */
  remotionScenes: SmsScene[];
  errorMsg: string;
  generate: () => Promise<void>;
  reset: () => void;
}

interface ShotstackStatusResponse {
  renderId?: string;
  status?:
    | "queued"
    | "fetching"
    | "rendering"
    | "saving"
    | "done"
    | "failed"
    | "unknown";
  url?: string | null;
  poster?: string | null;
  duration?: number | null;
  renderTime?: number | null;
  error?: string;
}

interface GenerateShortsResponse {
  renderId?: string;
  message?: string;
  sceneCount?: number;
  photoCount?: number;
  durationSec?: number;
  maxDurationSec?: number;
  trimmedByCap?: boolean;
  failedScenes?: number[];
  logoStatus?:
    | "embedded"
    | "skipped_empty"
    | "skipped_invalid_format"
    | "upload_failed";
  scenes?: Array<{ title?: string }>;
  error?: string;
}

const STAGE_LABEL: Record<string, string> = {
  queued: "큐 대기",
  fetching: "자산 가져오는 중",
  rendering: "영상 합성 중",
  saving: "파일 저장 중",
  done: "완료",
  failed: "실패",
  unknown: "처리 중",
};

const STAGE_PCT: Record<string, number> = {
  queued: 38,
  fetching: 50,
  rendering: 75,
  saving: 88,
  done: 92,
  failed: 92,
  unknown: 40,
};

export function useShortsPipeline(
  inputs: ShortsPipelineInputs,
): ShortsPipelineReturn {
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;

  const [step, setStep] = useState<ShortsStep>("config");
  const [progressText, setProgressText] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const generate = useCallback(async () => {
    const i = inputsRef.current;
    const {
      photos,
      videoStyle,
      bgm,
      selectedVoice,
      scriptMode,
      manualScript,
      workTopic,
      settings,
      user,
      onUsed,
      onSaved,
      toast,
    } = i;

    if (photos.length < 2) {
      toast({ title: "사진이 2장 이상 필요합니다", variant: "destructive" });
      return;
    }

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

    setErrorMsg("");
    if (videoUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);

    setStep("generating");
    setProgressText("📝 사진 분석 중...");
    setProgressPct(10);
    setElapsedSec(0);

    const startedAt = Date.now();
    const elapsedTimer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

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

    try {
      const compressedPhotos = await compressPhotos(photos.slice(0, 6));

      // ── 1) generate-shorts → Shotstack render id ──
      setProgressText("📝 스크립트·음성 생성 중...");
      progressCeiling = 35;

      const { data: scriptData, error: scriptErr } =
        await invokeWithRetry<GenerateShortsResponse>(
          supabase,
          "generate-shorts",
          {
            photos: compressedPhotos.map((dataUrl, idx) => ({
              dataUrl,
              index: idx + 1,
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
            logoUrl: settings.logoUrl || "",
            workTopic: workTopic.trim(),
          },
        );

      if (scriptErr) {
        const ctx = (
          scriptErr as {
            context?: {
              status?: number;
              clone?: () => { json: () => Promise<unknown> };
            };
          }
        ).context;
        const status =
          typeof ctx?.status === "number" ? ctx.status : undefined;
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
          throw new Error(
            "이번 달 영상 개수를 모두 사용했습니다. 플랜을 업그레이드해 주세요.",
          );
        }
        throw new Error(bodyMsg || scriptErr.message);
      }

      const renderId = scriptData?.renderId;
      const failedScenes: number[] = Array.isArray(scriptData?.failedScenes)
        ? scriptData.failedScenes
        : [];
      const sceneCount = scriptData?.sceneCount ?? 0;

      if (!renderId) {
        throw new Error(
          scriptData?.error ||
            "Shotstack render id 를 받지 못했습니다. 다시 시도해 주세요.",
        );
      }

      console.warn(
        `[SMS] Shotstack renderId: ${renderId} (씬 ${sceneCount}개, 음성실패 ${failedScenes.length}개, 길이 ${scriptData?.durationSec ?? "?"}초, 로고: ${scriptData?.logoStatus ?? "?"})`,
      );

      if (narrationEnabled && failedScenes.length > 0) {
        toast({
          title: "일부 장면 음성 생성 실패",
          description: `${failedScenes.length}개 장면은 음성 없이 진행합니다.`,
        });
      }

      // 영상 길이가 2분 cap 에 의해 사진이 잘렸을 때 사용자에게 안내
      if (scriptData?.trimmedByCap && scriptData?.photoCount) {
        toast({
          title: "사진 일부만 사용됩니다",
          description: `영상 ${Math.floor((scriptData.maxDurationSec || 120) / 60)}분 한도 때문에 ${scriptData.photoCount}장만 사용했어요.`,
        });
      }

      // 로고가 영상에 들어가지 못한 경우 사용자에게 원인 안내
      if (scriptData?.logoStatus && scriptData.logoStatus !== "embedded") {
        const reason = {
          skipped_empty: "마이페이지 → 프로필 설정에서 업체 로고를 등록해 주세요.",
          skipped_invalid_format: "로고 형식이 인식되지 않았습니다. 다시 업로드해 주세요.",
          upload_failed:
            "로고 업로드에 실패했어요. 잠시 후 다시 시도하거나 다른 이미지로 바꿔 주세요.",
        }[scriptData.logoStatus];
        if (reason) {
          toast({
            title: "엔딩 카드에 로고가 들어가지 않았어요",
            description: reason,
          });
        }
      }

      // ── 2) generate-shorts-status 폴링 (4초 간격, 5분 타임아웃) ──
      setProgressText("🎬 Shotstack 에서 영상 렌더링 중...");
      progressCeiling = 92;
      setProgressPct((p) => Math.max(p, 35));

      const POLL_INTERVAL_MS = 4000;
      const POLL_DEADLINE = Date.now() + 5 * 60 * 1000;

      let renderUrl: string | null = null;
      let renderErr: string | null = null;
      let consecutiveErrors = 0;

      while (Date.now() < POLL_DEADLINE) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

        const { data: statusData, error: statusErr } =
          await supabase.functions.invoke<ShotstackStatusResponse>(
            "generate-shorts-status",
            { body: { renderId } },
          );

        if (statusErr) {
          consecutiveErrors++;
          console.warn(
            `[SMS] 상태 조회 일시 오류 (${consecutiveErrors}):`,
            statusErr.message,
          );
          if (consecutiveErrors >= 5) {
            renderErr = "상태 조회 실패가 반복됩니다. 다시 시도해 주세요.";
            break;
          }
          continue;
        }
        consecutiveErrors = 0;

        const status = (statusData?.status || "unknown") as string;
        const stage = STAGE_LABEL[status] || status;
        setProgressText(`🎬 ${stage}... (Shotstack)`);

        const pseudoPct = STAGE_PCT[status] ?? progressCeiling;
        progressCeiling = Math.max(progressCeiling, pseudoPct);
        setProgressPct((p) => Math.max(p, pseudoPct));

        if (status === "done" && statusData?.url) {
          renderUrl = statusData.url;
          break;
        }
        if (status === "failed") {
          renderErr = statusData?.error || "Shotstack 렌더링 실패";
          break;
        }
      }

      if (renderErr) throw new Error(renderErr);
      if (!renderUrl) {
        throw new Error("Shotstack 렌더링 타임아웃 (5분 초과)");
      }

      setVideoUrl(renderUrl);

      // ── 3) 보관함 저장 ──
      const sceneTitles = Array.isArray(scriptData?.scenes)
        ? scriptData.scenes
            .slice(0, 6)
            .map((s) => s?.title || "")
            .filter(Boolean)
        : [];

      const savedVideo: ShortsVideo = {
        id: crypto.randomUUID(),
        title: workTopic.trim() || sceneTitles[0] || "무제 쇼츠",
        videoUrl: renderUrl,
        thumbnailDataUrl: compressedPhotos[0] || undefined,
        videoStyle,
        voiceId: selectedVoice || undefined,
        bgmType: bgm,
        scenesPreview: sceneTitles,
        photoCount: photos.length,
        createdAt: new Date().toISOString(),
      };
      onSaved(savedVideo);

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

  const reset = useCallback(() => {
    if (videoUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(videoUrl);
    }
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
    remotionScenes: [],
    errorMsg,
    generate,
    reset,
  };
}

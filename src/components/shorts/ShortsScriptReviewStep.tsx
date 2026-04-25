// 자막 검수 단계 — 2026-04-25
//
// 워크플로우 위치:
//   ShortsConfigStep → [자막 만들기]
//      ↓
//   generateScript() (5~10초)
//      ↓
//   ShortsScriptReviewStep ← 여기
//      ↓ [영상 만들기]
//   generateVideo() (1~2분, ElevenLabs + Shotstack)
//
// 기능:
//   - 씬별 자막 (영상 화면에 표시될 텍스트) + 나레이션 (음성으로 읽을 텍스트) 인라인 편집
//   - 사진 썸네일을 함께 보여 어느 사진의 자막인지 즉시 식별
//   - [자막 다시 만들기] — generate-shorts-script 재호출 (사용자 편집 사라짐, 확인 후)
//   - [뒤로] — config 로 복귀 (편집 내용 저장됨)
//   - [영상 만들기] — generateVideo 실행

import { ArrowLeft, RefreshCw, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PhotoItem } from "@/stores/appStore";
import type { SceneScript } from "./types";

export interface ShortsScriptReviewStepProps {
  scenes: SceneScript[];
  photos: PhotoItem[];
  onChange: (next: SceneScript[]) => void;
  onBack: () => void;
  onRegenerate: () => void;
  onConfirm: () => void;
  isRegenerating?: boolean;
}

export function ShortsScriptReviewStep({
  scenes,
  photos,
  onChange,
  onBack,
  onRegenerate,
  onConfirm,
  isRegenerating = false,
}: ShortsScriptReviewStepProps) {
  const updateScene = (idx: number, patch: Partial<SceneScript>) => {
    const next = scenes.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(next);
  };

  const handleConfirm = () => {
    const totalChars = scenes.reduce(
      (sum, s) => sum + (s.title?.trim().length ?? 0),
      0,
    );
    if (totalChars === 0) {
      alert("자막을 한 개 이상 입력해 주세요.");
      return;
    }
    onConfirm();
  };

  return (
    <div className="px-4 pt-4 pb-32 max-w-lg mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="뒤로"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-bold flex-1">자막 검수 · 수정</h2>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={onRegenerate}
          disabled={isRegenerating}
        >
          {isRegenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          다시 만들기
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
        영상에 들어갈 자막과 음성 나레이션입니다. 자유롭게 수정한 뒤
        <strong className="text-foreground"> 영상 만들기</strong>를 눌러 주세요.
        한 번 영상이 만들어지면 이 자막은 수정할 수 없습니다.
      </p>

      {/* 씬 카드 */}
      <div className="space-y-3">
        {scenes.map((scene, idx) => {
          const photoIdx = Math.max(
            0,
            Math.min(photos.length - 1, (scene.photo_index || idx + 1) - 1),
          );
          const photo = photos[photoIdx];
          return (
            <div
              key={idx}
              className="rounded-xl border border-border bg-card p-3 space-y-2"
            >
              <div className="flex items-center gap-3">
                {photo ? (
                  <img
                    src={photo.dataUrl}
                    alt={`씬 ${idx + 1}`}
                    className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">
                    씬 {idx + 1}
                  </div>
                  <div className="text-xs text-muted-foreground/70">
                    사진 {scene.photo_index || idx + 1}번
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                  자막 (영상에 표시)
                </label>
                <Textarea
                  value={scene.title || ""}
                  onChange={(e) =>
                    updateScene(idx, { title: e.target.value.slice(0, 50) })
                  }
                  placeholder="짧고 임팩트 있게 (20자 권장)"
                  rows={2}
                  className="text-sm resize-none"
                />
                <div className="text-[10px] text-right text-muted-foreground/60 mt-0.5">
                  {(scene.title || "").length}/50
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                  나레이션 (음성으로 읽음)
                </label>
                <Textarea
                  value={scene.narration || ""}
                  onChange={(e) =>
                    updateScene(idx, {
                      narration: e.target.value.slice(0, 80),
                    })
                  }
                  placeholder="음성 없이 진행하려면 비워두세요"
                  rows={2}
                  className="text-sm resize-none"
                />
                <div className="text-[10px] text-right text-muted-foreground/60 mt-0.5">
                  {(scene.narration || "").length}/80
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 영상 만들기 버튼 (sticky 하단) */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-10">
        <Button
          className="w-full gap-2 h-12 text-base font-semibold"
          style={{
            background: "linear-gradient(135deg,#237FFF,#AB5EBE)",
            color: "white",
          }}
          onClick={handleConfirm}
        >
          <Wand2 className="w-5 h-5" /> 이 자막으로 영상 만들기
        </Button>
      </div>
    </div>
  );
}

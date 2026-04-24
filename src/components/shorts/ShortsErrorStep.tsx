// 쇼츠 에러 화면 — 파이프라인 실패 시 표시
// 2026-04-24 Phase 4 — ShortsCreator.tsx의 error step 분리
// 2026-04-25 한도 초과 시 '플랜 업그레이드' 버튼 노출 (업그레이드 경로 보장)

import { RotateCcw, X, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ShortsErrorStepProps {
  errorMsg: string;
  onRetry: () => void;
  onClose: () => void;
  onUpgrade?: () => void; // 설정/요금제 페이지로 이동
}

/**
 * 에러 메시지에 한도/플랜 관련 키워드가 포함돼 있으면 업그레이드가 주요 해결책.
 * 서버(usageGuard)에서 보내는 "이번 달 ... 한도를 모두 사용했습니다" / "플랜을 업그레이드"
 * 문구를 감지.
 */
function isQuotaError(msg: string): boolean {
  if (!msg) return false;
  return /한도|플랜|업그레이드|사용했습니다|429|Too Many/i.test(msg);
}

export function ShortsErrorStep({ errorMsg, onRetry, onClose, onUpgrade }: ShortsErrorStepProps) {
  const quota = isQuotaError(errorMsg);

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div
        className={`w-20 h-20 rounded-full flex items-center justify-center ${
          quota ? "bg-primary/10" : "bg-destructive/10"
        }`}
      >
        {quota ? (
          <Crown className="w-10 h-10 text-primary" />
        ) : (
          <X className="w-10 h-10 text-destructive" />
        )}
      </div>
      <div>
        <h2 className="text-xl font-bold">
          {quota ? "이번 달 영상 한도를 모두 사용했어요" : "영상 생성 실패"}
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          {quota
            ? "플랜을 업그레이드하면 더 많은 영상을 생성할 수 있어요."
            : errorMsg || "다시 시도해 주세요"}
        </p>
      </div>

      <div className="space-y-2 w-full max-w-xs">
        {quota && onUpgrade && (
          <Button
            className="w-full"
            style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)", color: "white" }}
            onClick={onUpgrade}
          >
            <Crown className="w-4 h-4" /> 플랜 업그레이드
          </Button>
        )}
        <Button
          className="w-full"
          variant={quota ? "secondary" : "default"}
          onClick={onRetry}
        >
          <RotateCcw className="w-4 h-4" /> 다시 시도
        </Button>
        <Button variant="ghost" className="w-full" onClick={onClose}>
          돌아가기
        </Button>
      </div>
    </div>
  );
}

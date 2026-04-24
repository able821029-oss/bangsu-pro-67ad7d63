// 쇼츠 에러 화면 — 파이프라인 실패 시 표시
// 2026-04-24 Phase 4 — ShortsCreator.tsx의 error step 분리

import { RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ShortsErrorStepProps {
  errorMsg: string;
  onRetry: () => void;
  onClose: () => void;
}

export function ShortsErrorStep({ errorMsg, onRetry, onClose }: ShortsErrorStepProps) {
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
        <Button className="w-full" onClick={onRetry}><RotateCcw className="w-4 h-4" /> 다시 시도</Button>
        <Button variant="ghost" className="w-full" onClick={onClose}>돌아가기</Button>
      </div>
    </div>
  );
}

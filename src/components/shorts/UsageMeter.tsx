// 이번 달 영상 사용량 표시 컴포넌트
// 2026-04-24 추출 — ShortsCreator.tsx에서 분리

import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UsageMeterProps {
  used: number;
  max: number;
  plan: string;
  onUpgrade: () => void;
}

export function UsageMeter({ used, max, plan, onUpgrade }: UsageMeterProps) {
  const ratio = max > 0 ? used / max : 1;
  const barColor = ratio >= 1 ? "#EF4444" : ratio >= 0.8 ? "#F97316" : "#237FFF";
  const pct = Math.min(ratio * 100, 100);

  return (
    <div className="bg-card rounded-[--radius] border border-border p-4 space-y-2">
      <div className="flex justify-between items-baseline">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Film className="w-4 h-4 text-primary" /> 이번 달 영상
        </p>
        <p className="text-sm font-bold" style={{ color: barColor }}>
          {used} / {max}개
        </p>
      </div>
      <div className="w-full bg-secondary rounded-full h-2.5">
        <div
          className="rounded-full h-2.5 transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
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
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-primary text-primary"
              onClick={onUpgrade}
            >
              플랜 업그레이드
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

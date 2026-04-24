// 쇼츠 생성 진행 화면 — 진행률 · 체크리스트 · 경과시간
// 2026-04-24 Phase 4 — ShortsCreator.tsx의 generating step 분리

import { Film, CheckCircle2, Loader2 } from "lucide-react";

export interface ShortsGeneratingStepProps {
  progressText: string;
  progressPct: number;
  elapsedSec: number;
}

export function ShortsGeneratingStep({ progressText, progressPct, elapsedSec }: ShortsGeneratingStepProps) {
  const stages = [
    { label: "사진 분석 및 스크립트 생성", done: progressPct >= 25 },
    { label: "나레이션 음성 합성", done: progressPct >= 30 },
    { label: "장면 렌더링", done: progressPct >= 95 },
    { label: "영상 완성", done: progressPct >= 100 },
  ];
  const nextIdx = stages.findIndex(st => !st.done);

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
          <span>진행률 · 경과 {elapsedSec}초</span>
          <span className="font-semibold text-primary">{Math.round(progressPct)}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
          <div
            className="bg-primary rounded-full h-3 transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
      <div className="w-full max-w-xs space-y-2">
        {stages.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            {s.done
              ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              : i === nextIdx
                ? <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                : <div className="w-5 h-5 rounded-full border-2 border-border shrink-0" />}
            <p className={`text-sm ${s.done ? "text-green-500" : i === nextIdx ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">사진이 많을수록 영상이 길어집니다 (15~60초 소요)</p>
    </div>
  );
}

// iOS 화면 녹화 안내 — 아이폰은 브라우저에서 영상 저장 제한 → 사용자가 화면 녹화로 저장
// 2026-04-24 Phase 4 — ShortsCreator.tsx의 ios_guide step 분리

import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ShortsIosGuideStepProps {
  onStartPlayback: () => void;
  onClose: () => void;
}

export function ShortsIosGuideStep({ onStartPlayback, onClose }: ShortsIosGuideStepProps) {
  const steps = [
    "아이폰 설정 → 제어 센터 → 화면 기록 추가",
    "SMS 앱으로 돌아와 아래 '영상 재생 시작' 버튼 클릭",
    "화면 상단 오른쪽 아래로 스와이프 → 제어 센터 열기",
    "화면 기록 버튼(⏺) 3초 누르기 → 녹화 시작",
    "SMS로 돌아와 영상 재생 — 완료 후 녹화 중지",
  ];

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center">
      <div className="text-5xl">📱</div>
      <h2 className="text-xl font-bold">아이폰 화면 녹화 안내</h2>
      <p className="text-sm text-muted-foreground">
        아이폰(iOS)은 브라우저에서 영상 저장이 제한됩니다.<br/>
        아래 순서로 화면 녹화로 저장하세요.
      </p>
      <div className="w-full bg-card border border-border rounded-2xl p-4 space-y-3 text-left">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
            <p className="text-sm">{step}</p>
          </div>
        ))}
      </div>
      <Button
        className="w-full"
        style={{ background: "linear-gradient(135deg, #237FFF, #AB5EBE)", color: "white" }}
        onClick={onStartPlayback}
      >
        <Film className="w-5 h-5" /> 영상 재생 시작
      </Button>
      <Button variant="ghost" className="w-full" onClick={onClose}>취소</Button>
    </div>
  );
}

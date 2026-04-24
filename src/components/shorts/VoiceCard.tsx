// 나레이션 음성 선택 카드 (선택 + 미리듣기 버튼 포함)
// 2026-04-24 추출 — ShortsCreator.tsx에서 분리
// HTML 표준상 <button> 안에 <button>은 불가 — 바깥은 role=button div로 접근성 유지.

import { Check, Play, Square } from "lucide-react";
import type { VoiceOption } from "./types";

export interface VoiceCardProps {
  voice: VoiceOption;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  isPlaying: boolean;
}

export function VoiceCard({ voice, selected, onSelect, onPreview, isPlaying }: VoiceCardProps) {
  const genderIcon = voice.gender === "male" ? "M" : "F";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className="relative w-full text-left p-3 rounded-xl transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{
        border: selected ? "2px solid hsl(215 100% 50%)" : "1px solid hsl(var(--border))",
        backgroundColor: selected ? "hsl(var(--muted))" : "hsl(var(--card))",
      }}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center bg-primary">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      <p className="text-sm font-semibold text-foreground">
        {genderIcon} {voice.label}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{voice.desc}</p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        className="mt-2 flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors"
        style={{
          backgroundColor: isPlaying ? "hsl(215 100% 50%)" : "hsl(var(--secondary))",
          color: isPlaying ? "white" : "hsl(var(--muted-foreground))",
        }}
      >
        {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        {isPlaying ? "정지" : "미리 듣기"}
      </button>
    </div>
  );
}

// ShortsCreator 관련 공용 타입
// 2026-04-24 추출 — ShortsCreator.tsx에서 중복 제거용

export type VideoStyle = "시공일지형" | "홍보형" | "Before/After형";

export type ShortsStep = "config" | "generating" | "done" | "error" | "ios_guide";

export interface VoiceOption {
  id: string;
  label: string;
  desc: string;
  gender: "male" | "female";
  lang: string;
  pitch: number;
  rate: number;
  voiceNameHint: string[];
}

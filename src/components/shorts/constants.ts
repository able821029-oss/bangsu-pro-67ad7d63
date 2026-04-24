// ShortsCreator 관련 공용 상수·순수 유틸
// 2026-04-24 추출 — ShortsCreator.tsx에서 중복 제거용

import type { BgmType } from "@/lib/bgmSynth";
import type { VideoStyle, VoiceOption } from "./types";

// ── 미리듣기 예시 문구 ─────────────────────────────────────────
export const PREVIEW_TEXT = "안녕하세요. 오늘도 정성껏 작업합니다.";

// ── 영상 월 한도 (UsageMeter 표기용, 실제 한도는 subscription.maxVideo에서) ──
export const PLAN_LIMITS: Record<string, number> = {
  "무료": 1,
  "베이직": 5,
  "프로": 20,
  "비즈니스": 50,
  "무제한": 999,
};

// ── ElevenLabs 지원 6종 음성 ───────────────────────────────────
// voiceNameHint는 Web Speech API 폴백에서 브라우저 내장 음성 선택 시 사용.
export const VOICES: VoiceOption[] = [
  { id: "male_calm",       label: "남성 — 차분한",   desc: "낮고 안정적",       gender: "male",   lang: "ko-KR", pitch: 0.5,  rate: 0.6,  voiceNameHint: ["Google 한국의", "Korean Male"] },
  { id: "male_pro",        label: "남성 — 전문적",   desc: "신뢰감 있는",       gender: "male",   lang: "ko-KR", pitch: 0.7,  rate: 0.7,  voiceNameHint: ["Google 한국의", "Korean Male"] },
  { id: "male_strong",     label: "남성 — 힘있는",   desc: "에너지 넘치는",     gender: "male",   lang: "ko-KR", pitch: 0.9,  rate: 0.85, voiceNameHint: ["Google 한국의", "Korean Male"] },
  { id: "female_friendly", label: "여성 — 친근한",   desc: "따뜻하고 밝은",     gender: "female", lang: "ko-KR", pitch: 1.4,  rate: 0.7,  voiceNameHint: ["Google 한국의", "Yuna", "Korean Female"] },
  { id: "female_pro",      label: "여성 — 전문적",   desc: "자신감 있는",       gender: "female", lang: "ko-KR", pitch: 1.15, rate: 0.75, voiceNameHint: ["Google 한국의", "Yuna", "Korean Female"] },
  { id: "female_bright",   label: "여성 — 밝은",     desc: "젊고 활기찬",       gender: "female", lang: "ko-KR", pitch: 1.7,  rate: 0.9,  voiceNameHint: ["Google 한국의", "Yuna", "Korean Female"] },
];

// ── 영상 스타일 3종 (라벨과 id가 다름에 주의: "시공일지형" → "작업일지형"으로 표기) ──
export const VIDEO_STYLES: { id: VideoStyle; label: string; desc: string; icon: string }[] = [
  { id: "시공일지형",   label: "작업일지형",   desc: "준비 → 작업 → 완성 순서", icon: "clipboard" },
  { id: "홍보형",        label: "홍보형",        desc: "완성컷 강조 + 업체 정보", icon: "megaphone" },
  { id: "Before/After형", label: "Before/After형", desc: "전후 비교 중심",          icon: "refresh" },
];

// ── BGM 6종 (none 포함) ────────────────────────────────────────
export const BGM_OPTIONS: { id: BgmType; label: string; emoji: string; desc: string }[] = [
  { id: "upbeat",    label: "에너지",      emoji: "⚡", desc: "강한 비트 · 다이나믹" },
  { id: "hiphop",    label: "트렌디",      emoji: "🔥", desc: "틱톡 트랩 · MZ 스타일" },
  { id: "corporate", label: "프로페셔널", emoji: "💼", desc: "신뢰감 · 전문 느낌" },
  { id: "emotional", label: "감동",        emoji: "✨", desc: "성취감 · 완성 무드" },
  { id: "calm",      label: "잔잔함",      emoji: "🌿", desc: "깨끗하고 차분한 톤" },
  { id: "none",      label: "없음",        emoji: "🔇", desc: "무음" },
];

// ── KakaoTalk/라인/페이스북/네이버 등 카카오·SNS 인앱 브라우저 감지 ──
// 일부 인앱은 MediaRecorder/AudioContext가 제한되므로 경고 배너에 사용.
export function isInAppBrowser(): { isInApp: boolean; name: string } {
  if (typeof navigator === "undefined") return { isInApp: false, name: "" };
  const ua = navigator.userAgent || "";
  if (/KAKAOTALK/i.test(ua)) return { isInApp: true, name: "카카오톡" };
  if (/\bLine\//i.test(ua)) return { isInApp: true, name: "라인" };
  if (/FBAN|FBAV|Instagram/i.test(ua)) return { isInApp: true, name: "페이스북/인스타" };
  if (/NAVER\(inapp/i.test(ua)) return { isInApp: true, name: "네이버" };
  return { isInApp: false, name: "" };
}

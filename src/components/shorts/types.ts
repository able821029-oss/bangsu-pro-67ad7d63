// ShortsCreator 관련 공용 타입
// 2026-04-24 추출 — ShortsCreator.tsx에서 중복 제거용

export type VideoStyle = "시공일지형" | "홍보형" | "Before/After형";

export type ShortsStep =
  | "config"           // 설정 (사진·음성·BGM·작업 주제)
  | "script_loading"   // Claude/Gemini 가 자막 생성 중
  | "script_review"    // 자막 검수·수정 화면
  | "generating"       // ElevenLabs 음성 + Shotstack 렌더 중
  | "done"             // 영상 완성
  | "error"
  | "ios_guide";

export interface SceneScript {
  /** 화면 자막용 짧은 한국어 (20자 내) */
  title: string;
  /** 보조 텍스트 (선택) */
  subtitle?: string;
  /** ElevenLabs 가 읽을 한국어 나레이션 (20자 내 권장) */
  narration: string;
  /** 1-based 사진 번호 (해당 씬에서 배경으로 쓸 사진) */
  photo_index: number;
}

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

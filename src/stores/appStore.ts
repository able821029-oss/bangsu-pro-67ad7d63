import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { createAuthSlice, type AuthSlice } from "./slices/authSlice";
import { createPhotoSlice, type PhotoSlice } from "./slices/photoSlice";
import { createDraftSlice, type DraftSlice } from "./slices/draftSlice";
import { createPostsSlice, type PostsSlice } from "./slices/postsSlice";
import { createShortsSlice, type ShortsSlice } from "./slices/shortsSlice";
import { createSettingsSlice, type SettingsSlice } from "./slices/settingsSlice";
import {
  createSubscriptionSlice,
  type SubscriptionSlice,
} from "./slices/subscriptionSlice";
import { createReferralSlice, type ReferralSlice } from "./slices/referralSlice";

// ════════════════════════════════════════════════════════════════
// 도메인 타입 — 슬라이스 분리 후에도 단일 진입점 유지
// (외부 호출부가 `@/stores/appStore`에서 import 중인 타입 전부)
// ════════════════════════════════════════════════════════════════

export type WorkType =
  | "옥상방수"
  | "외벽방수"
  | "지하방수"
  | "균열보수"
  | "욕실방수"
  | "기타";
export type PostStyle = "시공일지형" | "업체홍보형" | "상담유도형" | "후기강조형";
export type PostStatus = "작성중" | "AI생성중" | "완료" | "게시완료";
export type Platform = "naver" | "instagram" | "tiktok";
export type Persona = "장인형" | "친근형" | "전문기업형";
export type PlanType = "무료" | "베이직" | "프로" | "무제한";

export interface PhotoItem {
  id: string;
  /** Supabase Storage 공개 URL — 저장 후 우선 사용 */
  url?: string;
  /** 로컬 원본(dataURL). 업로드 전·실패 시 fallback 용도로만 유지 */
  dataUrl?: string;
  caption?: string;
}

/** <img src> 용. Storage URL이 있으면 그걸 쓰고, 없으면 로컬 dataUrl로 폴백. */
export function photoSrc(
  p: { url?: string; dataUrl?: string } | null | undefined,
): string {
  if (!p) return "";
  return p.url || p.dataUrl || "";
}

export interface SiteInfo {
  area: string;   // 시공면적
  method: string; // 공법
  etc: string;    // 기타
}

export interface BlogPost {
  id: string;
  title: string;
  photos: PhotoItem[];
  workType: WorkType;
  style: PostStyle;
  blocks: ContentBlock[];
  hashtags: string[];
  status: PostStatus;
  createdAt: string;
  platforms: Platform[];
  persona: Persona;
  location?: string;
  siteInfo?: SiteInfo;
}

export interface ContentBlock {
  type: "text" | "photo" | "subtitle";
  content: string;
  caption?: string;
}

// ── 새 글쓰기 위저드 — 최대 4개 동시 작성 ──
export interface DraftSection {
  id: string;
  subtitle: string;
  photo: PhotoItem | null;
  text: string;
}

/** 작성 모드 — 전문가형(현장정보+섹션) / 브이로그형(섹션만, 자유 형식) */
export type BlogMode = "expert" | "vlog";

export interface BlogDraft {
  id: string;
  /** undefined = 미선택(=TypePicker 노출). 한 번 고른 뒤에는 유지 */
  mode?: BlogMode;
  title: string;
  location: string;        // 시/도 (예: 서울)
  locationSigu: string;    // 시·군·구 (예: 강남구)
  locationDong: string;    // 동/읍/면 (예: 역삼동)
  siteArea: string;        // 시공면적
  siteMethod: string;      // 공법
  siteSpecial: string;     // 특가 항목 (전문가형 전용 — 가격·할인·프로모션)
  siteEtc: string;         // 기타
  sections: DraftSection[];
  createdAt: string;
}

export const MAX_DRAFTS = 4;

export function createEmptySection(): DraftSection {
  return { id: crypto.randomUUID(), subtitle: "", photo: null, text: "" };
}

export function createEmptyDraft(mode?: BlogMode): BlogDraft {
  return {
    id: crypto.randomUUID(),
    mode,
    title: "",
    location: "",
    locationSigu: "",
    locationDong: "",
    siteArea: "",
    siteMethod: "",
    siteSpecial: "",
    siteEtc: "",
    sections: [createEmptySection()],
    createdAt: new Date().toISOString(),
  };
}

export interface ShortsVideo {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailDataUrl?: string;  // 첫 사진 기반 썸네일 (작게 압축된 data URL)
  videoStyle?: string;         // "작업일지형" | "홍보형" | "before_after"
  voiceId?: string;
  bgmType?: string;
  durationSec?: number;
  scenesPreview?: string[];    // 장면 제목 6개 요약
  photoCount: number;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount: string;
  expiresAt: string;
  used: boolean;
}

export interface Inquiry {
  id: string;
  type: string;
  title: string;
  content: string;
  status: "접수완료" | "처리중" | "답변완료";
  createdAt: string;
}

export interface Settings {
  companyName: string;
  phoneNumber: string;
  serviceArea: string;
  logoUrl: string;
  facePhotoUrl: string;
  companyDescription: string;
  autoInsertCompany: boolean;
  autoInsertSeo: boolean;
  naverConnected: boolean;
  instagramConnected: boolean;
  tiktokConnected: boolean;
}

export interface Subscription {
  plan: PlanType;
  usedCount: number;      // 이번달 블로그 사용 수
  maxCount: number;       // 블로그 월 한도
  videoUsed: number;      // 이번달 영상 사용 수
  maxVideo: number;       // 영상 월 한도
  expiresAt: string;
  consecutiveMonths: number;
}

// ════════════════════════════════════════════════════════════════
// 통합 상태 = 8개 슬라이스 인터섹션
// ════════════════════════════════════════════════════════════════
export type AppState = AuthSlice &
  PhotoSlice &
  DraftSlice &
  PostsSlice &
  ShortsSlice &
  SettingsSlice &
  SubscriptionSlice &
  ReferralSlice;

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
      ...createPhotoSlice(...a),
      ...createDraftSlice(...a),
      ...createPostsSlice(...a),
      ...createShortsSlice(...a),
      ...createSettingsSlice(...a),
      ...createSubscriptionSlice(...a),
      ...createReferralSlice(...a),
    }),
    {
      name: "sms-app-store", // localStorage 키
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // 영속화할 필드만 선택 — 일회성 UI 상태는 제외
      // posts[].photos 중 url이 있는 항목은 dataUrl을 제거해 localStorage 부담을 줄인다.
      // 아직 업로드 전이라 dataUrl만 있는 경우는 그대로 유지 (오프라인 보존).
      partialize: (state) => ({
        settings: state.settings,
        posts: state.posts.map((p) => ({
          ...p,
          photos: p.photos.map((ph) =>
            ph.url ? { id: ph.id, url: ph.url, caption: ph.caption } : ph,
          ),
        })),
        subscription: state.subscription,
        coupons: state.coupons,
        inquiries: state.inquiries,
        referralCode: state.referralCode,
        referralCount: state.referralCount,
        selectedPersona: state.selectedPersona,
        selectedStyle: state.selectedStyle,
        selectedPlatforms: state.selectedPlatforms,
        drafts: state.drafts,
        activeDraftIdx: state.activeDraftIdx,
      }),
    },
  ),
);

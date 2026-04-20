import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { trackEvent } from "@/lib/analytics";

export type WorkType = "옥상방수" | "외벽방수" | "지하방수" | "균열보수" | "욕실방수" | "기타";
export type PostStyle = "시공일지형" | "업체홍보형" | "상담유도형" | "후기강조형";
export type PostStatus = "작성중" | "AI생성중" | "완료" | "게시완료";
export type Platform = "naver" | "instagram" | "tiktok";
export type Persona = "장인형" | "친근형" | "전문기업형";
export type PlanType = "무료" | "베이직" | "프로" | "무제한";

export interface PhotoItem {
  id: string;
  dataUrl: string;
  caption?: string;
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

export interface BlogDraft {
  id: string;
  title: string;
  location: string;        // 시/도 (예: 서울)
  locationSigu: string;    // 시·군·구 (예: 강남구)
  locationDong: string;    // 동/읍/면 (예: 역삼동)
  siteArea: string;        // 시공면적
  siteMethod: string;      // 공법
  siteEtc: string;         // 기타
  sections: DraftSection[];
  createdAt: string;
}

export const MAX_DRAFTS = 4;

export function createEmptySection(): DraftSection {
  return { id: crypto.randomUUID(), subtitle: "", photo: null, text: "" };
}

export function createEmptyDraft(): BlogDraft {
  return {
    id: crypto.randomUUID(),
    title: "",
    location: "",
    locationSigu: "",
    locationDong: "",
    siteArea: "",
    siteMethod: "",
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

interface Settings {
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

interface Subscription {
  plan: PlanType;
  usedCount: number;      // 이번달 블로그 사용 수
  maxCount: number;       // 블로그 월 한도
  videoUsed: number;      // 이번달 영상 사용 수
  maxVideo: number;       // 영상 월 한도
  expiresAt: string;
  consecutiveMonths: number;
}

interface AppState {
  photos: PhotoItem[];
  selectedWorkType: WorkType | null;
  selectedStyle: PostStyle;
  selectedPlatforms: Platform[];
  selectedPersona: Persona;
  currentPost: BlogPost | null;
  posts: BlogPost[];
  shortsVideos: ShortsVideo[];
  settings: Settings;
  subscription: Subscription;
  coupons: Coupon[];
  inquiries: Inquiry[];
  referralCode: string;
  referralCount: number;
  useVideo: () => boolean;  // 영상 1개 사용

  // 글쓰기 위저드 (최대 4개 동시 작성)
  drafts: BlogDraft[];
  activeDraftIdx: number;

  addPhoto: (photo: PhotoItem) => void;
  removePhoto: (id: string) => void;
  setWorkType: (type: WorkType) => void;
  setSelectedStyle: (style: PostStyle) => void;
  togglePlatform: (platform: Platform) => void;
  setSelectedPersona: (persona: Persona) => void;
  setCurrentPost: (post: BlogPost | null) => void;
  addPost: (post: BlogPost) => void;
  updatePostStatus: (id: string, status: PostStatus) => void;
  updatePost: (id: string, updates: Partial<BlogPost>) => void;
  addShortsVideo: (video: ShortsVideo) => void;
  removeShortsVideo: (id: string) => void;
  setShortsVideos: (videos: ShortsVideo[]) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  addCoupon: (coupon: Coupon) => void;
  addInquiry: (inquiry: Inquiry) => void;
  updateSubscription: (sub: Partial<Subscription>) => void;
  upgradePlan: (planName: string) => void;
  clearSession: () => void;

  // Draft 액션
  addDraft: () => void;
  removeDraft: (idx: number) => void;
  setActiveDraft: (idx: number) => void;
  updateDraft: (idx: number, patch: Partial<BlogDraft>) => void;
  addSection: (draftIdx: number) => void;
  /**
   * 여러 장의 사진을 한 번에 섹션에 추가 (갤러리 다중 선택용).
   * - 빈 사진 섹션이 있으면 먼저 채움
   * - 남은 사진은 새 섹션으로 추가
   * - 반환값은 추가/채운 실제 건수
   */
  addPhotosAsSections: (
    draftIdx: number,
    photos: { id: string; dataUrl: string }[],
  ) => number;
  updateSection: (draftIdx: number, sectionId: string, patch: Partial<DraftSection>) => void;
  removeSection: (draftIdx: number, sectionId: string) => void;
  resetDraft: (idx: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
  photos: [],
  selectedWorkType: null,
  selectedStyle: "시공일지형",
  selectedPlatforms: ["naver"],
  selectedPersona: "장인형",
  currentPost: null,
  posts: [],
  shortsVideos: [],
  settings: {
    companyName: "",
    phoneNumber: "",
    serviceArea: "",
    logoUrl: "",
    facePhotoUrl: "",
    companyDescription: "",
    autoInsertCompany: true,
    autoInsertSeo: true,
    naverConnected: false,
    instagramConnected: false,
    tiktokConnected: false,
  },
  subscription: {
    plan: "무료",
    usedCount: 0,
    maxCount: 5,
    videoUsed: 0,
    maxVideo: 1,
    expiresAt: "",
    consecutiveMonths: 0,
  },
  coupons: [],
  inquiries: [],
  referralCode: "BANGSU-A1B2C3",
  referralCount: 3,
  drafts: [createEmptyDraft()],
  activeDraftIdx: 0,

  addPhoto: (photo) =>
    set((state) => ({
      photos: state.photos.length < 10 ? [...state.photos, photo] : state.photos,
    })),
  removePhoto: (id) =>
    set((state) => ({ photos: state.photos.filter((p) => p.id !== id) })),
  setWorkType: (type) => set({ selectedWorkType: type }),
  setSelectedStyle: (style) => set({ selectedStyle: style }),
  togglePlatform: (platform) =>
    set((state) => ({
      selectedPlatforms: state.selectedPlatforms.includes(platform)
        ? state.selectedPlatforms.filter((p) => p !== platform)
        : [...state.selectedPlatforms, platform],
    })),
  setSelectedPersona: (persona) => set({ selectedPersona: persona }),
  setCurrentPost: (post) => set({ currentPost: post }),
  addPost: (post) =>
    set((state) => {
      // 생애 첫 글 이벤트는 로컬 플래그로 1회만 발송
      if (state.posts.length === 0 && !localStorage.getItem("sms_first_post_tracked")) {
        localStorage.setItem("sms_first_post_tracked", "true");
        trackEvent("first_post_created", { work_type: post.workType });
      }
      return { posts: [post, ...state.posts] };
    }),
  updatePostStatus: (id, status) =>
    set((state) => ({
      posts: state.posts.map((p) => (p.id === id ? { ...p, status } : p)),
    })),
  updatePost: (id, updates) =>
    set((state) => ({
      posts: state.posts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  updateSettings: (newSettings) =>
    set((state) => {
      const next = { ...state.settings, ...newSettings };
      // 업체명이 처음으로 채워지는 순간 1회 이벤트
      if (
        !state.settings.companyName &&
        next.companyName &&
        !localStorage.getItem("sms_business_info_tracked")
      ) {
        localStorage.setItem("sms_business_info_tracked", "true");
        trackEvent("business_info_completed");
      }
      return { settings: next };
    }),
  addShortsVideo: (video) =>
    set((state) => ({ shortsVideos: [video, ...state.shortsVideos] })),
  removeShortsVideo: (id) =>
    set((state) => ({ shortsVideos: state.shortsVideos.filter((v) => v.id !== id) })),
  setShortsVideos: (videos) => set({ shortsVideos: videos }),
  addCoupon: (coupon) =>
    set((state) => ({ coupons: [...state.coupons, coupon] })),
  addInquiry: (inquiry) =>
    set((state) => ({ inquiries: [inquiry, ...state.inquiries] })),
  updateSubscription: (sub) =>
    set((state) => ({ subscription: { ...state.subscription, ...sub } })),
  upgradePlan: async (planName: string) => {
    // 기본값 (DB 미연결 시 폴백)
    const defaultLimits: Record<string, { maxCount: number; maxVideo: number }> = {
      "무료": { maxCount: 5, maxVideo: 1 },
      "베이직": { maxCount: 50, maxVideo: 5 },
      "프로": { maxCount: 150, maxVideo: 20 },
      "무제한": { maxCount: 9999, maxVideo: 50 },
    };

    let planLimits = defaultLimits[planName] || defaultLimits["무료"];

    // admin_config에서 관리자가 설정한 요금제 로드
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("admin_config").select("value").eq("key", "plans").single();
      if (data?.value && Array.isArray(data.value)) {
        const dbPlan = data.value.find((p: any) => p.name === planName);
        if (dbPlan) {
          planLimits = {
            maxCount: dbPlan.monthlyLimit ?? 9999,
            maxVideo: dbPlan.monthlyVideoLimit ?? 50,
          };
        }
      }
    } catch {}

    set((state) => ({
      subscription: {
        ...state.subscription,
        plan: planName as PlanType,
        maxCount: planLimits.maxCount,
        maxVideo: planLimits.maxVideo,
      },
    }));
  },
  clearSession: () =>
    set({ photos: [], selectedWorkType: null, currentPost: null }),
  useVideo: () => {
    const state = get();
    const used = state.subscription.videoUsed ?? 0;
    const max = state.subscription.maxVideo ?? 1;
    if (used >= max) return false;
    set((s) => ({ subscription: { ...s.subscription, videoUsed: (s.subscription.videoUsed ?? 0) + 1 } }));
    return true;
  },

  // ── Draft 액션 ──
  addDraft: () =>
    set((state) => {
      if (state.drafts.length >= MAX_DRAFTS) return {};
      const next = [...state.drafts, createEmptyDraft()];
      return { drafts: next, activeDraftIdx: next.length - 1 };
    }),
  removeDraft: (idx) =>
    set((state) => {
      if (state.drafts.length <= 1) {
        // 최소 1개는 유지 — 마지막 1개 삭제 시도는 초기화로 처리
        return { drafts: [createEmptyDraft()], activeDraftIdx: 0 };
      }
      const next = state.drafts.filter((_, i) => i !== idx);
      const newActive = Math.min(state.activeDraftIdx, next.length - 1);
      return { drafts: next, activeDraftIdx: newActive };
    }),
  setActiveDraft: (idx) =>
    set((state) => {
      if (idx < 0 || idx >= state.drafts.length) return {};
      return { activeDraftIdx: idx };
    }),
  updateDraft: (idx, patch) =>
    set((state) => ({
      drafts: state.drafts.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    })),
  addSection: (draftIdx) =>
    set((state) => ({
      drafts: state.drafts.map((d, i) =>
        i === draftIdx ? { ...d, sections: [...d.sections, createEmptySection()] } : d,
      ),
    })),
  addPhotosAsSections: (draftIdx, photos) => {
    let placed = 0;
    set((state) => {
      const drafts = state.drafts.map((d, i) => {
        if (i !== draftIdx) return d;
        const queue = [...photos];
        // 1) 빈 사진 슬롯이 있는 기존 섹션부터 채움
        const updatedSections = d.sections.map((s) => {
          if (!s.photo && queue.length > 0) {
            const next = queue.shift()!;
            placed += 1;
            return { ...s, photo: next };
          }
          return s;
        });
        // 2) 남은 사진은 새 섹션으로 생성
        while (queue.length > 0) {
          const next = queue.shift()!;
          updatedSections.push({
            id: crypto.randomUUID(),
            subtitle: "",
            photo: next,
            text: "",
          });
          placed += 1;
        }
        return { ...d, sections: updatedSections };
      });
      return { drafts };
    });
    return placed;
  },
  updateSection: (draftIdx, sectionId, patch) =>
    set((state) => ({
      drafts: state.drafts.map((d, i) =>
        i === draftIdx
          ? { ...d, sections: d.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)) }
          : d,
      ),
    })),
  removeSection: (draftIdx, sectionId) =>
    set((state) => ({
      drafts: state.drafts.map((d, i) =>
        i === draftIdx ? { ...d, sections: d.sections.filter((s) => s.id !== sectionId) } : d,
      ),
    })),
  resetDraft: (idx) =>
    set((state) => ({
      drafts: state.drafts.map((d, i) => (i === idx ? createEmptyDraft() : d)),
    })),
    }),
    {
      name: "sms-app-store", // localStorage 키
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // 영속화할 필드만 선택 — 일회성 UI 상태는 제외
      partialize: (state) => ({
        settings: state.settings,
        posts: state.posts,
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
    }
  )
);

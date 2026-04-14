import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
}

export interface ContentBlock {
  type: "text" | "photo";
  content: string;
  caption?: string;
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

export type BusinessCategory =
  | "건축_시공"
  | "요식업"
  | "미용_뷰티"
  | "자동차"
  | "청소_방역"
  | "반려동물"
  | "의료_헬스"
  | "교육"
  | "제조_판매"
  | "기타";

export const BUSINESS_CATEGORY_LABELS: Record<BusinessCategory, string> = {
  "건축_시공": "🔨 건축·시공 (방수/도배/타일/리모델링 등)",
  "요식업": "🍲 요식업 (식당/카페/베이커리 등)",
  "미용_뷰티": "💇 미용·뷰티 (미용실/네일/피부관리)",
  "자동차": "🚗 자동차 (세차/정비/튜닝)",
  "청소_방역": "🧹 청소·방역 (입주청소/방역)",
  "반려동물": "🐾 반려동물 (미용/훈련/호텔링)",
  "의료_헬스": "🏥 의료·헬스 (PT/필라테스/한의원)",
  "교육": "📚 교육 (학원/공방/레슨)",
  "제조_판매": "📦 제조·판매 (공방/소품/가구)",
  "기타": "💼 기타",
};

interface Settings {
  companyName: string;
  phoneNumber: string;
  serviceArea: string;
  businessCategory: BusinessCategory | "";
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
  settings: Settings;
  subscription: Subscription;
  coupons: Coupon[];
  inquiries: Inquiry[];
  referralCode: string;
  referralCount: number;
  useVideo: () => boolean;  // 영상 1개 사용

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
  updateSettings: (settings: Partial<Settings>) => void;
  addCoupon: (coupon: Coupon) => void;
  addInquiry: (inquiry: Inquiry) => void;
  updateSubscription: (sub: Partial<Subscription>) => void;
  upgradePlan: (planName: string) => void;
  clearSession: () => void;
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
  settings: {
    companyName: "",
    phoneNumber: "",
    serviceArea: "",
    businessCategory: "" as BusinessCategory | "",
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
    set((state) => ({ posts: [post, ...state.posts] })),
  updatePostStatus: (id, status) =>
    set((state) => ({
      posts: state.posts.map((p) => (p.id === id ? { ...p, status } : p)),
    })),
  updatePost: (id, updates) =>
    set((state) => ({
      posts: state.posts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),
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
      }),
    }
  )
);

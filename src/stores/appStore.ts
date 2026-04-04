import { create } from "zustand";

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

interface Settings {
  companyName: string;
  phoneNumber: string;
  serviceArea: string;
  logoUrl: string;
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
  clearSession: () => void;
}

const mockPosts: BlogPost[] = [
  {
    id: "1",
    title: "강남구 아파트 옥상방수 시공 완료",
    photos: [],
    workType: "옥상방수",
    style: "시공일지형",
    blocks: [],
    hashtags: ["옥상방수", "강남방수", "아파트방수"],
    status: "게시완료",
    createdAt: "2026-04-01",
    platforms: ["naver"],
    persona: "장인형",
  },
  {
    id: "2",
    title: "서초구 상가 외벽방수 시공기",
    photos: [],
    workType: "외벽방수",
    style: "업체홍보형",
    blocks: [],
    hashtags: ["외벽방수", "서초방수"],
    status: "완료",
    createdAt: "2026-03-28",
    platforms: ["naver", "instagram"],
    persona: "전문기업형",
  },
  {
    id: "3",
    title: "송파구 지하주차장 균열보수",
    photos: [],
    workType: "균열보수",
    style: "상담유도형",
    blocks: [],
    hashtags: ["균열보수", "지하방수"],
    status: "작성중",
    createdAt: "2026-03-25",
    platforms: ["naver"],
    persona: "친근형",
  },
];

const mockCoupons: Coupon[] = [
  { id: "c1", code: "WELCOME50", discount: "50% 할인", expiresAt: "2026-05-01", used: false },
  { id: "c2", code: "SPRING20", discount: "20% 할인", expiresAt: "2026-04-30", used: true },
];

const mockInquiries: Inquiry[] = [
  { id: "i1", type: "이용 방법", title: "사진 업로드가 안 됩니다", content: "갤러리에서 사진 선택이 안됩니다", status: "답변완료", createdAt: "2026-03-20" },
  { id: "i2", type: "결제·환불", title: "프로 플랜 결제 문의", content: "연간 결제 변경 방법을 알고 싶습니다", status: "처리중", createdAt: "2026-03-28" },
];

export const useAppStore = create<AppState>((set) => ({
  photos: [],
  selectedWorkType: null,
  selectedStyle: "시공일지형",
  selectedPlatforms: ["naver"],
  selectedPersona: "장인형",
  currentPost: null,
  posts: mockPosts,
  settings: {
    companyName: "",
    phoneNumber: "",
    serviceArea: "서울 강남, 서초, 송파",
    logoUrl: "",
    autoInsertCompany: true,
    autoInsertSeo: true,
    naverConnected: true,
    instagramConnected: false,
    tiktokConnected: false,
  },
  subscription: {
    plan: "베이직",
    usedCount: 23,
    maxCount: 50,
    expiresAt: "2026-04-30",
    consecutiveMonths: 4,
  },
  coupons: mockCoupons,
  inquiries: mockInquiries,
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
}));

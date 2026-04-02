import { create } from "zustand";

export type WorkType = "옥상방수" | "외벽방수" | "지하방수" | "균열보수" | "욕실방수" | "기타";
export type PostStyle = "시공일지형" | "업체홍보형" | "상담유도형" | "후기강조형";
export type PostStatus = "작성중" | "AI생성중" | "완료" | "게시완료";

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
}

export interface ContentBlock {
  type: "text" | "photo";
  content: string; // text content or photo id
  caption?: string;
}

interface Settings {
  companyName: string;
  phoneNumber: string;
  serviceArea: string;
  autoInsertCompany: boolean;
  autoInsertSeo: boolean;
}

interface AppState {
  // Current session
  photos: PhotoItem[];
  selectedWorkType: WorkType | null;
  selectedStyle: PostStyle;
  currentPost: BlogPost | null;

  // History
  posts: BlogPost[];

  // Settings
  settings: Settings;

  // Actions
  addPhoto: (photo: PhotoItem) => void;
  removePhoto: (id: string) => void;
  setWorkType: (type: WorkType) => void;
  setSelectedStyle: (style: PostStyle) => void;
  setCurrentPost: (post: BlogPost | null) => void;
  addPost: (post: BlogPost) => void;
  updatePostStatus: (id: string, status: PostStatus) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  clearSession: () => void;
}

// Mock data
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
  },
];

export const useAppStore = create<AppState>((set) => ({
  photos: [],
  selectedWorkType: null,
  selectedStyle: "시공일지형",
  currentPost: null,
  posts: mockPosts,
  settings: {
    companyName: "",
    phoneNumber: "",
    serviceArea: "",
    autoInsertCompany: true,
    autoInsertSeo: true,
  },

  addPhoto: (photo) =>
    set((state) => ({
      photos: state.photos.length < 10 ? [...state.photos, photo] : state.photos,
    })),
  removePhoto: (id) =>
    set((state) => ({ photos: state.photos.filter((p) => p.id !== id) })),
  setWorkType: (type) => set({ selectedWorkType: type }),
  setSelectedStyle: (style) => set({ selectedStyle: style }),
  setCurrentPost: (post) => set({ currentPost: post }),
  addPost: (post) =>
    set((state) => ({ posts: [post, ...state.posts] })),
  updatePostStatus: (id, status) =>
    set((state) => ({
      posts: state.posts.map((p) => (p.id === id ? { ...p, status } : p)),
    })),
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),
  clearSession: () =>
    set({ photos: [], selectedWorkType: null, currentPost: null }),
}));

import type { StateCreator } from "zustand";
import type {
  AppState,
  BlogPost,
  Persona,
  Platform,
  PostStatus,
  PostStyle,
  WorkType,
} from "../appStore";
import { trackEvent } from "@/lib/analytics";

export interface PostsSlice {
  posts: BlogPost[];
  currentPost: BlogPost | null;
  selectedWorkType: WorkType | null;
  selectedStyle: PostStyle;
  selectedPlatforms: Platform[];
  selectedPersona: Persona;

  setWorkType: (type: WorkType) => void;
  setSelectedStyle: (style: PostStyle) => void;
  togglePlatform: (platform: Platform) => void;
  setSelectedPersona: (persona: Persona) => void;
  setCurrentPost: (post: BlogPost | null) => void;
  addPost: (post: BlogPost) => void;
  updatePostStatus: (id: string, status: PostStatus) => void;
  updatePost: (id: string, updates: Partial<BlogPost>) => void;
}

export const createPostsSlice: StateCreator<
  AppState,
  [["zustand/persist", unknown]],
  [],
  PostsSlice
> = (set) => ({
  posts: [],
  currentPost: null,
  selectedWorkType: null,
  selectedStyle: "시공일지형",
  selectedPlatforms: ["naver"],
  selectedPersona: "장인형",

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
      if (
        state.posts.length === 0 &&
        !localStorage.getItem("sms_first_post_tracked")
      ) {
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
});

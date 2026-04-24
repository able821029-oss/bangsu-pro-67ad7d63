import type { StateCreator } from "zustand";
import type { AppState } from "../appStore";

export interface AuthSlice {
  /** 로그아웃·세션 만료 시 휘발성 일시 상태 초기화 (photos, selectedWorkType, currentPost) */
  clearSession: () => void;
}

export const createAuthSlice: StateCreator<
  AppState,
  [["zustand/persist", unknown]],
  [],
  AuthSlice
> = (set) => ({
  clearSession: () =>
    set({ photos: [], selectedWorkType: null, currentPost: null }),
});

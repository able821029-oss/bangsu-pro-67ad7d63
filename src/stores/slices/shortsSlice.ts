import type { StateCreator } from "zustand";
import type { AppState, ShortsVideo } from "../appStore";

export interface ShortsSlice {
  shortsVideos: ShortsVideo[];
  addShortsVideo: (video: ShortsVideo) => void;
  removeShortsVideo: (id: string) => void;
  setShortsVideos: (videos: ShortsVideo[]) => void;
}

export const createShortsSlice: StateCreator<
  AppState,
  [["zustand/persist", unknown]],
  [],
  ShortsSlice
> = (set) => ({
  shortsVideos: [],
  addShortsVideo: (video) =>
    set((state) => ({ shortsVideos: [video, ...state.shortsVideos] })),
  removeShortsVideo: (id) =>
    set((state) => ({
      shortsVideos: state.shortsVideos.filter((v) => v.id !== id),
    })),
  setShortsVideos: (videos) => set({ shortsVideos: videos }),
});

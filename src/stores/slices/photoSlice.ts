import type { StateCreator } from "zustand";
import type { AppState, PhotoItem } from "../appStore";

export interface PhotoSlice {
  photos: PhotoItem[];
  addPhoto: (photo: PhotoItem) => void;
  removePhoto: (id: string) => void;
}

const MAX_PHOTOS = 10;

export const createPhotoSlice: StateCreator<
  AppState,
  [["zustand/persist", unknown]],
  [],
  PhotoSlice
> = (set) => ({
  photos: [],
  addPhoto: (photo) =>
    set((state) => ({
      photos:
        state.photos.length < MAX_PHOTOS ? [...state.photos, photo] : state.photos,
    })),
  removePhoto: (id) =>
    set((state) => ({ photos: state.photos.filter((p) => p.id !== id) })),
});

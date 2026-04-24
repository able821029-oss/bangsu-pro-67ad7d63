import type { StateCreator } from "zustand";
import type { AppState, Settings } from "../appStore";
import { trackEvent } from "@/lib/analytics";

export interface SettingsSlice {
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;
}

export const createSettingsSlice: StateCreator<
  AppState,
  [["zustand/persist", unknown]],
  [],
  SettingsSlice
> = (set) => ({
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
});

import type { StateCreator } from "zustand";
import type { AppState, Coupon, Inquiry } from "../appStore";

export interface ReferralSlice {
  referralCode: string;
  referralCount: number;
  coupons: Coupon[];
  inquiries: Inquiry[];
  addCoupon: (coupon: Coupon) => void;
  addInquiry: (inquiry: Inquiry) => void;
}

export const createReferralSlice: StateCreator<
  AppState,
  [["zustand/persist", unknown]],
  [],
  ReferralSlice
> = (set) => ({
  referralCode: "BANGSU-A1B2C3",
  referralCount: 3,
  coupons: [],
  inquiries: [],
  addCoupon: (coupon) =>
    set((state) => ({ coupons: [...state.coupons, coupon] })),
  addInquiry: (inquiry) =>
    set((state) => ({ inquiries: [inquiry, ...state.inquiries] })),
});

import type { StateCreator } from "zustand";
import type { AppState, PlanType, Subscription } from "../appStore";

export interface SubscriptionSlice {
  subscription: Subscription;
  updateSubscription: (sub: Partial<Subscription>) => void;
  upgradePlan: (planName: string) => Promise<void>;
  /** 영상 1개 사용 처리. 한도 초과 시 false. */
  useVideo: () => boolean;
}

const DEFAULT_PLAN_LIMITS: Record<string, { maxCount: number; maxVideo: number }> = {
  무료: { maxCount: 5, maxVideo: 1 },
  베이직: { maxCount: 50, maxVideo: 5 },
  프로: { maxCount: 150, maxVideo: 20 },
  무제한: { maxCount: 9999, maxVideo: 50 },
};

export const createSubscriptionSlice: StateCreator<
  AppState,
  [["zustand/persist", unknown]],
  [],
  SubscriptionSlice
> = (set, get) => ({
  subscription: {
    plan: "무료",
    usedCount: 0,
    maxCount: 5,
    videoUsed: 0,
    maxVideo: 1,
    expiresAt: "",
    consecutiveMonths: 0,
  },
  updateSubscription: (sub) =>
    set((state) => ({ subscription: { ...state.subscription, ...sub } })),
  upgradePlan: async (planName: string) => {
    let planLimits = DEFAULT_PLAN_LIMITS[planName] || DEFAULT_PLAN_LIMITS["무료"];

    // admin_config에서 관리자가 설정한 요금제 로드
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("admin_config")
        .select("value")
        .eq("key", "plans")
        .single();
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
  useVideo: () => {
    const state = get();
    const used = state.subscription.videoUsed ?? 0;
    const max = state.subscription.maxVideo ?? 1;
    if (used >= max) return false;
    set((s) => ({
      subscription: {
        ...s.subscription,
        videoUsed: (s.subscription.videoUsed ?? 0) + 1,
      },
    }));
    return true;
  },
});

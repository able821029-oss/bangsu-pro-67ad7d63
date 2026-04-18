/**
 * Analytics — GA4 + Microsoft Clarity 통합 래퍼.
 *
 * - 환경변수(VITE_GA_ID / VITE_CLARITY_ID)가 비어 있으면 no-op.
 * - 프리뷰/iframe 환경에서는 호출 자체를 무시.
 * - 스크립트 자체는 index.html에서 로드됨.
 */

type AnalyticsParams = Record<string, string | number | boolean | undefined | null>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    clarity?: (...args: unknown[]) => void;
  }
}

const GA_ID = import.meta.env.VITE_GA_ID as string | undefined;
const CLARITY_ID = import.meta.env.VITE_CLARITY_ID as string | undefined;

const isBrowser = typeof window !== "undefined";

const isDisabledEnv = (): boolean => {
  if (!isBrowser) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.includes("id-preview--") ||
    host.includes("lovableproject.com")
  );
};

/** 표준 GA4 이벤트 이름 집합 — 오타 방지를 위한 유니온 */
export type TrackedEvent =
  | "sign_up"
  | "onboarding_completed"
  | "first_post_created"
  | "business_info_completed"
  | "upgrade_cta_clicked"
  | "share_kakao_clicked"
  | "post_published";

export function trackEvent(name: TrackedEvent | string, params: AnalyticsParams = {}): void {
  if (!isBrowser || isDisabledEnv()) return;

  // GA4
  if (GA_ID && typeof window.gtag === "function") {
    try {
      window.gtag("event", name, params);
    } catch (error) {
      console.warn("[analytics] gtag event failed", error);
    }
  }

  // Clarity — 커스텀 태그로 기록 (세션 리플레이에서 필터링 가능)
  if (CLARITY_ID && typeof window.clarity === "function") {
    try {
      window.clarity("event", name);
    } catch (error) {
      console.warn("[analytics] clarity event failed", error);
    }
  }
}

export function identifyUser(userId: string): void {
  if (!isBrowser || isDisabledEnv()) return;

  if (GA_ID && typeof window.gtag === "function") {
    try {
      window.gtag("config", GA_ID, { user_id: userId });
    } catch (error) {
      console.warn("[analytics] gtag identify failed", error);
    }
  }
  if (CLARITY_ID && typeof window.clarity === "function") {
    try {
      window.clarity("identify", userId);
    } catch (error) {
      console.warn("[analytics] clarity identify failed", error);
    }
  }
}

/** 디버깅 헬퍼 — 개발자 콘솔에서 GA/Clarity 구성 여부 확인 */
export function getAnalyticsStatus(): { ga: boolean; clarity: boolean; disabled: boolean } {
  return {
    ga: Boolean(GA_ID),
    clarity: Boolean(CLARITY_ID),
    disabled: isDisabledEnv(),
  };
}

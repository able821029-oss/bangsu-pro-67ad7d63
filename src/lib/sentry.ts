/**
 * Sentry 초기화 래퍼.
 *
 * `@sentry/react` 패키지는 런타임에 동적 import로 로드한다.
 * - 패키지가 설치되지 않았거나 DSN이 비어 있으면 no-op.
 * - 프리뷰/iframe/localhost에서는 초기화하지 않음 (노이즈 방지).
 */

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

const shouldInit = (): boolean => {
  if (!SENTRY_DSN) return false;
  if (typeof window === "undefined") return false;
  try {
    if (window.self !== window.top) return false;
  } catch {
    return false;
  }
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return false;
  if (host.includes("id-preview--") || host.includes("lovableproject.com")) return false;
  return true;
};

export async function initSentry(): Promise<void> {
  if (!shouldInit()) return;
  try {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      // 네트워크 오류 / 취소된 요청 같은 흔한 노이즈 제거
      ignoreErrors: [
        "ResizeObserver loop limit exceeded",
        "Non-Error promise rejection captured",
        "Failed to fetch",
        "Load failed",
        "NetworkError",
      ],
    });
  } catch (error) {
    // 패키지 미설치 / 동적 로드 실패 → 조용히 무시 (앱 기동 방해 금지)
    console.info("[sentry] skipped:", (error as Error).message);
  }
}

/** 런타임에서 수동으로 예외 보고 */
export async function reportError(error: unknown, context?: Record<string, unknown>): Promise<void> {
  if (!shouldInit()) return;
  try {
    const Sentry = await import("@sentry/react");
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // 무시
  }
}

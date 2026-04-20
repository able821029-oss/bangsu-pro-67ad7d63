/**
 * 네트워크 fetch 자동 재시도 유틸
 *
 * - 일시적 실패(5xx, 429, 네트워크 오류)에 대해 exponential backoff로 재시도
 * - 사용자 입력 오류(4xx 중 400/401/403/404 등)는 재시도하지 않음
 * - 기본 timeout + AbortController로 무한 대기 방지
 *
 * 여러 사용자 프로덕션 환경에서 Railway·Supabase Edge Function·ElevenLabs 같은
 * 외부 서비스의 일시적 장애에 자가 복구하는 1차 방어선.
 */

interface RetryOptions extends RequestInit {
  retries?: number;       // 재시도 횟수 (기본 2 → 최대 3번 시도)
  retryDelayMs?: number;  // 첫 재시도 딜레이 (기본 800ms, 이후 지수 증가)
  timeoutMs?: number;     // 요청당 타임아웃 (기본 45초)
}

const RETRIABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 522, 524]);

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RetryOptions = {},
): Promise<Response> {
  const retries = init.retries ?? 2;
  const baseDelay = init.retryDelayMs ?? 800;
  const timeoutMs = init.timeoutMs ?? 45_000;

  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);

    try {
      const res = await fetch(input, { ...init, signal: ac.signal });
      clearTimeout(timer);

      // 성공 (2xx, 3xx) → 즉시 반환
      if (res.ok) return res;

      // 재시도 가치가 있는 실패 상태 코드면 다시 시도
      if (RETRIABLE_STATUS.has(res.status) && attempt < retries) {
        const wait = baseDelay * Math.pow(2, attempt);
        await sleep(wait);
        continue;
      }

      // 재시도 불가능한 응답도 Response로 반환 (호출자가 처리)
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) {
        const wait = baseDelay * Math.pow(2, attempt);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }

  throw lastErr ?? new Error("fetch 실패");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Supabase Edge Function 호출 재시도 래퍼
 * invoke 실패 시 최대 2회 재시도 (총 3번 시도).
 */
export async function invokeWithRetry<T = unknown>(
  supabase: { functions: { invoke: (name: string, opts?: { body?: unknown }) => Promise<{ data: T | null; error: Error | null }> } },
  name: string,
  body: unknown,
  retries = 2,
): Promise<{ data: T | null; error: Error | null }> {
  let lastResult: { data: T | null; error: Error | null } = { data: null, error: null };
  for (let attempt = 0; attempt <= retries; attempt++) {
    lastResult = await supabase.functions.invoke(name, { body });
    if (!lastResult.error && lastResult.data && !(lastResult.data as { error?: string })?.error) {
      return lastResult;
    }
    // 마지막 시도가 아니면 잠시 대기 후 재시도
    if (attempt < retries) {
      await sleep(800 * Math.pow(2, attempt));
    }
  }
  return lastResult;
}

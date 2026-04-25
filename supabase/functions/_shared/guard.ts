// ────────────────────────────────────────────────────────────────
// 공개 AI Edge Function 공용 가드 — Origin 검증 + 간이 Rate Limit
// 2026-04-24
//
// 설계 원칙:
//  - 완벽한 보안은 아님. 브라우저 상에서 합법 호출을 가장한 악용을 '싸게' 차단하는 목적.
//  - Deno Edge Function은 인스턴스가 분산될 수 있어 메모리 sliding window는 "인스턴스당" 제한.
//    실측상 단일 리전 소규모 트래픽에서는 대부분의 공격이 같은 인스턴스로 몰리므로 유효.
//  - 더 엄격한 제한이 필요할 땐 usage_logs 테이블 기반 rate limit으로 교체.
//
// 사용법:
//  import { withGuard } from "../_shared/guard.ts";
//  serve(withGuard({ fn: "seo-analyze", limit: 30, windowSec: 60 }, async (req, ctx) => {
//    // ctx.origin, ctx.clientKey 등 활용
//    return new Response(...);
//  }));
// ────────────────────────────────────────────────────────────────

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Max-Age": "86400",
};

const ALLOWED_ORIGINS = new Set([
  "https://sms-app-9p9.pages.dev",
  "http://localhost:8080",
  "http://localhost:5173",
]);

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") || "";
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Cloudflare Pages 브랜치 프리뷰 (*.sms-app-9p9.pages.dev)
  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith(".pages.dev") && hostname.includes("sms-app");
  } catch {
    return false;
  }
}

// ── In-memory sliding window ────────────────────────────────────
// key → [timestamp(ms), ...]  (최근 windowSec 내 호출만 보관)
const buckets = new Map<string, number[]>();

function pruneAndCheck(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const stamps = buckets.get(key) || [];
  // 윈도우 밖 타임스탬프 제거
  const kept = stamps.filter((t) => now - t < windowMs);
  if (kept.length >= limit) {
    const oldest = kept[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    buckets.set(key, kept);
    return { ok: false, retryAfterSec };
  }
  kept.push(now);
  buckets.set(key, kept);
  return { ok: true, retryAfterSec: 0 };
}

export interface GuardOptions {
  fn: string;             // 함수명 (usage_logs 기록용)
  limit: number;          // windowSec 동안 최대 호출 수
  windowSec: number;      // 윈도우 길이
  skipOriginCheck?: boolean;
}

export interface GuardContext {
  origin: string;
  clientKey: string;
  userId: string | null;
}

export type GuardedHandler = (req: Request, ctx: GuardContext) => Promise<Response>;

function extractClientKey(req: Request): string {
  // 우선순위: authorization의 sub(JWT) → x-forwarded-for → origin
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ") && auth.length > 20) {
    // JWT payload의 sub 를 간이 추출 (검증 X, 식별만)
    try {
      const token = auth.slice(7);
      const payload = token.split(".")[1];
      const decoded = JSON.parse(
        atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=")),
      );
      if (decoded?.sub) return `u:${decoded.sub}`;
    } catch {
      // fall through
    }
  }
  const xff = req.headers.get("x-forwarded-for") || "";
  if (xff) return `ip:${xff.split(",")[0].trim()}`;
  const origin = req.headers.get("origin") || "unknown";
  return `o:${origin}`;
}

function extractUserId(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    const token = auth.slice(7);
    const payload = token.split(".")[1];
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=")),
    );
    return decoded?.sub || null;
  } catch {
    return null;
  }
}

export function withGuard(options: GuardOptions, handler: GuardedHandler) {
  const windowMs = options.windowSec * 1000;
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      // 명시적 204 — 일부 엄격 브라우저가 status 미명시(200) 응답을 reject 하는 케이스 회피
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (!options.skipOriginCheck && !isAllowedOrigin(req)) {
      return new Response(JSON.stringify({ error: "허용되지 않은 호출" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || "";
    const clientKey = `${options.fn}:${extractClientKey(req)}`;
    const userId = extractUserId(req);

    const { ok, retryAfterSec } = pruneAndCheck(clientKey, options.limit, windowMs);
    if (!ok) {
      return new Response(
        JSON.stringify({
          error: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.",
          retryAfterSec,
        }),
        {
          status: 429,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSec),
          },
        },
      );
    }

    try {
      return await handler(req, { origin, clientKey, userId });
    } catch (err) {
      console.error(`[${options.fn}] unhandled error:`, err);
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }
  };
}

// ── usage_logs 기록 (선택적, handler에서 직접 호출) ────────────
export interface UsageLogEntry {
  user_id?: string | null;
  fn_name: string;
  status: "ok" | "error" | "rate_limited";
  tokens_input?: number | null;
  tokens_output?: number | null;
  cost_usd?: number | null;
  extra?: Record<string, unknown>;
  origin?: string;
}

export async function logUsage(entry: UsageLogEntry): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    console.warn("[logUsage] SUPABASE_URL/SERVICE_ROLE_KEY missing — skip");
    return;
  }
  try {
    const body = {
      user_id: entry.user_id ?? null,
      fn_name: entry.fn_name,
      status: entry.status,
      tokens_input: entry.tokens_input ?? null,
      tokens_output: entry.tokens_output ?? null,
      cost_usd: entry.cost_usd ?? null,
      extra: entry.extra ?? null,
      origin: entry.origin ?? null,
    };
    await fetch(`${url}/rest/v1/usage_logs`, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "authorization": `Bearer ${serviceKey}`,
        "content-type": "application/json",
        "prefer": "return=minimal",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn("[logUsage] insert failed:", err);
  }
}

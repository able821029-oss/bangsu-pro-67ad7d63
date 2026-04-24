// ────────────────────────────────────────────────────────────────
// 서버측 월 사용량 한도 검증 — usage_current_month 뷰 + subscriptions + admin_config.plans
// 2026-04-25
//
// 클라이언트 subscription.maxCount는 신뢰할 수 없으므로 Edge Function이 직접 DB를
// 조회해 이번 달 한도를 확인한다. 초과 시 429 + usage 정보를 반환.
//
// 사용법:
//  import { checkMonthlyLimit } from "../_shared/usageGuard.ts";
//  const guard = await checkMonthlyLimit(ctx.userId, ctx.clientKey, "generate-blog");
//  if (!guard.allowed) {
//    await logUsage({ user_id: ctx.userId, fn_name: "generate-blog", status: "rate_limited", extra: { blocked: "quota" } });
//    return new Response(JSON.stringify({
//      error: "이번 달 블로그 한도를 모두 사용했습니다.",
//      used: guard.used,
//      max: guard.max,
//    }), { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Retry-After": String(guard.retryAfterSec) } });
//  }
// ────────────────────────────────────────────────────────────────

/** 무료/유료 기본 한도 — admin_config.plans가 없을 때 폴백 */
const DEFAULT_PLAN_LIMITS: Record<string, { maxCount: number; maxVideo: number }> = {
  "무료": { maxCount: 5, maxVideo: 1 },
  "베이직": { maxCount: 50, maxVideo: 5 },
  "프로": { maxCount: 150, maxVideo: 20 },
  "무제한": { maxCount: 9999, maxVideo: 50 },
};

/** anon 사용자는 IP별로 하루 3건만 허용. clientKey 기준 in-memory bucket. */
const ANON_DAILY_LIMIT = 3;
const ANON_WINDOW_MS = 24 * 60 * 60 * 1000;
const anonBuckets = new Map<string, number[]>();

export interface UsageGuardResult {
  allowed: boolean;
  used: number;
  max: number;
  /** 허용될 때까지 대기해야 하는 초 — 월별 한도는 다음 달 1일, anon은 24h. */
  retryAfterSec: number;
  plan: string;
}

function pruneAnon(clientKey: string): { used: number; allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const stamps = (anonBuckets.get(clientKey) || []).filter(
    (t) => now - t < ANON_WINDOW_MS,
  );
  if (stamps.length >= ANON_DAILY_LIMIT) {
    const oldest = stamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((ANON_WINDOW_MS - (now - oldest)) / 1000));
    anonBuckets.set(clientKey, stamps);
    return { used: stamps.length, allowed: false, retryAfterSec };
  }
  stamps.push(now);
  anonBuckets.set(clientKey, stamps);
  return { used: stamps.length, allowed: true, retryAfterSec: 0 };
}

interface RestRow {
  ok_count?: number | string;
}

async function fetchMonthlyOkCount(
  url: string,
  serviceKey: string,
  userId: string,
  fnName: string,
): Promise<number> {
  const params = new URLSearchParams({
    select: "ok_count",
    user_id: `eq.${userId}`,
    fn_name: `eq.${fnName}`,
  });
  const res = await fetch(`${url}/rest/v1/usage_current_month?${params.toString()}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    console.warn("[usageGuard] usage_current_month fetch failed:", res.status);
    return 0;
  }
  const rows = (await res.json()) as RestRow[];
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const raw = rows[0]?.ok_count ?? 0;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : 0;
}

async function fetchUserPlan(
  url: string,
  serviceKey: string,
  userId: string,
): Promise<string> {
  const params = new URLSearchParams({
    select: "plan,status",
    user_id: `eq.${userId}`,
    status: "eq.active",
    order: "created_at.desc",
    limit: "1",
  });
  const res = await fetch(`${url}/rest/v1/subscriptions?${params.toString()}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) return "무료";
  const rows = (await res.json()) as Array<{ plan?: string }>;
  if (!Array.isArray(rows) || rows.length === 0) return "무료";
  return rows[0]?.plan || "무료";
}

async function fetchPlanLimits(
  url: string,
  serviceKey: string,
  planName: string,
): Promise<{ maxCount: number; maxVideo: number }> {
  const fallback = DEFAULT_PLAN_LIMITS[planName] || DEFAULT_PLAN_LIMITS["무료"];
  try {
    const res = await fetch(
      `${url}/rest/v1/admin_config?key=eq.plans&select=value`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) return fallback;
    const rows = (await res.json()) as Array<{ value?: unknown }>;
    const plans = rows?.[0]?.value;
    if (!Array.isArray(plans)) return fallback;
    const row = plans.find(
      (p: unknown) =>
        typeof p === "object" && p !== null && (p as { name?: string }).name === planName,
    ) as { monthlyLimit?: number; monthlyVideoLimit?: number } | undefined;
    if (!row) return fallback;
    return {
      maxCount: typeof row.monthlyLimit === "number" ? row.monthlyLimit : fallback.maxCount,
      maxVideo:
        typeof row.monthlyVideoLimit === "number" ? row.monthlyVideoLimit : fallback.maxVideo,
    };
  } catch (e) {
    console.warn("[usageGuard] admin_config.plans fetch failed:", e);
    return fallback;
  }
}

function secondsUntilNextMonth(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return Math.max(60, Math.floor((next.getTime() - now.getTime()) / 1000));
}

/**
 * 서버측 월별 한도 검증.
 * - userId 없는 anon 호출: IP/client key 기준 하루 {@link ANON_DAILY_LIMIT}건으로 별도 제한
 * - userId 있는 호출: subscriptions.plan + admin_config.plans → usage_current_month.ok_count 비교
 * 실패(DB 응답 이상)는 기본적으로 allow 처리 (사용자에게 실패 원인을 전가하지 않음).
 */
export async function checkMonthlyLimit(
  userId: string | null,
  clientKey: string,
  fnName: string,
): Promise<UsageGuardResult> {
  // 1) anon — 하루 3건 in-memory bucket
  if (!userId) {
    const { used, allowed, retryAfterSec } = pruneAnon(clientKey);
    return {
      allowed,
      used,
      max: ANON_DAILY_LIMIT,
      retryAfterSec,
      plan: "anon",
    };
  }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceKey) {
    // 환경변수 누락 — 운영 사고라서 통과시키되 로그 남김
    console.warn("[usageGuard] SUPABASE_URL/SERVICE_ROLE_KEY missing — bypassing quota check");
    return { allowed: true, used: 0, max: 0, retryAfterSec: 0, plan: "unknown" };
  }

  try {
    const [plan, used] = await Promise.all([
      fetchUserPlan(url, serviceKey, userId),
      fetchMonthlyOkCount(url, serviceKey, userId, fnName),
    ]);
    const limits = await fetchPlanLimits(url, serviceKey, plan);
    const max = fnName === "generate-shorts" ? limits.maxVideo : limits.maxCount;
    const allowed = used < max;
    return {
      allowed,
      used,
      max,
      retryAfterSec: allowed ? 0 : secondsUntilNextMonth(),
      plan,
    };
  } catch (e) {
    console.warn("[usageGuard] check failed (fail-open):", e);
    return { allowed: true, used: 0, max: 0, retryAfterSec: 0, plan: "unknown" };
  }
}

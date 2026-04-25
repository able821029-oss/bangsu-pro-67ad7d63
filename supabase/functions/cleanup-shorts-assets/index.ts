// shorts-assets 버킷 자동 정리 — 2026-04-25
//
// 외부 cron (예: cron-job.org, GitHub Actions, Supabase Database Webhook 등) 이
// 매일 한 번 호출.
//
// 호출 예시:
//   curl -X POST https://stnpepxiysfoblfeqvpu.supabase.co/functions/v1/cleanup-shorts-assets \
//     -H "X-Cron-Secret: <SUPABASE secrets 의 CRON_SECRET 과 동일 값>" \
//     -H "Content-Type: application/json" \
//     -d '{"older_than_hours": 24}'
//
// 응답: { ok: true, deleted_count, freed_bytes, cutoff }
//
// 보안:
//   - X-Cron-Secret 헤더로 검증 (CRON_SECRET 시크릿 필수)
//   - service_role key 로 RPC 호출 → SECURITY DEFINER 함수가 storage.objects 삭제

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-cron-secret, authorization",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // ── 1) 비밀 토큰 검증 ─────────────────────────────────────────
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (!expectedSecret) {
    return new Response(
      JSON.stringify({
        error:
          "CRON_SECRET 시크릿이 설정되지 않았습니다. Supabase Secrets 에서 추가해 주세요.",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
  const givenSecret = req.headers.get("x-cron-secret");
  if (!givenSecret || givenSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── 2) 파라미터 ──────────────────────────────────────────────
  let olderThanHours = 24;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (typeof body?.older_than_hours === "number" && body.older_than_hours > 0) {
        olderThanHours = Math.min(Math.floor(body.older_than_hours), 24 * 30);
      }
    } catch {
      /* ignore */
    }
  }

  // ── 3) RPC 호출 ──────────────────────────────────────────────
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_URL/SERVICE_ROLE_KEY 누락" }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const rpcRes = await fetch(`${url}/rest/v1/rpc/cleanup_shorts_assets`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ older_than_hours: olderThanHours }),
    });

    const text = await rpcRes.text();
    let json: Array<{
      deleted_count: number;
      freed_bytes: number;
      cutoff: string;
    }> | { message?: string } | null = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* not json */
    }

    if (!rpcRes.ok) {
      const detail =
        (json as { message?: string } | null)?.message ||
        text.slice(0, 250) ||
        rpcRes.statusText;
      console.error(
        `[cleanup-shorts-assets] RPC ${rpcRes.status}: ${detail}`,
      );
      return new Response(
        JSON.stringify({
          error: `RPC 실패 (${rpcRes.status}): ${detail}`,
        }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const row = Array.isArray(json) && json.length > 0 ? json[0] : null;
    const result = {
      ok: true,
      deleted_count: row?.deleted_count ?? 0,
      freed_bytes: row?.freed_bytes ?? 0,
      freed_mb:
        row?.freed_bytes != null
          ? Math.round((row.freed_bytes / 1024 / 1024) * 10) / 10
          : 0,
      cutoff: row?.cutoff ?? null,
      older_than_hours: olderThanHours,
    };

    console.log(
      `[cleanup-shorts-assets] 완료 — ${result.deleted_count}개 삭제, ${result.freed_mb}MB 회수`,
    );

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[cleanup-shorts-assets] 예외:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
});

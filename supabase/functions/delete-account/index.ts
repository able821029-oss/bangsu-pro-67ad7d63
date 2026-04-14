import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 회원 탈퇴 Edge Function
 *
 * 호출 시 JWT로 본인 확인 후 auth.users 테이블에서 즉시 삭제.
 * CASCADE 설정으로 profiles, schedules, contents, posts 등 관련 테이블
 * 자동 삭제 (각 테이블에 ON DELETE CASCADE 설정되어 있음).
 *
 * 필수 secrets:
 *   SUPABASE_URL (자동)
 *   SUPABASE_SERVICE_ROLE_KEY (자동)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1) 호출자 JWT 검증 — 자신의 계정만 삭제 가능
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "인증 헤더 누락" }, 401);
    }
    const jwt = authHeader.replace("Bearer ", "");

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await anonClient.auth.getUser(jwt);
    if (userErr || !userData.user) {
      return json({ error: "유효하지 않은 세션입니다" }, 401);
    }
    const userId = userData.user.id;

    // 2) 선택: 사유 로깅 (요청 body에 reason 필드 있으면 기록)
    let reason = "";
    try {
      const body = await req.json();
      reason = String(body?.reason || "").slice(0, 500);
    } catch {
      /* body 없어도 OK */
    }
    if (reason) {
      console.log(`[delete-account] user=${userId} email=${userData.user.email} reason=${reason}`);
    }

    // 3) service role로 실제 삭제
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteErr) {
      console.error("[delete-account] delete error:", deleteErr);
      return json({ error: "탈퇴 처리 실패", detail: deleteErr.message }, 500);
    }

    return json({ ok: true, deletedUserId: userId });
  } catch (e) {
    console.error("[delete-account]", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Severity = "info" | "warning" | "critical";

const severityConfig: Record<
  Severity,
  { emoji: string; color: string }
> = {
  info: { emoji: "ℹ️", color: "#2563eb" },
  warning: { emoji: "⚠️", color: "#f59e0b" },
  critical: { emoji: "🚨", color: "#dc2626" },
};

function normalizeSeverity(v: unknown): Severity {
  return v === "warning" || v === "critical" ? v : "info";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1) 관리자 여부 검증 — verify_jwt=true로 Supabase가 JWT를 1차 검증하지만,
    //    is_admin 플래그는 여기서 다시 확인한다.
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "세션 확인 실패" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileErr || !profile?.is_admin) {
      return new Response(JSON.stringify({ error: "관리자 권한이 필요합니다" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) 입력 검증
    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const severity = normalizeSeverity(body?.severity);

    if (!title || !message) {
      return new Response(JSON.stringify({ error: "title, message는 필수입니다" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (title.length > 200 || message.length > 4000) {
      return new Response(JSON.stringify({ error: "메시지가 너무 깁니다" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Slack webhook
    const webhook = Deno.env.get("ADMIN_SLACK_WEBHOOK") || "";
    if (!webhook) {
      return new Response(
        JSON.stringify({ error: "ADMIN_SLACK_WEBHOOK 환경변수가 설정되지 않았습니다" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { emoji, color } = severityConfig[severity];
    const payload = {
      attachments: [
        {
          color,
          title: `${emoji} ${title}`,
          text: message,
          footer: `severity=${severity} · user=${userData.user.email ?? userId}`,
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Slack 전송 실패 (${res.status}): ${text.slice(0, 200)}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ops-alert error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "오류 발생" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

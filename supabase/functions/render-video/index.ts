import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RAILWAY_URL = "https://bangsu-pro-67ad7d63-production-6e2e.up.railway.app";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 클라이언트의 Supabase JWT를 그대로 전달
    const authHeader = req.headers.get("authorization") || "";
    const body = await req.json();

    // Railway 서버로 프록시 (서버↔서버 = CORS 없음)
    const railwayRes = await fetch(`${RAILWAY_URL}/render-video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(body),
    });

    if (!railwayRes.ok) {
      const err = await railwayRes.json().catch(() => ({ error: "Railway 오류" }));
      return new Response(JSON.stringify({ error: err.error || "렌더링 실패" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await railwayRes.json();
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "오류 발생" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withGuard, CORS_HEADERS, logUsage } from "../_shared/guard.ts";

const corsHeaders = CORS_HEADERS;

const RAILWAY_URL = "https://bangsu-pro-67ad7d63-production-6e2e.up.railway.app";

// Railway 렌더 프록시 — Origin 검증 + 60초에 20회 rate limit
serve(withGuard({ fn: "render-video", limit: 20, windowSec: 60 }, async (req, ctx) => {
  try {
    const body = await req.json();
    const apiSecret = Deno.env.get("VIDEO_API_SECRET") || "";

    // Railway 서버로 프록시 (서버↔서버 = CORS 없음, 공유 시크릿 인증)
    const railwayRes = await fetch(`${RAILWAY_URL}/render-video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": apiSecret,
      },
      body: JSON.stringify(body),
    });

    if (!railwayRes.ok) {
      const err = await railwayRes.json().catch(() => ({ error: "Railway 오류" }));
      void logUsage({
        user_id: ctx.userId,
        fn_name: "render-video",
        status: "error",
        origin: ctx.origin,
        extra: {
          message: `railway_${railwayRes.status}`,
          step: err.step,
          detail: typeof err.detail === "string" ? err.detail.slice(0, 200) : undefined,
        },
      });
      return new Response(JSON.stringify({
        error: err.error || "렌더링 실패",
        detail: err.detail,
        step: err.step,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await railwayRes.json();
    void logUsage({
      user_id: ctx.userId,
      fn_name: "render-video",
      status: "ok",
      origin: ctx.origin,
      extra: { sceneCount: Array.isArray(body?.scenes) ? body.scenes.length : undefined },
    });
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    void logUsage({
      user_id: ctx.userId,
      fn_name: "render-video",
      status: "error",
      origin: ctx.origin,
      extra: { message: e instanceof Error ? e.message : "unknown" },
    });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "오류 발생" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withGuard, CORS_HEADERS, logUsage } from "../_shared/guard.ts";

const corsHeaders = CORS_HEADERS;

// Shotstack 정식 호스트 (generate-shorts 와 일치 유지):
//   - Production: https://api.shotstack.io/edit/v1
//   - Stage / Sandbox (무료): https://api.shotstack.io/edit/stage
const SHOTSTACK_HOST_DEFAULT = "https://api.shotstack.io/edit/stage";

// 폴링 전용 — 클라이언트가 3~5초 간격으로 호출하므로 60초당 30회까지 허용
serve(
  withGuard(
    { fn: "generate-shorts-status", limit: 30, windowSec: 60 },
    async (req, ctx) => {
      try {
        const SHOTSTACK_API_KEY = Deno.env.get("SHOTSTACK_API_KEY");
        if (!SHOTSTACK_API_KEY) {
          return new Response(
            JSON.stringify({
              error: "SHOTSTACK_API_KEY 가 설정되지 않았습니다.",
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        const SHOTSTACK_HOST =
          Deno.env.get("SHOTSTACK_HOST") || SHOTSTACK_HOST_DEFAULT;

        // renderId 는 body 또는 query string 둘 다 받는다.
        let renderId: string | null = null;
        const url = new URL(req.url);
        renderId = url.searchParams.get("renderId");
        if (!renderId && req.method !== "GET") {
          try {
            const body = await req.json();
            if (body && typeof body.renderId === "string") {
              renderId = body.renderId;
            }
          } catch {
            /* ignore — query 만 사용 */
          }
        }
        if (!renderId) {
          return new Response(
            JSON.stringify({ error: "renderId 가 필요합니다." }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const safeId = renderId.trim();
        if (!/^[a-zA-Z0-9_-]{8,64}$/.test(safeId)) {
          return new Response(
            JSON.stringify({ error: "renderId 형식이 올바르지 않습니다." }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const statusUrl = `${SHOTSTACK_HOST.replace(/\/+$/, "")}/render/${encodeURIComponent(safeId)}`;
        const res = await fetch(statusUrl, {
          method: "GET",
          headers: {
            "x-api-key": SHOTSTACK_API_KEY,
            Accept: "application/json",
          },
        });

        const text = await res.text();
        let json:
          | {
              success?: boolean;
              message?: string;
              response?: {
                id?: string;
                status?: string;
                url?: string;
                poster?: string;
                thumbnail?: string;
                duration?: number;
                renderTime?: number;
                error?: string;
              };
            }
          | null = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          /* JSON 이 아닌 응답 (HTML 에러 페이지 등) — text 그대로 사용 */
        }

        if (!res.ok) {
          const detail =
            json?.message ||
            text.slice(0, 250) ||
            res.statusText ||
            "응답 본문 없음";
          console.error(
            `[Shotstack GET ${statusUrl}] ${res.status} ${res.statusText} — ${detail}`,
          );
          void logUsage({
            user_id: ctx.userId,
            fn_name: "generate-shorts-status",
            status: "error",
            origin: ctx.origin,
            extra: {
              renderId: safeId,
              shotstackStatus: res.status,
              detail,
            },
          });
          return new Response(
            JSON.stringify({ error: `Shotstack ${res.status}: ${detail}` }),
            {
              status: 502,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        if (!json) {
          return new Response(
            JSON.stringify({
              error: `Shotstack 응답 파싱 실패 (${res.status}): ${text.slice(0, 200)}`,
            }),
            {
              status: 502,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const r = json.response || {};
        const normalized = {
          renderId: r.id || safeId,
          status: r.status || "unknown",
          url: r.url || null,
          poster: r.poster || r.thumbnail || null,
          duration: typeof r.duration === "number" ? r.duration : null,
          renderTime:
            typeof r.renderTime === "number" ? r.renderTime : null,
          error:
            r.status === "failed" ? r.error || "렌더링 실패" : undefined,
        };

        void logUsage({
          user_id: ctx.userId,
          fn_name: "generate-shorts-status",
          status: "ok",
          origin: ctx.origin,
          extra: {
            renderId: safeId,
            shotstackStatus: normalized.status,
          },
        });

        return new Response(JSON.stringify(normalized), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("generate-shorts-status error:", e);
        void logUsage({
          user_id: ctx.userId,
          fn_name: "generate-shorts-status",
          status: "error",
          origin: ctx.origin,
          extra: { message: e instanceof Error ? e.message : "unknown" },
        });
        return new Response(
          JSON.stringify({
            error: e instanceof Error ? e.message : "다시 시도해 주세요",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    },
  ),
);

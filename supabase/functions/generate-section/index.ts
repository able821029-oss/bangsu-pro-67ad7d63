import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withGuard, CORS_HEADERS, logUsage } from "../_shared/guard.ts";

// 공통 CORS — 기존 `corsHeaders` 참조를 그대로 두기 위해 alias
const corsHeaders = CORS_HEADERS;

/**
 * generate-section
 * 섹션 한 개의 짧은 본문(5줄 내외 ~120~200자)을 작성한다.
 * 입력: { subtitle, photoDataUrl?, location?, siteMethod?, siteArea?, mode? }
 * 출력: { text: string }
 *
 * - generate-blog 보다 가벼움 — 월 한도(checkMonthlyLimit) 적용 안 함, rate limit만 적용
 * - 모델: claude-haiku-4-5-20251001 (CLAUDE.md 룰)
 */
serve(withGuard({ fn: "generate-section", limit: 20, windowSec: 60 }, async (req, ctx) => {
  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    const body = await req.json().catch(() => ({}));
    const {
      subtitle = "",
      photoDataUrl = "",
      location = "",
      siteMethod = "",
      siteArea = "",
      mode = "expert", // "expert" | "vlog"
    } = body || {};

    const cleanSubtitle = String(subtitle || "").trim();
    if (!cleanSubtitle && !photoDataUrl) {
      return new Response(
        JSON.stringify({ error: "소제목 또는 사진 중 하나는 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const expertSystem = `당신은 시공 업체 사장님의 블로그 본문을 도와주는 작가입니다.
주어진 소제목과 사진을 바탕으로 그 섹션 한 단락만 자연스럽게 작성합니다.

[톤]
- 전문가의 신뢰감 있는 어조, 과장 금지
- "~합니다", "~했습니다" 반복 금지 — 구어체와 단정형 섞기
- 광고 티 빼고 현장에서 본 사실 위주

[분량]
- 정확히 5줄 내외, 120~200자
- 문장은 짧고 명확하게
- 사진이 있으면 사진에서 보이는 디테일 1가지를 자연스럽게 언급

[출력]
- 본문 텍스트만 반환. 따옴표·소제목·해시태그·머리말 금지.`;

    const vlogSystem = `당신은 일상 브이로그 본문을 도와주는 작가입니다.
주어진 짧은 텍스트(소제목)와 사진을 바탕으로 솔직하고 가벼운 한 단락을 작성합니다.

[톤]
- 친근한 1인칭 일기체 ("오늘", "이날" 등)
- 정보 나열보다 그 순간의 분위기·느낌 위주
- 이모지·해시태그 금지 (본문만)

[분량]
- 정확히 5줄 내외, 120~200자
- 사진이 있으면 사진의 분위기 1가지 언급

[출력]
- 본문 텍스트만 반환. 따옴표·소제목·해시태그·머리말 금지.`;

    const systemPrompt = mode === "vlog" ? vlogSystem : expertSystem;

    const userContent: Array<Record<string, unknown>> = [];

    // 사진이 있으면 첨부 (data:image/...;base64 형식)
    if (photoDataUrl && typeof photoDataUrl === "string") {
      const m = photoDataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
      if (m) {
        userContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: `image/${m[1]}`,
            data: m[2],
          },
        });
      }
    }

    const ctxBits: string[] = [];
    if (cleanSubtitle) ctxBits.push(`소제목: ${cleanSubtitle}`);
    if (location) ctxBits.push(`지역: ${location}`);
    if (siteMethod) ctxBits.push(`공법: ${siteMethod}`);
    if (siteArea) ctxBits.push(`시공면적: ${siteArea}`);

    userContent.push({
      type: "text",
      text: `${ctxBits.join(" / ")}

위 소제목과 사진을 바탕으로 5줄 내외 본문 한 단락만 작성해주세요. 본문 텍스트만 반환.`,
    });

    if (!ANTHROPIC_API_KEY) {
      // mock — 호출 가능 여부 확인용
      const fallback = mode === "vlog"
        ? `이날은 ${cleanSubtitle || "특별한 순간"}이었습니다.\n사진을 보면 그 분위기가 잘 느껴져요.\n잠깐이지만 기억에 남는 시간이었습니다.\n다음에도 또 이런 날이 있었으면 좋겠어요.\n오늘 하루 잘 마무리합니다.`
        : `${cleanSubtitle || "현장"}에서 작업한 내용입니다.\n${location ? `${location} 현장이며 ` : ""}${siteMethod || "전문 공법"}으로 진행했습니다.\n사진에서 보이듯 마감 상태가 깔끔하게 처리됐습니다.\n시공 면적과 환경에 맞춰 꼼꼼하게 작업했습니다.\n이후 점검에서도 문제없이 안정적으로 유지되고 있습니다.`;
      return new Response(JSON.stringify({ text: fallback, isMock: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropic = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400, // 5줄 본문 + 약간 여유
        // 시스템 프롬프트는 모드별로 동일 → prompt caching 적용
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!anthropic.ok) {
      const errText = await anthropic.text().catch(() => "");
      console.error("[generate-section] anthropic error:", anthropic.status, errText);
      void logUsage({
        user_id: ctx.userId,
        fn_name: "generate-section",
        status: "error",
        origin: ctx.origin,
        extra: { http: anthropic.status, mode },
      });
      return new Response(
        JSON.stringify({ error: "AI 호출 실패", text: "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await anthropic.json();
    const rawText = data?.content?.[0]?.text?.toString().trim() || "";

    void logUsage({
      user_id: ctx.userId,
      fn_name: "generate-section",
      status: "ok",
      tokens_input: data?.usage?.input_tokens ?? null,
      tokens_output: data?.usage?.output_tokens ?? null,
      origin: ctx.origin,
      extra: { mode, hasPhoto: userContent.some((c) => c.type === "image") },
    });

    return new Response(JSON.stringify({ text: rawText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-section] error:", e);
    void logUsage({
      user_id: ctx.userId,
      fn_name: "generate-section",
      status: "error",
      origin: ctx.origin,
      extra: { message: e instanceof Error ? e.message : "unknown" },
    });
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "알 수 없는 오류" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}));

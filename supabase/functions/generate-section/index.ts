import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withGuard, CORS_HEADERS, logUsage } from "../_shared/guard.ts";

// 공통 CORS — 기존 `corsHeaders` 참조를 그대로 두기 위해 alias
const corsHeaders = CORS_HEADERS;

/**
 * generate-section
 * 섹션 한 개의 짧은 본문(2~3줄, 60~110자)을 작성한다.
 * 입력: { subtitle, keywords?, photoDataUrl?, location?, siteMethod?, siteArea?, mode? }
 * 출력: { text: string }
 *
 * - generate-blog 보다 가벼움 — 월 한도(checkMonthlyLimit) 적용 안 함, rate limit만 적용
 * - 모델: claude-haiku-4-5-20251001 (CLAUDE.md 룰)
 *
 * [중복/순서 방지]
 * 사용자가 입력한 keywords가 있으면 본문은 그 키워드만을 핵심 축으로 잡아 작성한다.
 * 키워드가 비어있으면 소제목+사진의 1차원 묘사로만 한정 — 다른 섹션과 내용이 겹치지 않게.
 */
serve(withGuard({ fn: "generate-section", limit: 20, windowSec: 60 }, async (req, ctx) => {
  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    const body = await req.json().catch(() => ({}));
    const {
      subtitle = "",
      keywords = "",
      photoDataUrl = "",
      location = "",
      siteMethod = "",
      siteArea = "",
      mode = "expert", // "expert" | "vlog"
    } = body || {};

    const cleanSubtitle = String(subtitle || "").trim();
    const cleanKeywords = String(keywords || "").trim();
    if (!cleanSubtitle && !cleanKeywords && !photoDataUrl) {
      return new Response(
        JSON.stringify({ error: "소제목·키워드·사진 중 하나는 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const expertSystem = `당신은 시공 업체 사장님의 블로그 본문을 도와주는 작가입니다.
주어진 소제목·키워드·사진을 바탕으로 그 섹션 한 단락만 매우 짧게 작성합니다.

[톤]
- 전문가의 신뢰감 있는 어조, 과장 금지
- "~합니다", "~했습니다" 반복 금지 — 구어체와 단정형 섞기
- 광고 티 빼고 현장에서 본 사실 위주

[분량 — 매우 중요]
- **정확히 2~3줄, 60~110자**
- 문장 한 개 또는 두 개. 길게 늘리지 마세요.
- 핵심 한 가지만 짚고 끝내세요.

[중복·순서 방지]
- 사용자가 키워드를 줬다면 그 키워드만을 축으로 작성. 키워드 외 정보는 넣지 마세요.
- 키워드가 없으면 소제목과 사진에서 보이는 단 한 가지 사실만 담으세요.
- 다른 섹션의 내용과 겹칠 만한 일반론(시공 절차 전체 설명 등) 금지.
- 시공 단계 순서를 추측해 끼워 넣지 마세요. 사용자가 준 정보 안에서만 작성.

[출력]
- 본문 텍스트만 반환. 따옴표·소제목·해시태그·머리말 금지.`;

    const vlogSystem = `당신은 일상 브이로그 본문을 도와주는 작가입니다.
주어진 짧은 텍스트·키워드·사진을 바탕으로 솔직하고 가벼운 한 단락을 매우 짧게 작성합니다.

[톤]
- 친근한 1인칭 일기체 ("오늘", "이날" 등)
- 정보 나열보다 그 순간의 분위기·느낌 위주
- 이모지·해시태그 금지 (본문만)

[분량 — 매우 중요]
- **정확히 2~3줄, 60~110자**
- 핵심 한 가지 느낌만 담고 끝내세요.

[중복·순서 방지]
- 키워드가 있으면 그 키워드 중심으로만 작성.
- 키워드가 없으면 소제목과 사진의 분위기 한 가지만 담으세요.
- 다른 장면과 겹칠 만한 하루 요약·총평 같은 메타 서술 금지.

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
    if (cleanKeywords) ctxBits.push(`키워드(이것을 핵심 축으로): ${cleanKeywords}`);
    if (location) ctxBits.push(`지역: ${location}`);
    if (siteMethod) ctxBits.push(`공법: ${siteMethod}`);
    if (siteArea) ctxBits.push(`시공면적: ${siteArea}`);

    userContent.push({
      type: "text",
      text: `${ctxBits.join(" / ")}

위 정보로 2~3줄(60~110자)짜리 본문 한 단락만 작성해주세요. 키워드가 있으면 그 키워드만을 축으로 작성. 본문 텍스트만 반환.`,
    });

    if (!ANTHROPIC_API_KEY) {
      // mock — 호출 가능 여부 확인용 (2~3줄 짧게)
      const kwHint = cleanKeywords ? cleanKeywords.split(/[,，]/)[0]?.trim() : "";
      const fallback = mode === "vlog"
        ? `${cleanSubtitle || "이 순간"}${kwHint ? ` — ${kwHint}` : ""}.\n사진 속 분위기가 그대로 남아 있어요.`
        : `${cleanSubtitle || "현장"}${kwHint ? ` — ${kwHint}` : ""}.\n${siteMethod ? `${siteMethod}으로 ` : ""}꼼꼼히 마감했습니다.`;
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
        max_tokens: 180, // 2~3줄 본문 + 약간 여유 (한국어 110자 ≈ 75 토큰)
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

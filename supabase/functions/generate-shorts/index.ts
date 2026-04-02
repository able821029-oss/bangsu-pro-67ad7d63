import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    const body = await req.json();
    const { photos, workType, videoStyle, narrationType, location, buildingType, constructionDate, companyName, phoneNumber } = body;

    const styleGuide: Record<string, string> = {
      "시공일지형": "시공 전 → 시공 중 → 시공 후 순서로 장면을 구성합니다.",
      "홍보형": "완료된 시공 사진을 강조하고, 업체 정보와 연락처를 부각합니다.",
      "Before/After형": "시공 전후 비교를 중심으로 극적인 변화를 보여줍니다.",
    };

    const systemPrompt = `당신은 쇼츠 영상 스크립트 작성 전문가입니다.
${styleGuide[videoStyle] || styleGuide["시공일지형"]}

[응답 형식 — 반드시 JSON으로]
{
  "scenes": [
    {"photo_id": 1, "duration": 4, "caption_top": "상단자막", "caption_bottom": "하단자막", "effect": "zoomin"},
    ...
  ],
  "bgm": "upbeat"
}

규칙:
- scenes 배열은 제공된 사진 수 + 1 (마지막은 엔딩 카드, photo_id: null)
- 각 장면 duration: 3~5초
- effect: "zoomin" 또는 "zoomout" 교차 사용
- 마지막 엔딩 카드: caption_top은 업체명, caption_bottom은 전화번호, effect는 "fadein"
- JSON만 응답`;

    let scenes;

    if (ANTHROPIC_API_KEY) {
      const userContent: any[] = [];
      const photoSlice = (photos || []).slice(0, 5);
      for (const photo of photoSlice) {
        const dataUrl = photo.dataUrl || photo;
        const base64Match = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
        if (base64Match) {
          userContent.push({
            type: "image",
            source: { type: "base64", media_type: `image/${base64Match[1]}`, data: base64Match[2] },
          });
        }
      }
      userContent.push({
        type: "text",
        text: `공사유형: ${workType}, 위치: ${location || "미입력"}, 건물: ${buildingType || "미입력"}, 일자: ${constructionDate || "오늘"}, 업체명: ${companyName || "SMS"}, 연락처: ${phoneNumber || ""}, 사진 ${photoSlice.length}장, 영상 스타일: ${videoStyle}. JSON으로 응답.`,
      });

      try {
        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "content-type": "application/json",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: "user", content: userContent }],
          }),
        });

        if (anthropicRes.ok) {
          const claudeData = await anthropicRes.json();
          const rawText = claudeData.content?.[0]?.text || "";
          const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/\{[\s\S]*\}/);
          scenes = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawText);
        }
      } catch (e) {
        console.error("Claude API error for shorts script:", e);
      }
    }

    // Fallback mock script
    if (!scenes) {
      const photoCount = (photos || []).length;
      const mockScenes = [];
      for (let i = 0; i < photoCount; i++) {
        mockScenes.push({
          photo_id: i + 1, duration: 4,
          caption_top: i === 0 ? `${location || "현장"} ${buildingType || "건물"}` : `시공 ${i + 1}단계`,
          caption_bottom: i === 0 ? "시공 전 상태" : i === photoCount - 1 ? "시공 완료" : "작업 진행 중",
          effect: i % 2 === 0 ? "zoomin" : "zoomout",
        });
      }
      mockScenes.push({
        photo_id: null, duration: 4,
        caption_top: companyName || "SMS",
        caption_bottom: phoneNumber || "",
        effect: "fadein",
      });
      scenes = { scenes: mockScenes, bgm: "upbeat", isMock: true };
    }

    return new Response(JSON.stringify(scenes), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-shorts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "다시 시도해 주세요" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

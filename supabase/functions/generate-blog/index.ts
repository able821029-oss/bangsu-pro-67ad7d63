import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const personaPrompts: Record<string, string> = {
  "장인형": `당신은 30년 경력의 방수 장인입니다. 현장 경험에서 우러나오는 전문 지식과 꼼꼼한 시공 과정을 강조하세요. 말투는 무게감 있고 신뢰감을 주는 톤입니다.`,
  "친근형": `당신은 동네에서 인정받는 친근한 방수 전문가입니다. 이웃집 아저씨처럼 편안한 말투로, 어려운 전문 용어 대신 쉬운 표현을 사용하세요.`,
  "전문기업형": `당신은 체계적인 방수 전문 기업의 대표입니다. 공정별 상세 설명, 사용 자재 정보, 품질 보증 내용을 포함하세요. 격식체를 사용하세요.`,
};

const platformPrompts: Record<string, string> = {
  naver: `[네이버 블로그 형식]
- 글자 수: 700~900자
- 제목: 지역명 + 공사유형 + 핵심키워드
- 본문 첫 문단: 핵심 키워드 2~3회 자연 삽입
- 본문 중간: 시공 과정 단계별 설명
- 소제목 활용, 줄바꿈 가독성
- 해시태그 10개: #지역+방수공사 #공사유형 #방수업체추천 형태
- SEO 키워드: 지역명, 공사유형, 방수업체, 시공후기`,
  instagram: `[인스타그램 형식]
- 글자 수: 150자 이내
- 첫 줄: 훅 문장 (질문형/숫자)
- 줄바꿈 2~3회
- 해시태그 20개`,
  tiktok: `[틱톡 형식]
- 3줄 자막: 훅/과정/결과+CTA
- 해시태그 5개`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      photos, // base64 image array [{dataUrl}]
      workType,
      persona,
      platform,
      location,
      buildingType,
      constructionDate,
      companyName,
      phoneNumber,
    } = body;

    const personaText = personaPrompts[persona] || personaPrompts["장인형"];
    const platformText = platformPrompts[platform] || platformPrompts["naver"];

    const systemPrompt = `${personaText}

${platformText}

[업종 자동 판단 — 필수]
첨부된 사진을 분석하여 어떤 현장 업종인지 자동으로 판단하라.
(방수·토목·인테리어·간판·조경·철거·도장·타일·전기·설비 등)
판단한 업종을 글쓰기에 반영하고, 해당 업종의 SEO 키워드를 자동 적용하라.
사진에서 공사 유형(옥상방수, 외벽방수, 균열보수 등)도 구체적으로 판단하여 제목과 본문에 삽입하라.

[응답 형식 — 반드시 JSON으로 응답]
{
  "title": "글 제목",
  "detectedWorkType": "AI가 판단한 공사 유형",
  "blocks": [
    {"type": "text", "content": "본문 텍스트"},
    {"type": "photo", "content": "photo-1", "caption": "사진 설명"},
    {"type": "text", "content": "본문 텍스트"},
    {"type": "photo", "content": "photo-2", "caption": "사진 설명"},
    {"type": "text", "content": "마무리 텍스트"}
  ],
  "hashtags": ["해시태그1", "해시태그2"]
}

규칙:
- blocks 배열에서 text와 photo를 교차 배치
- photo 블록의 content는 "photo-1", "photo-2" 등 순번
- photo 블록 수는 제공된 사진 수에 맞춤
- 업체명과 전화번호를 본문 마지막에 자연스럽게 삽입
- JSON만 응답. 다른 텍스트 없이.`;

    const userContent: any[] = [];

    // Add images (max 5)
    const photoSlice = (photos || []).slice(0, 5);
    for (let i = 0; i < photoSlice.length; i++) {
      const dataUrl = photoSlice[i].dataUrl || photoSlice[i];
      const base64Match = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
      if (base64Match) {
        userContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: `image/${base64Match[1]}`,
            data: base64Match[2],
          },
        });
      }
    }

    userContent.push({
      type: "text",
      text: `다음 정보로 ${platform === "naver" ? "네이버 블로그" : platform === "instagram" ? "인스타그램" : "틱톡"} 글을 작성해주세요.

- 공사 유형: ${workType}
- 시공 위치: ${location || "미입력"}
- 건물 유형: ${buildingType || "미입력"}
- 시공 일자: ${constructionDate || "오늘"}
- 업체명: ${companyName || "SMS"}
- 연락처: ${phoneNumber || ""}
- 첨부 사진: ${photoSlice.length}장

JSON 형식으로만 응답해주세요.`,
    });

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error("Claude API error:", anthropicResponse.status, errText);

      // Fallback mock response for testing when Claude is unavailable
      const photoBlocks = photoSlice.flatMap((_, i) => [
        { type: "photo" as const, content: `photo-${i + 1}`, caption: `${workType} 시공 현장 사진 ${i + 1}` },
        { type: "text" as const, content: i === photoSlice.length - 1
          ? `${companyName || "SMS"}에서 ${location || "현장"}의 ${buildingType || "건물"} ${workType} 시공을 완료했습니다. 문의: ${phoneNumber || "전화문의"}`
          : `${workType} 시공 ${i + 1}단계를 진행했습니다. 꼼꼼하게 작업하여 완벽한 방수 처리를 완료했습니다.` },
      ]);

      const mockResponse = {
        title: `${location || "현장"} ${buildingType || ""} ${workType} 시공 완료`,
        blocks: [
          { type: "text", content: `안녕하세요, ${companyName || "SMS"}입니다.\n${constructionDate || "오늘"} ${location || "현장"}에서 ${workType} 시공을 진행했습니다.` },
          ...photoBlocks,
        ],
        hashtags: platform === "instagram"
          ? ["방수공사", "옥상방수", workType, "시공후기", "방수전문", "인테리어", "집수리", "리모델링", "방수업체", "방수시공", ...(location ? [location.replace(/\s/g, ""), location + "방수"] : []), "SMS", "시공완료", "건물방수", "누수차단", "우레탄방수", "방수전문업체", "시공브이로그"]
          : platform === "tiktok"
          ? ["방수공사", "시공브이로그", "집수리", workType, "방수전문"]
          : ["방수공사", workType, "방수업체추천", ...(location ? [location + "방수공사"] : []), "시공후기", "방수전문", companyName || "SMS", "시공완료", "누수", "방수"],
        isMock: true,
      };

      return new Response(JSON.stringify(mockResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await anthropicResponse.json();
    const rawText = claudeData.content?.[0]?.text || "";

    // Parse JSON from response (handle markdown code blocks)
    let parsed;
    try {
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawText;
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse Claude response:", rawText);
      return new Response(JSON.stringify({ error: "AI 응답 파싱 실패", raw: rawText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-blog error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

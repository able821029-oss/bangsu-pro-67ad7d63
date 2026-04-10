import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const personaPrompts: Record<string, string> = {
  "장인형": `당신은 30년 경력의 시공 장인입니다. 묵직하고 신뢰감 있는 어조로 작성하세요.
"한 번 맡기면 10년이 다릅니다" 같은 장인 정신을 담은 표현을 사용하세요.
현장 경험에서 우러나오는 전문 지식과 꼼꼼한 시공 과정을 강조하세요.`,
  "친근형": `당신은 동네에서 인정받는 친근한 시공 전문가입니다.
이웃처럼 친근한 어조를 사용하세요. 어려운 전문 용어 대신 쉬운 표현을 사용하세요.`,
  "전문기업형": `당신은 체계적인 전문 시공 기업의 대표입니다.
기업다운 전문적 어조를 사용하세요. 공정별 상세 설명, 사용 자재 정보, 품질 보증 내용을 포함하세요.`,
};

const seoRules = `[네이버 SEO 글쓰기 필수 규칙]
① 제목: 25자 이내, 키워드 앞배치, {지역} {업종} {공사종류} 형식
② 본문: 반드시 1,500자 이상 (최적 1,800~2,000자)
③ 키워드: 메인 키워드 5~6회 자연 반복, 과도한 반복 금지
④ 본문 구조 (소제목 필수):
   [도입부-200자] 고객 공감 도입
   [현장 소개-300자] 위치, 건물, 의뢰 배경
   [시공 전 상태-300자] 문제점 상세, 전문 용어
   [시공 과정-500자] 단계별 작업, 재료명·공법명
   [시공 완료-200자] 마감 상태, 품질 보증
   [마무리-200자] 전문성 강조, 문의 유도
⑤ 전문성: 경력, 시공 건수, 자격증, A/S 보증 언급
⑥ AI 글 티 제거: "~합니다" 반복 금지, 구어체 활용
⑦ 해시태그: 지역+업종/업종단독/지역단독/시공종류/문제해결

[품질 체크 — 출력 전 자가 점검]
□ 제목 25자 이내? □ 지역명+업종 포함? □ 1,500자 이상?
□ 키워드 5회+? □ 소제목 구조? □ 시공 과정 구체적?
□ 해시태그 15개+? □ AI 글 티 없음?
모든 항목 통과 후 출력.`;

const platformFormats: Record<string, string> = {
  naver: `[네이버 블로그 출력]
- 1,800~2,000자 본문 (최소 1,500자)
- 제목 25자 이내, 키워드 앞배치
- 소제목 6단계 구조
- 해시태그 15~20개`,
  instagram: `[인스타그램 출력]
- 150자 이내 캡션, 이모지 활용
- 첫 줄: 후킹 문구
- 해시태그 20~30개`,
  tiktok: `[틱톡 출력]
- 3줄 자막: 훅/과정/결과+CTA
- 해시태그 5~10개`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    console.log("[generate-blog] ANTHROPIC_API_KEY present:", !!ANTHROPIC_API_KEY, "length:", ANTHROPIC_API_KEY?.length || 0, "starts:", ANTHROPIC_API_KEY?.slice(0, 10) || "NONE");

    const body = await req.json();
    const {
      photos,
      workType,
      persona,
      platform,
      location,
      buildingType,
      constructionDate,
      companyName,
      phoneNumber,
    } = body;

    // admin_config에서 커스텀 프롬프트 로드 (없으면 기본값 사용)
    let customPersonas = personaPrompts;
    let customPlatforms = platformFormats;
    try {
      const configRes = await fetch(
        `${SUPABASE_URL}/rest/v1/admin_config?key=in.("persona_prompts","platform_prompts")&select=key,value`,
        { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
      );
      if (configRes.ok) {
        const rows = await configRes.json();
        for (const r of rows) {
          if (r.key === "persona_prompts") customPersonas = { ...personaPrompts, ...r.value };
          if (r.key === "platform_prompts") customPlatforms = { ...platformFormats, ...r.value };
        }
      }
    } catch (e) {
      console.warn("admin_config 로드 실패 (기본값 사용):", e);
    }

    const personaText = customPersonas[persona] || customPersonas["장인형"];
    const platformText = customPlatforms[platform] || customPlatforms["naver"];

    const systemPrompt = `당신은 네이버 블로그 상위노출 전문가입니다.
현장직 사장님의 시공 현장 사진과 정보를 바탕으로
네이버 C-Rank + D.I.A+ 알고리즘에 최적화된 블로그 글을 작성합니다.

${personaText}

[업종 자동 판단 — 필수]
첨부된 사진을 분석하여 업종을 자동 판단하라.
(방수·토목·인테리어·간판·조경·철거·도장·타일·전기·설비 등)
사진에서 공사 유형도 구체적으로 판단하여 제목과 본문에 삽입하라.

${seoRules}

${platformText}

[응답 형식 — 반드시 JSON으로 응답]
{
  "title": "SEO 최적화 제목 (25자 이내, 키워드 앞배치)",
  "detectedWorkType": "AI가 판단한 공사 유형",
  "blocks": [
    {"type": "text", "content": "본문 텍스트"},
    {"type": "photo", "content": "photo-1", "caption": "사진 설명"},
    {"type": "text", "content": "본문 텍스트"},
    {"type": "photo", "content": "photo-2", "caption": "사진 설명"},
    {"type": "text", "content": "마무리 텍스트"}
  ],
  "hashtags": ["해시태그1", "해시태그2"],
  "seoScore": {
    "titleLength": 0,
    "contentLength": 0,
    "keywordCount": 0,
    "hashtagCount": 0,
    "hasStructure": true,
    "overall": 0
  }
}

규칙:
- blocks 배열에서 text와 photo를 교차 배치
- photo 블록의 content는 "photo-1", "photo-2" 등 순번
- photo 블록 수는 제공된 사진 수에 맞춤
- 업체명과 전화번호를 본문 마지막에 자연스럽게 삽입
- seoScore에 SEO 자가 점검 결과 포함
- JSON만 응답. 다른 텍스트 없이.`;

    const userContent: any[] = [];

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

- 시공 위치: ${location || "미입력"}
- 건물 유형: ${buildingType || "미입력"}
- 시공 일자: ${constructionDate || "오늘"}
- 업체명: ${companyName || "SMS"}
- 연락처: ${phoneNumber || ""}
- 첨부 사진: ${photoSlice.length}장

사진을 분석하여 업종과 공사 유형을 자동 판단한 뒤 글을 작성해주세요.
네이버 SEO 필수 규칙을 모두 준수하고, seoScore를 포함해주세요.
JSON 형식으로만 응답해주세요.`,
    });

    // API 키 없으면 바로 mock 응답
    if (!ANTHROPIC_API_KEY) {
      const detectedType = workType || "시공";
      const mockContent = `안녕하세요, ${companyName || "SMS"}입니다.\n\n${constructionDate || "오늘"} ${location || "현장"}에서 ${buildingType || "건물"} ${detectedType} 시공을 진행했습니다.\n\n■ 현장 소개\n${location || "현장"} ${buildingType || "건물"}에서 ${detectedType} 의뢰를 받았습니다. 기존 상태를 면밀히 조사한 결과, 전문적인 시공이 필요한 상황이었습니다.\n\n■ 시공 전 상태\n기존 시공 부분이 노후화되어 보수가 필요한 상태였습니다. 꼼꼼한 진단을 통해 최적의 시공 방법을 결정했습니다.\n\n■ 시공 과정\n${detectedType} 작업을 단계별로 꼼꼼하게 진행했습니다. 고품질 자재를 사용하여 내구성을 높였습니다.\n\n■ 시공 완료\n깔끔하게 마무리하였습니다. 시공 후 품질 검수까지 완료했습니다.\n\n■ 문의\n${companyName || "SMS"} ${phoneNumber || "전화문의"}`;
      const photoBlocks = photoSlice.flatMap((_: any, i: number) => [
        { type: "photo" as const, content: "photo-" + (i + 1), caption: detectedType + " 시공 현장 사진 " + (i + 1) },
        { type: "text" as const, content: i === photoSlice.length - 1 ? companyName + " 시공 완료. 문의: " + (phoneNumber || "") : detectedType + " 시공 " + (i + 1) + "단계 진행" },
      ]);
      return new Response(JSON.stringify({
        title: (location || "현장") + " " + detectedType + " 시공 완료",
        detectedWorkType: detectedType,
        blocks: [{ type: "text", content: mockContent }, ...photoBlocks],
        hashtags: [detectedType, "시공업체추천", (location || "") + "시공", "시공후기", companyName || "SMS", "시공완료", detectedType + "업체", detectedType + "전문", "시공현장", "건물시공", "누수해결", detectedType + "추천", "방수업체추천", "시공사례", "블로그마케팅"],
        seoScore: { titleLength: 15, contentLength: 800, keywordCount: 5, hashtagCount: 15, hasStructure: true, overall: 72 },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error("Claude API error:", anthropicResponse.status, errText);

      const detectedType = workType || "시공";
      const mockContent = `안녕하세요, ${companyName || "SMS"}입니다.\n\n${constructionDate || "오늘"} ${location || "현장"}에서 ${buildingType || "건물"} ${detectedType} 시공을 진행했습니다.\n\n■ 현장 소개\n${location || "현장"} ${buildingType || "건물"}에서 ${detectedType} 의뢰를 받았습니다.\n\n■ 시공 전 상태\n기존 방수층이 노후화되어 누수가 발생한 상태였습니다.\n\n■ 시공 과정\n${detectedType} 작업을 단계별로 꼼꼼하게 진행했습니다.\n\n■ 시공 완료\n깔끔하게 마무리하였습니다.\n\n■ 문의\n${companyName || "SMS"} ${phoneNumber || "전화문의"}`;

      const photoBlocks = photoSlice.flatMap((_: any, i: number) => [
        { type: "photo" as const, content: `photo-${i + 1}`, caption: `${detectedType} 시공 현장 사진 ${i + 1}` },
        { type: "text" as const, content: i === photoSlice.length - 1
          ? `${companyName || "SMS"}에서 ${location || "현장"} ${detectedType} 시공을 완료했습니다. 문의: ${phoneNumber || "전화문의"}`
          : `${detectedType} 시공 ${i + 1}단계를 진행했습니다.` },
      ]);

      const mockResponse = {
        title: `${location || "현장"} ${detectedType} 시공 완료`,
        detectedWorkType: detectedType,
        blocks: [
          { type: "text", content: mockContent },
          ...photoBlocks,
        ],
        hashtags: platform === "instagram"
          ? ["시공후기", detectedType, "인테리어", "집수리", "리모델링", "시공완료", ...(location ? [location.replace(/\s/g, ""), location + "시공"] : []), "SMS", "건물시공"]
          : platform === "tiktok"
          ? ["시공브이로그", "집수리", detectedType, "시공전문"]
          : [detectedType, "시공업체추천", ...(location ? [location + "시공", location + detectedType] : []), "시공후기", companyName || "SMS", "시공완료", detectedType + "업체", detectedType + "전문", "시공현장", "건물시공", "누수해결", detectedType + "추천", "방수업체추천", "시공사례"],
        seoScore: { titleLength: 15, contentLength: 500, keywordCount: 3, hashtagCount: 15, hasStructure: true, overall: 60 },
        isMock: true,
      };

      return new Response(JSON.stringify(mockResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await anthropicResponse.json();
    const rawText = claudeData.content?.[0]?.text || "";

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

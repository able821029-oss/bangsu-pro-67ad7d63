import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const personaPrompts: Record<string, string> = {
  "장인형": `당신은 30년 경력의 시공 장인입니다. 묵직하고 신뢰감 있는 어조로 작성하세요.
"한 번 맡기면 10년이 다릅니다" 같은 장인 정신을 담은 표현을 사용하세요.
현장 경험에서 우러나오는 전문 지식과 꼼꼼한 시공 과정을 강조하세요.

[플랫폼별 장인형 성향]
• 네이버 블로그: 호흡을 길게 가져가라. 현장 입문 시절 일화·실패담·학습 경험을 구체적으로 풀어 권위를 쌓아라. 전문 용어는 반드시 풀이를 덧붙여라.
• 인스타그램: 첫 줄은 "30년 현장에서 본 진짜" 류의 강한 한 문장. 감성 대신 밀도 있는 한 마디. 이모지 🔨 🛠️ 1~2개만.
• 틱톡: "이거 잘못하면 큰일납니다" 경각심 유발 훅. 현장 전문가만 아는 숨은 디테일 1가지. 단정형 ("이겁니다").`,

  "친근형": `당신은 동네에서 인정받는 친근한 시공 전문가입니다.
이웃처럼 친근한 어조를 사용하세요. 어려운 전문 용어 대신 쉬운 표현을 사용하세요.
"비 오면 걱정되시죠?" 같은 공감형 문장을 활용하세요.

[플랫폼별 친근형 성향]
• 네이버 블로그: 친구에게 설명하듯 구어체. "비 오는 날에 고객님이 전화를 주셨어요" 스토리텔링. 전문 용어는 괄호로 풀이. ~요, ~죠 적극 활용.
• 인스타그램: 이모지 풍부 (😊 💧 ✨). 친한 언니/오빠 톤. 줄바꿈 많이, 짧고 읽기 쉽게.
• 틱톡: "이거 아시나요?" 질문형 훅. 밝고 빠르게. "사장님들 이것만 기억하세요!" 친절한 팁 스타일.`,

  "전문기업형": `당신은 체계적인 전문 시공 기업의 대표입니다.
기업다운 전문적 어조를 사용하세요. 공정별 상세 설명, 사용 자재 정보, 품질 보증 내용을 포함하세요.

[플랫폼별 전문기업형 성향]
• 네이버 블로그: 공정표 형식. "1단계 → 2단계 → 3단계". 사용 자재 브랜드·규격·KS 인증 명시. A/S 보증 기간, 시공 건수, 자격증 수치 어필.
• 인스타그램: 브랜드 광고 카피 스타일. 세련된 한 줄 캐치프레이즈. 이모지 최소화 ✅ 🏗️.
• 틱톡: Before → After 자막, 공정 번호, 수치 기반 결과 ("누수율 0%", "품질 보증 10년"). 프로페셔널하되 빠른 템포.`,
};

const seoRules = `[네이버 SEO 글쓰기 필수 규칙]
① 제목: 반드시 10~25자. {지역} + {공사종류} + 차별화 문구를 포함 (예: "호원2동 외벽방수 10년 장인의 꼼꼼 시공"). 한 단어(예: "방수공사")만 절대 금지.
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
      siteArea,
      siteMethod,
      siteEtc,
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
시공 업체 사장님의 현장 사진과 현장 정보를 바탕으로
네이버 C-Rank + D.I.A+ 알고리즘에 최적화된 시공 블로그 글을 작성합니다.

${personaText}

[시공 공사 유형 판단 — 필수]
첨부된 사진을 분석하여 시공 공사 유형을 구체적으로 판단하라.
(옥상방수·외벽방수·지하방수·균열보수·욕실방수·도장·타일·인테리어·누수보수 등)
제목과 본문에 판단한 공사 유형을 자연스럽게 삽입하라.

${seoRules}

${platformText}

[응답 형식 — 반드시 JSON으로 응답]
{
  "title": "SEO 최적화 제목 (25자 이내, 키워드 앞배치)",
  "detectedWorkType": "AI가 판단한 공사 유형",
  "blocks": [
    {"type": "subtitle", "content": "현장 소개"},
    {"type": "text", "content": "도입부 본문 200자"},
    {"type": "photo", "content": "photo-1", "caption": "현장 전경"},
    {"type": "subtitle", "content": "시공 전 상태"},
    {"type": "text", "content": "문제점 300자"},
    {"type": "photo", "content": "photo-2", "caption": "시공 전 사진"},
    {"type": "subtitle", "content": "시공 과정"},
    {"type": "text", "content": "단계별 공정 500자"},
    {"type": "photo", "content": "photo-3", "caption": "시공 과정"},
    {"type": "subtitle", "content": "시공 완료"},
    {"type": "text", "content": "마감 상태 및 품질 보증"}
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

블록 구성 규칙 (시공 블로그 전용 포맷):
- 반드시 [subtitle → text → photo] 순서의 섹션을 반복 배치
- subtitle 블록은 섹션 제목 (예: "현장 소개", "시공 전 상태", "시공 과정", "시공 완료", "마무리")
- text 블록은 해당 섹션의 본문 (한 섹션당 200~500자)
- photo 블록의 content는 "photo-1", "photo-2" 등 순번. caption은 시공 단계 설명
- photo 블록 수는 제공된 사진 수에 맞춤 (사진이 부족하면 섹션에서 생략 가능)
- 현장 정보(위치·시공면적·공법·기타)는 "현장 소개" 섹션 본문에 자연스럽게 녹여 넣어라
- 업체명과 전화번호는 마지막 text 블록에 자연스럽게 포함
- seoScore에 SEO 자가 점검 결과 포함
- JSON만 응답. 다른 텍스트 없이.`;

    const userContent: any[] = [];

    // 사진은 첫 1장만 Claude에 전송 (타임아웃 방지)
    const photoSlice = (photos || []).slice(0, 5);
    if (photoSlice.length > 0) {
      const dataUrl = photoSlice[0].dataUrl || photoSlice[0];
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
      text: `다음 시공 현장 정보로 ${platform === "naver" ? "네이버 블로그" : platform === "instagram" ? "인스타그램" : "틱톡"} 글을 작성해주세요.

[현장 정보]
- 지역: ${location || "미입력"}
- 시공 면적: ${siteArea || "미입력"}
- 공법: ${siteMethod || "미입력"}
- 기타 특이사항: ${siteEtc || "없음"}
- 시공 일자: ${constructionDate || "오늘"}
- 업체명: ${companyName || "SMS"}
- 연락처: ${phoneNumber || ""}
- 첨부 사진: ${photoSlice.length}장

사진을 분석하여 시공 공사 유형을 판단한 뒤, 시공 블로그 포맷(제목 → 소제목+본문+사진 섹션 반복)으로 글을 작성해주세요.
네이버 SEO 필수 규칙을 모두 준수하고, seoScore를 포함해주세요.
blocks는 반드시 subtitle → text → photo 순서의 섹션으로 구성해주세요.
JSON 형식으로만 응답해주세요.`,
    });

    // API 키 없으면 바로 mock 응답 (시공 포맷 B)
    if (!ANTHROPIC_API_KEY) {
      const detectedType = workType || "시공";
      const area = siteArea || "미상";
      const method = siteMethod || "전문 공법";
      const etc = siteEtc || "";
      // 제목에 "시공"이 중복되지 않도록 detectedType에 이미 "시공"이 포함되면 "완료"만 덧붙임
      const titleSuffix = /시공/.test(detectedType) ? "완료" : "시공 완료";
      const mockBlocks: any[] = [
        { type: "subtitle", content: "현장 소개" },
        { type: "text", content: `${constructionDate || "오늘"} ${location || "현장"}에서 진행한 ${detectedType} 시공입니다. 시공 면적은 ${area}이며, ${method}으로 시공했습니다.${etc ? ` 특이사항: ${etc}.` : ""}` },
      ];
      photoSlice.forEach((_: any, i: number) => {
        const sections = ["시공 전 상태", "시공 과정", "시공 완료", "마무리"];
        const sectionTitle = sections[i] || `추가 사진 ${i + 1}`;
        mockBlocks.push(
          { type: "photo", content: `photo-${i + 1}`, caption: `${sectionTitle} — ${detectedType}` },
          { type: "subtitle", content: sectionTitle },
          { type: "text", content: `${sectionTitle} 단계에서 ${detectedType} 작업을 꼼꼼하게 진행했습니다.` },
        );
      });
      mockBlocks.push({ type: "text", content: `${companyName || "SMS"} 시공 완료. 문의: ${phoneNumber || "전화문의"}` });
      return new Response(JSON.stringify({
        title: `${location || "현장"} ${detectedType} ${titleSuffix}`,
        detectedWorkType: detectedType,
        blocks: mockBlocks,
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
        model: "claude-haiku-4-5-20251001",
        // 1800~2000자 한국어 블로그 + blocks/hashtags JSON은 약 2500~2800 토큰 → 3200 여유.
        max_tokens: 3200,
        // 시스템 프롬프트는 요청마다 동일 → prompt caching으로 입력 토큰 비용 ~90% 절감
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error("Claude API error:", anthropicResponse.status, errText);

      const detectedType = workType || "시공";
      const area = siteArea || "미상";
      const method = siteMethod || "전문 공법";
      const etc = siteEtc || "";
      const fallbackBlocks: any[] = [
        { type: "subtitle", content: "현장 소개" },
        { type: "text", content: `${constructionDate || "오늘"} ${location || "현장"}에서 진행한 ${detectedType} 시공입니다. 시공 면적은 ${area}이며, ${method}으로 시공했습니다.${etc ? ` 특이사항: ${etc}.` : ""}` },
      ];
      photoSlice.forEach((_: any, i: number) => {
        const sections = ["시공 전 상태", "시공 과정", "시공 완료", "마무리"];
        const sectionTitle = sections[i] || `추가 사진 ${i + 1}`;
        fallbackBlocks.push(
          { type: "photo", content: `photo-${i + 1}`, caption: `${sectionTitle} — ${detectedType}` },
          { type: "subtitle", content: sectionTitle },
          { type: "text", content: `${sectionTitle} 단계에서 ${detectedType} 작업을 꼼꼼하게 진행했습니다.` },
        );
      });
      fallbackBlocks.push({ type: "text", content: `${companyName || "SMS"}에서 ${location || "현장"} ${detectedType} 시공을 완료했습니다. 문의: ${phoneNumber || "전화문의"}` });

      const titleSuffix2 = /시공/.test(detectedType) ? "완료" : "시공 완료";
      const mockResponse = {
        title: `${location || "현장"} ${detectedType} ${titleSuffix2}`,
        detectedWorkType: detectedType,
        blocks: fallbackBlocks,
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
      return new Response(JSON.stringify({ error: "AI 응답 파싱 실패" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-blog error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

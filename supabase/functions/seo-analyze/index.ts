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
    const { mode, title, blocks, hashtags, location, workType, posts, companyName } = body;

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "seo_score") {
      // Single post SEO analysis
      const textContent = (blocks || [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.content)
        .join("\n");
      const photoCount = (blocks || []).filter((b: any) => b.type === "photo").length;
      const charCount = textContent.length;

      systemPrompt = `당신은 네이버 블로그 SEO 전문가입니다. C-Rank, D.I.A+ 알고리즘 기준으로 블로그 글을 분석합니다.
반드시 JSON으로만 응답하세요. 다른 텍스트 없이.`;

      userPrompt = `아래 블로그 글을 네이버 C-Rank, D.I.A+ 알고리즘 기준으로 분석해줘.

제목: ${title}
본문 (${charCount}자):
${textContent.slice(0, 2000)}

해시태그: ${(hashtags || []).join(", ")}
사진 수: ${photoCount}장
지역: ${location || "미입력"}
공사종류: ${workType || "미입력"}

분석 항목과 JSON 형식:
{
  "totalScore": 0~100 종합점수,
  "items": [
    {"name": "제목 최적화", "score": 0~100, "status": "good|warning|bad", "detail": "구체적 설명", "suggestion": "개선 방법"},
    {"name": "글 길이·구조", "score": 0~100, "status": "good|warning|bad", "detail": "현재 ${charCount}자", "suggestion": "개선 방법"},
    {"name": "키워드 최적화", "score": 0~100, "status": "good|warning|bad", "detail": "구체적 설명", "suggestion": "개선 방법"},
    {"name": "이미지 활용", "score": 0~100, "status": "good|warning|bad", "detail": "현재 ${photoCount}장", "suggestion": "개선 방법"},
    {"name": "지역명 포함", "score": 0~100, "status": "good|warning|bad", "detail": "구체적 설명", "suggestion": "개선 방법"},
    {"name": "전문성 표현", "score": 0~100, "status": "good|warning|bad", "detail": "구체적 설명", "suggestion": "개선 방법"},
    {"name": "해시태그", "score": 0~100, "status": "good|warning|bad", "detail": "현재 ${(hashtags || []).length}개", "suggestion": "개선 방법"}
  ],
  "checklist": [
    {"label": "체크항목 설명", "passed": true/false, "current": "현재값", "recommend": "권장값"}
  ],
  "overallAdvice": "종합 개선 조언 2~3문장"
}

기준:
- 제목: 25자 이내, 키워드가 앞쪽에 위치
- 글 길이: 1,500~2,000자 권장
- 키워드 밀도: 주요 키워드 5~6회
- 이미지: 6~13장 권장
- 해시태그: 5~10개 권장
- 지역명+업종+공사종류 조합 포함 여부`;

    } else if (mode === "blog_diagnosis") {
      // Overall blog diagnosis
      const postSummaries = (posts || []).slice(0, 20).map((p: any, i: number) => {
        const textLen = (p.blocks || []).filter((b: any) => b.type === "text").map((b: any) => b.content || "").join("").length;
        const photoLen = (p.blocks || []).filter((b: any) => b.type === "photo").length;
        return `${i + 1}. "${p.title}" (${p.createdAt}, ${textLen}자, 사진${photoLen}장, 해시태그${(p.hashtags || []).length}개)`;
      }).join("\n");

      systemPrompt = `당신은 네이버 블로그 SEO 전문 컨설턴트입니다. 블로그 전체를 종합 진단합니다.
반드시 JSON으로만 응답하세요.`;

      userPrompt = `아래 블로그의 전체 글 목록을 분석하여 종합 진단해줘.

업체명: ${companyName || "미입력"}
총 글 수: ${(posts || []).length}편

최근 글 목록:
${postSummaries || "글 없음"}

JSON 형식:
{
  "totalScore": 0~100,
  "categories": [
    {"name": "주제 전문성", "score": 0~100, "status": "good|warning|bad", "advice": "개선 조언"},
    {"name": "발행 꾸준함", "score": 0~100, "status": "good|warning|bad", "advice": "개선 조언"},
    {"name": "글 길이·구조", "score": 0~100, "status": "good|warning|bad", "advice": "개선 조언"},
    {"name": "키워드 최적화", "score": 0~100, "status": "good|warning|bad", "advice": "개선 조언"},
    {"name": "이미지 활용", "score": 0~100, "status": "good|warning|bad", "advice": "개선 조언"}
  ],
  "tips": ["팁1", "팁2", "팁3"],
  "overallAdvice": "종합 조언"
}`;

    } else if (mode === "keywords") {
      systemPrompt = `당신은 네이버 블로그 키워드 전문가입니다. 지역+업종 조합으로 최적의 키워드를 추천합니다.
반드시 JSON으로만 응답하세요.`;

      userPrompt = `지역: ${location || "서울"}
공사종류: ${workType || "방수공사"}
업체명: ${companyName || ""}

아래 JSON 형식으로 키워드를 추천해줘:
{
  "main": [{"keyword": "메인키워드", "competition": "high|medium|low"}],
  "target": [{"keyword": "공략키워드", "competition": "low", "reason": "추천 이유"}],
  "longtail": [{"keyword": "롱테일키워드", "competition": "low"}]
}

규칙:
- 메인 키워드: 경쟁 높은 핵심 키워드 2~3개
- 공략 키워드: 경쟁 낮지만 검색량 있는 키워드 3~5개
- 롱테일 키워드: 구체적이고 즉시 효과 가능한 키워드 3~5개
- 모든 키워드에 지역명 포함`;

    } else if (mode === "improve") {
      const textContent = (blocks || [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.content)
        .join("\n");

      systemPrompt = `당신은 네이버 블로그 SEO 최적화 전문가입니다. 기존 글을 SEO에 최적화되도록 개선합니다.
반드시 JSON으로만 응답하세요.`;

      userPrompt = `아래 글을 네이버 SEO에 최적화되도록 개선해줘.

제목: ${title}
본문: ${textContent.slice(0, 3000)}
해시태그: ${(hashtags || []).join(", ")}
지역: ${location || ""}
공사종류: ${workType || ""}

개선 사항:
1. 글 길이를 1,500자 이상으로 늘리기
2. 키워드를 자연스럽게 추가
3. 해시태그 보완 (5~10개)
4. 제목 최적화

JSON 형식:
{
  "title": "개선된 제목",
  "blocks": [{"type": "text", "content": "개선된 본문"}],
  "hashtags": ["개선된", "해시태그"],
  "changes": ["변경사항1", "변경사항2"]
}`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid mode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicResponse = ANTHROPIC_API_KEY ? await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // JSON 점수 분석 작업은 Haiku로도 충분. Sonnet 대비 속도 3~5배, 비용 ~1/15.
        model: "claude-haiku-4-5-20251001",
        // items 7개 + checklist 6개 + overallAdvice 포함 JSON이 약 1800 토큰이라 2200까지 여유.
        max_tokens: 2200,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userPrompt }],
      }),
    }) : null;

    if (!anthropicResponse || !anthropicResponse.ok) {
      const errText = anthropicResponse ? await anthropicResponse.text() : "API key not configured";
      console.error("Claude API error:", anthropicResponse?.status || 0, errText);

      // Fallback mock responses
      if (mode === "seo_score") {
        return new Response(JSON.stringify({
          totalScore: 72,
          items: [
            { name: "제목 최적화", score: 80, status: "good", detail: "키워드가 제목 앞에 위치", suggestion: "25자 이내로 유지하세요" },
            { name: "글 길이·구조", score: 55, status: "warning", detail: "현재 글이 짧습니다", suggestion: "1,500자 이상으로 늘리세요" },
            { name: "키워드 최적화", score: 75, status: "good", detail: "주요 키워드 적절히 포함", suggestion: "키워드를 5~6회 자연 삽입" },
            { name: "이미지 활용", score: 60, status: "warning", detail: "사진이 부족합니다", suggestion: "6~13장 권장" },
            { name: "지역명 포함", score: 85, status: "good", detail: "지역명이 포함됨", suggestion: "좋습니다" },
            { name: "전문성 표현", score: 70, status: "warning", detail: "시공 과정 설명 보완 필요", suggestion: "공정별 상세 설명 추가" },
            { name: "해시태그", score: 65, status: "warning", detail: "해시태그 수가 부족", suggestion: "5~10개 권장" },
          ],
          checklist: [
            { label: "제목 25자 이내", passed: true, current: `${(title || "").length}자`, recommend: "25자 이내" },
            { label: "본문 키워드 5회 이상", passed: false, current: "3회", recommend: "5~6회" },
            { label: "사진 6장 이상", passed: false, current: "3장", recommend: "6~13장" },
            { label: "해시태그 5개 이상", passed: (hashtags || []).length >= 5, current: `${(hashtags || []).length}개`, recommend: "5~10개" },
          ],
          overallAdvice: "글 길이를 1,500자 이상으로 늘리고, 사진을 추가하면 상위노출 가능성이 높아집니다.",
          isMock: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (mode === "blog_diagnosis") {
        return new Response(JSON.stringify({
          totalScore: 74,
          categories: [
            { name: "주제 전문성", score: 85, status: "good", advice: "방수 분야에 집중하고 있어 전문성이 높습니다" },
            { name: "발행 꾸준함", score: 60, status: "warning", advice: "주 2~3회 꾸준히 발행하세요" },
            { name: "글 길이·구조", score: 70, status: "warning", advice: "평균 글 길이를 1,500자 이상으로 늘리세요" },
            { name: "키워드 최적화", score: 80, status: "good", advice: "키워드 활용이 적절합니다" },
            { name: "이미지 활용", score: 65, status: "warning", advice: "글당 사진 6장 이상 첨부를 권장합니다" },
          ],
          tips: [
            "주 3회 이상 발행하면 C-Rank 점수가 올라갑니다",
            "같은 카테고리(방수)로 통일하면 전문성 점수 상승",
            "현장 사진을 6장 이상 포함하세요",
          ],
          overallAdvice: "발행 빈도를 높이고, 글당 사진 수를 늘리면 상위노출 가능성이 크게 향상됩니다.",
          isMock: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (mode === "keywords") {
        return new Response(JSON.stringify({
          main: [
            { keyword: `${location || "강남"} 방수공사`, competition: "high" },
            { keyword: `${location || "강남"} 방수업체`, competition: "high" },
          ],
          target: [
            { keyword: `${location || "강남구"} 아파트 옥상방수`, competition: "low", reason: "검색량 대비 경쟁 낮음" },
            { keyword: `${location || "강남구"} 방수공사 업체 추천`, competition: "low", reason: "추천 키워드로 전환율 높음" },
            { keyword: `${location || "강남"} 방수공사 견적`, competition: "medium", reason: "견적 문의 유도 가능" },
          ],
          longtail: [
            { keyword: `${location || "강남구"} 아파트 옥상방수 전문`, competition: "low" },
            { keyword: `${location || "강남"} 방수공사 견적 무료`, competition: "low" },
            { keyword: `${location || "강남구"} 외벽방수 시공 후기`, competition: "low" },
          ],
          isMock: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (mode === "improve") {
        return new Response(JSON.stringify({ error: "AI 서비스 일시 오류. 잠시 후 다시 시도해주세요." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const claudeData = await anthropicResponse.json();
    const rawText = claudeData.content?.[0]?.text || "";

    let parsed;
    try {
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawText;
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse response:", rawText);
      return new Response(JSON.stringify({ error: "AI 응답 파싱 실패", raw: rawText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seo-analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

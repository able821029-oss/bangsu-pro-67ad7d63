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
    const { photos, videoStyle, narrationType, location, buildingType, constructionDate, companyName, phoneNumber } = body;

    const styleGuide: Record<string, string> = {
      "시공일지형": "시공 전 → 시공 중 → 시공 후 순서로 텍스트 중심 장면을 구성합니다.",
      "홍보형": "완료된 시공을 강조하고, 업체 브랜딩과 연락처를 부각합니다.",
      "Before/After형": "시공 전후 비교를 중심으로 극적인 변화를 텍스트로 보여줍니다.",
    };

    const animations = ["slide_up", "slide_left", "zoom_in", "fade_in"];

    const systemPrompt = `당신은 mirra.my 스타일의 쇼츠 영상 스크립트 작성 전문가입니다.
텍스트 애니메이션 중심의 세련된 영상을 만듭니다.
${styleGuide[videoStyle] || styleGuide["시공일지형"]}

[응답 형식 — 반드시 JSON으로]
{
  "scenes": [
    {
      "duration": 90,
      "bg_type": "gradient",
      "bg_colors": ["#0a1628", "#1a3a6a"],
      "badge": "배지 텍스트",
      "title": "메인 타이틀",
      "subtitle": "서브타이틀 (타이핑 효과)",
      "accent_color": "#237FFF",
      "animation": "slide_up",
      "photo": null,
      "narration": "나레이션 텍스트"
    }
  ]
}

장면 구성 규칙:
1. 인트로 장면: 지역명 + 공사종류 강조. badge에 지역명, title에 공사종류, bg_type: "gradient", photo: null
2. 사진 장면 1~N: 현장 사진이 있으면 photo에 "photo_1", "photo_2" 등. bg_type: "photo". 사진 위에 텍스트 오버레이.
3. 하이라이트 장면: 시공 완료 강조. bg_type: "gradient", accent_color를 밝게.
4. 엔딩 장면: 업체명이 title, 전화번호가 subtitle. badge: "시공 문의". bg_type: "gradient", bg_colors: ["#001130", "#0a2a5a"]

animation 종류: "slide_up", "slide_left", "zoom_in", "fade_in" — 장면마다 다르게 교차 사용.
duration: 프레임 수 (25fps 기준). 최소 75(3초), 최대 125(5초). 보통 90~100.
bg_colors: 항상 2색 배열. 다크 네이비 계열 (#001130, #0a1628, #1a3a6a, #0d2847 등)
accent_color: "#237FFF" 또는 "#AB5EBE" 교차 사용.
narration: ${narrationType === "없음" ? "빈 문자열로" : "한국어 나레이션 텍스트 작성"}
총 장면 수: 사진 수 + 2~3개 (인트로, 하이라이트, 엔딩)
JSON만 응답. 마크다운 코드 블록 금지.`;

    let result;

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
        text: `위치: ${location || "미입력"}, 건물: ${buildingType || "미입력"}, 일자: ${constructionDate || "오늘"}, 업체명: ${companyName || "SMS"}, 연락처: ${phoneNumber || ""}, 사진 ${photoSlice.length}장, 영상 스타일: ${videoStyle}. 사진을 분석하여 업종·공종을 자동 판단하고 JSON으로 응답.`,
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
            max_tokens: 2048,
            system: systemPrompt,
            messages: [{ role: "user", content: userContent }],
          }),
        });

        if (anthropicRes.ok) {
          const claudeData = await anthropicRes.json();
          const rawText = claudeData.content?.[0]?.text || "";
          const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/\{[\s\S]*\}/);
          result = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawText);
        } else {
          const errText = await anthropicRes.text();
          console.error("Claude API error:", anthropicRes.status, errText);
        }
      } catch (e) {
        console.error("Claude API error for shorts script:", e);
      }
    }

    // Fallback mock
    if (!result) {
      const photoCount = (photos || []).length;
      const mockScenes = [];

      // Intro
      mockScenes.push({
        duration: 90, bg_type: "gradient", bg_colors: ["#0a1628", "#1a3a6a"],
        badge: location || "현장 시공", title: "시공 현장 리포트",
        subtitle: "전문 시공 과정을 확인하세요", accent_color: "#237FFF",
        animation: "slide_up", photo: null, narration: `${location || "현장"} 시공 과정을 소개합니다.`,
      });

      // Photo scenes
      for (let i = 0; i < photoCount; i++) {
        mockScenes.push({
          duration: 100, bg_type: "photo", bg_colors: ["#001130", "#0d2847"],
          badge: `${i + 1}단계`,
          title: i === 0 ? "시공 전 현장 점검" : i === photoCount - 1 ? "시공 완료" : `시공 진행 ${i + 1}단계`,
          subtitle: i === 0 ? "현장 상태를 꼼꼼히 확인합니다" : i === photoCount - 1 ? "깔끔하게 마무리했습니다" : "전문 장비로 시공 진행",
          accent_color: i % 2 === 0 ? "#237FFF" : "#AB5EBE",
          animation: animations[i % 4],
          photo: `photo_${i + 1}`,
          narration: i === 0 ? "먼저 현장 상태를 점검합니다." : i === photoCount - 1 ? "시공이 깔끔하게 완료되었습니다." : `${i + 1}단계 시공을 진행합니다.`,
        });
      }

      // Highlight
      mockScenes.push({
        duration: 90, bg_type: "gradient", bg_colors: ["#0d2847", "#1a3a6a"],
        badge: "시공 완료", title: "완벽한 마감",
        subtitle: "누수 걱정 없는 시공", accent_color: "#AB5EBE",
        animation: "zoom_in", photo: null, narration: "완벽한 마감으로 누수 걱정을 해결했습니다.",
      });

      // Ending
      mockScenes.push({
        duration: 100, bg_type: "gradient", bg_colors: ["#001130", "#0a2a5a"],
        badge: "시공 문의", title: companyName || "SMS",
        subtitle: phoneNumber || "연락처", accent_color: "#237FFF",
        animation: "fade_in", photo: null, narration: `${companyName || "SMS"}에 문의해 주세요.`,
      });

      result = { scenes: mockScenes, isMock: true };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-shorts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "다시 시도해 주세요" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

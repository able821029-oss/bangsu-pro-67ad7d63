import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── ElevenLabs TTS 호출 ──
async function generateNarration(
  text: string,
  apiKey: string,
  voiceId: string,
): Promise<string | null> {
  if (!text || !apiKey) return null;
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
        }),
      }
    );
    if (!res.ok) {
      console.error("ElevenLabs error:", res.status, await res.text());
      return null;
    }
    const audioBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(audioBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch (e) {
    console.error("ElevenLabs TTS error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    // ElevenLabs 인기 한국어 지원 음성 매핑
    const VOICE_MAP: Record<string, string> = {
      "male_calm": "ErXwobaYiN019PkySvjV",      // Antoni — 차분한 남성
      "male_pro": "VR6AewLTigWG4xSOukaG",       // Arnold — 전문적 남성
      "male_strong": "pNInz6obpgDQGcFmaJgB",    // Adam — 힘있는 남성
      "female_friendly": "EXAVITQu4vr4xnSDxMaL", // Bella — 친근한 여성
      "female_pro": "21m00Tcm4TlvDq8ikWAM",     // Rachel — 전문적 여성
      "female_bright": "AZnzlk1XvdvUeBnXmlld",  // Domi — 밝은 여성
    };
    const ELEVENLABS_VOICE_ID = Deno.env.get("ELEVENLABS_VOICE_ID") || "pNInz6obpgDQGcFmaJgB";

    const body = await req.json();
    const { photos, videoStyle, narrationType, location, buildingType, constructionDate, companyName, phoneNumber, voiceId: requestedVoiceId } = body;
    // voiceId를 요청에서 받거나 기본 VOICE_MAP에서 매핑
    const resolvedVoiceId = VOICE_MAP[requestedVoiceId || ""] || requestedVoiceId || ELEVENLABS_VOICE_ID;

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
duration: 프레임 수 (30fps 기준). 최소 90(3초), 최대 150(5초). 보통 100~120.
bg_colors: 항상 2색 배열. 다크 네이비 계열 (#001130, #0a1628, #1a3a6a, #0d2847 등)
accent_color: "#237FFF" 또는 "#AB5EBE" 교차 사용.
narration: ${narrationType === "없음" ? "빈 문자열로" : "20자 이내 짧고 임팩트 있는 한국어 나레이션"}
총 장면 수: 사진 수 + 2~3개 (인트로, 하이라이트, 엔딩)
JSON만 응답. 마크다운 코드 블록 금지.`;

    let result: any;

    // ── Step 1: Claude로 장면 스크립트 생성 ──
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
          console.error("Claude API error:", anthropicRes.status, await anthropicRes.text());
        }
      } catch (e) {
        console.error("Claude API error:", e);
      }
    }

    // ── Fallback mock ──
    if (!result) {
      const photoCount = (photos || []).length;
      const mockScenes: any[] = [];
      mockScenes.push({
        duration: 100, bg_type: "gradient", bg_colors: ["#0a1628", "#1a3a6a"],
        badge: location || "현장 시공", title: "시공 현장 리포트",
        subtitle: "전문 시공 과정을 확인하세요", accent_color: "#237FFF",
        animation: "slide_up", photo: null, narration: `${location || "현장"} 시공 과정을 소개합니다.`,
      });
      for (let i = 0; i < photoCount; i++) {
        mockScenes.push({
          duration: 120, bg_type: "photo", bg_colors: ["#001130", "#0d2847"],
          badge: `${i + 1}단계`,
          title: i === 0 ? "시공 전 현장 점검" : i === photoCount - 1 ? "시공 완료" : `시공 진행 ${i + 1}단계`,
          subtitle: i === 0 ? "현장 상태를 꼼꼼히 확인합니다" : i === photoCount - 1 ? "깔끔하게 마무리했습니다" : "전문 장비로 시공 진행",
          accent_color: i % 2 === 0 ? "#237FFF" : "#AB5EBE",
          animation: animations[i % 4],
          photo: `photo_${i + 1}`,
          narration: i === 0 ? "현장 상태를 점검합니다." : i === photoCount - 1 ? "완벽하게 완료되었습니다." : `${i + 1}단계 시공입니다.`,
        });
      }
      mockScenes.push({
        duration: 100, bg_type: "gradient", bg_colors: ["#0d2847", "#1a3a6a"],
        badge: "시공 완료", title: "완벽한 마감",
        subtitle: "누수 걱정 없는 시공", accent_color: "#AB5EBE",
        animation: "zoom_in", photo: null, narration: "완벽한 마감으로 해결했습니다.",
      });
      mockScenes.push({
        duration: 120, bg_type: "gradient", bg_colors: ["#001130", "#0a2a5a"],
        badge: "시공 문의", title: companyName || "SMS",
        subtitle: phoneNumber || "연락처", accent_color: "#237FFF",
        animation: "fade_in", photo: null, narration: `${companyName || "SMS"}에 문의하세요.`,
      });
      result = { scenes: mockScenes, isMock: true };
    }

    // ── Step 2: ElevenLabs로 나레이션 음성 생성 ──
    const scenes: any[] = result.scenes || [];
    const narrationAudios: (string | null)[] = [];

    if (ELEVENLABS_API_KEY && narrationType !== "없음") {
      console.log(`ElevenLabs TTS 시작 — ${scenes.length}개 장면`);
      for (const scene of scenes) {
        const text = scene.narration || "";
        if (text) {
          const audio = await generateNarration(text, ELEVENLABS_API_KEY, resolvedVoiceId);
          narrationAudios.push(audio);
        } else {
          narrationAudios.push(null);
        }
      }
      console.log(`ElevenLabs TTS 완료 — 성공: ${narrationAudios.filter(Boolean).length}개`);
    } else {
      scenes.forEach(() => narrationAudios.push(null));
      if (!ELEVENLABS_API_KEY) console.warn("ELEVENLABS_API_KEY 미설정 — 음성 없이 진행");
    }

    return new Response(
      JSON.stringify({ ...result, narrationAudios }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("generate-shorts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "다시 시도해 주세요" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

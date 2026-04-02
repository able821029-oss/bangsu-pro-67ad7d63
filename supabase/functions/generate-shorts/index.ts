import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const SHOTSTACK_API_KEY = Deno.env.get("SHOTSTACK_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!SHOTSTACK_API_KEY) {
      return new Response(JSON.stringify({ error: "SHOTSTACK_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      action, // "generate-script" | "render" | "check-status"
      photos,
      workType,
      videoStyle,
      narrationType,
      location,
      buildingType,
      constructionDate,
      companyName,
      phoneNumber,
      script, // for render action
      renderId, // for check-status action
      videoId, // DB video id
    } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ──────────────── ACTION: generate-script ────────────────
    if (action === "generate-script") {
      const styleGuide: Record<string, string> = {
        "시공일지형": "시공 전 → 시공 중 → 시공 후 순서로 장면을 구성합니다. 각 단계의 작업 내용을 자막으로 설명합니다.",
        "홍보형": "완료된 시공 사진을 강조하고, 업체 정보와 연락처를 부각합니다.",
        "Before/After형": "시공 전후 비교를 중심으로 극적인 변화를 보여줍니다.",
      };

      const systemPrompt = `당신은 방수공사 쇼츠 영상 스크립트 작성 전문가입니다.
${styleGuide[videoStyle] || styleGuide["시공일지형"]}

[응답 형식 — 반드시 JSON으로]
{
  "scenes": [
    {"photo_id": 1, "duration": 4, "caption_top": "상단자막", "caption_bottom": "하단자막", "effect": "zoomin"},
    ...
  ],
  "narration": "전체 나레이션 텍스트 (${narrationType === "없음" ? "빈 문자열로" : "자연스러운 한국어로"})",
  "bgm": "upbeat"
}

규칙:
- scenes 배열은 제공된 사진 수 + 1 (마지막은 엔딩 카드, photo_id: null)
- 각 장면 duration: 3~5초
- effect: "zoomin" 또는 "zoomout" 교차 사용
- 마지막 엔딩 카드: caption_top은 "SMS 셀프마케팅서비스", caption_bottom은 업체명+전화번호
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
            photo_id: i + 1,
            duration: 4,
            caption_top: i === 0 ? `${location || "현장"} ${buildingType || "건물"}` : `${workType} 시공 ${i + 1}단계`,
            caption_bottom: i === 0 ? "시공 전 상태" : i === photoCount - 1 ? "시공 완료" : "작업 진행 중",
            effect: i % 2 === 0 ? "zoomin" : "zoomout",
          });
        }
        mockScenes.push({
          photo_id: null,
          duration: 4,
          caption_top: "SMS 셀프마케팅서비스",
          caption_bottom: `${companyName || "SMS"} | ${phoneNumber || ""}`,
          effect: "fadein",
        });
        scenes = {
          scenes: mockScenes,
          narration: narrationType === "없음" ? "" : `${location || "현장"} ${workType} 시공 완료 현장입니다.`,
          bgm: "upbeat",
          isMock: true,
        };
      }

      return new Response(JSON.stringify(scenes), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────── ACTION: render ────────────────
    if (action === "render") {
      const scenesData = script?.scenes || [];

      // Build Shotstack timeline
      const tracks: any[] = [];
      let offset = 0;

      // Photo clips track
      const photoClips: any[] = [];
      const captionClips: any[] = [];

      for (const scene of scenesData) {
        const dur = scene.duration || 4;

        if (scene.photo_id !== null && photos && photos[scene.photo_id - 1]) {
          // Photo clip with Ken Burns effect
          const photoData = photos[scene.photo_id - 1];
          photoClips.push({
            asset: {
              type: "image",
              src: photoData.dataUrl,
            },
            start: offset,
            length: dur,
            effect: scene.effect === "zoomout" ? "zoomOut" : "zoomIn",
            fit: "cover",
          });
        } else {
          // Ending card — solid color background
          photoClips.push({
            asset: {
              type: "html",
              html: `<div style="width:1080px;height:1920px;background:#1A2B4A;display:flex;align-items:center;justify-content:center;"></div>`,
              width: 1080,
              height: 1920,
            },
            start: offset,
            length: dur,
          });
        }

        // Top caption
        if (scene.caption_top) {
          captionClips.push({
            asset: {
              type: "html",
              html: `<div style="font-family:'NanumGothic',sans-serif;color:white;font-size:48px;font-weight:bold;text-align:center;background:rgba(0,0,0,0.6);padding:16px 32px;border-radius:12px;">${scene.caption_top}</div>`,
              width: 900,
              height: 120,
            },
            start: offset,
            length: dur,
            position: "top",
            offset: { y: 0.1 },
            transition: { in: "fade", out: "fade" },
          });
        }

        // Bottom caption
        if (scene.caption_bottom) {
          captionClips.push({
            asset: {
              type: "html",
              html: `<div style="font-family:'NanumGothic',sans-serif;color:white;font-size:36px;text-align:center;background:rgba(0,0,0,0.6);padding:12px 24px;border-radius:12px;">${scene.caption_bottom}</div>`,
              width: 900,
              height: 100,
            },
            start: offset,
            length: dur,
            position: "bottom",
            offset: { y: -0.1 },
            transition: { in: "fade", out: "fade" },
          });
        }

        offset += dur;
      }

      tracks.push({ clips: captionClips });
      tracks.push({ clips: photoClips });

      const timeline = {
        tracks,
        soundtrack: {
          src: "https://shotstack-assets.s3.ap-southeast-2.amazonaws.com/music/upbeat.mp3",
          effect: "fadeOut",
        },
      };

      const renderPayload = {
        timeline,
        output: {
          format: "mp4",
          resolution: "1080",
          aspectRatio: "9:16",
          size: { width: 1080, height: 1920 },
        },
      };

      // Use Shotstack sandbox API for testing, production for live
      const shotstackUrl = "https://api.shotstack.io/stage/render";

      const renderRes = await fetch(shotstackUrl, {
        method: "POST",
        headers: {
          "x-api-key": SHOTSTACK_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(renderPayload),
      });

      const renderData = await renderRes.json();

      if (!renderRes.ok) {
        console.error("Shotstack render error:", renderData);
        // Update video status to failed
        if (videoId) {
          await supabase.from("videos").update({ status: "실패" }).eq("id", videoId);
        }
        return new Response(JSON.stringify({ error: "영상 렌더링 요청 실패", detail: renderData }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const shotRdId = renderData.response?.id;

      // Update DB with render ID
      if (videoId && shotRdId) {
        await supabase.from("videos").update({
          shotstack_render_id: shotRdId,
          status: "렌더링중",
        }).eq("id", videoId);
      }

      return new Response(JSON.stringify({ renderId: shotRdId, status: "렌더링중" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────── ACTION: check-status ────────────────
    if (action === "check-status") {
      if (!renderId) {
        return new Response(JSON.stringify({ error: "renderId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const statusRes = await fetch(`https://api.shotstack.io/stage/render/${renderId}`, {
        headers: { "x-api-key": SHOTSTACK_API_KEY },
      });

      const statusData = await statusRes.json();
      const renderStatus = statusData.response?.status;
      const videoUrl = statusData.response?.url;

      if (renderStatus === "done" && videoUrl && videoId) {
        await supabase.from("videos").update({
          status: "완료",
          video_url: videoUrl,
        }).eq("id", videoId);
      } else if (renderStatus === "failed" && videoId) {
        await supabase.from("videos").update({ status: "실패" }).eq("id", videoId);
      }

      return new Response(JSON.stringify({
        status: renderStatus === "done" ? "완료" : renderStatus === "failed" ? "실패" : "렌더링중",
        videoUrl: videoUrl || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-shorts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

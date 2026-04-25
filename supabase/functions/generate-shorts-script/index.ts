// 자막(스크립트) 사전 생성 전용 Edge Function — 2026-04-25
//
// 워크플로우:
//   1) 클라이언트가 사진 + 작업 주제로 호출
//   2) Claude/Gemini 가 짧은 자막·나레이션 scenes 만 생성
//   3) 클라이언트가 결과를 사용자에게 보여주고 인라인 편집
//   4) 사용자 승인 후 generate-shorts 에 수정된 scenes 와 함께 호출 → 영상 렌더
//
// 분리한 이유:
//   - 영상 한 편 만들 때마다 ElevenLabs MP3 + Storage 업로드 + Shotstack 렌더가 약 1~2분 걸린다.
//   - 자막이 마음에 안 들면 그 비용을 다시 지불해야 함.
//   - 자막만 먼저 5~10초에 보여주면 사용자가 안전하게 편집한 뒤 영상 비용 한 번만 발생.
//
// 비용·한도:
//   - 이 함수는 LLM 토큰만 소비하고 ElevenLabs / Shotstack 분량은 사용 안 함.
//   - usage_logs 의 fn_name=generate-shorts-script 로 별도 카운트.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withGuard, CORS_HEADERS, logUsage } from "../_shared/guard.ts";

const corsHeaders = CORS_HEADERS;

interface SceneSpec {
  title: string;
  subtitle?: string;
  narration: string;
  photo_index: number;
}

function buildSystemPrompt(videoStyle: string, narrationType: string): string {
  const styleGuide: Record<string, string> = {
    시공일지형: "진행 과정 순서(준비/작업/완료)로 텍스트 중심 장면을 구성합니다.",
    홍보형: "완성된 결과물을 강조하고, 업체 브랜딩과 연락처를 부각합니다.",
    "Before/After형":
      "작업 전후 비교를 중심으로 극적인 변화를 텍스트로 보여줍니다.",
    일지형: "작업 진행 과정 순서로 텍스트 중심 장면을 구성합니다.",
  };

  return `당신은 mirra.my 스타일의 쇼츠 영상 스크립트 작성 전문가입니다.

[매우 중요 — 업종 자동 판별]
사진을 면밀히 관찰해 업종을 판별한 뒤 그 업종에 맞는 용어와 톤으로 작성하세요.
사진과 힌트가 모순되면 힌트(workTopic, businessLabel)를 우선합니다.

${styleGuide[videoStyle] || styleGuide["일지형"]}

[응답 형식 — JSON 만]
{
  "scenes": [
    {
      "title": "메인 타이틀 (씬 자막용 짧은 한국어, 20자 이내)",
      "subtitle": "보조 텍스트 (선택)",
      "narration": "${narrationType === "없음" ? "빈 문자열" : "20자 이내 짧고 임팩트 있는 한국어"}",
      "photo_index": 1
    }
  ]
}

장면 구성 규칙:
- 인트로 1개 (photo_index=1, 후킹 메시지)
- 사진 장면 N개 (photo_index = 사진 번호 1..N)
- 엔딩 1개 (photo_index = N, 업체명 + 연락처)
총 장면 수 = 사진 수 + 1~2 정도. 각 장면 자막은 짧고 명료.
JSON만 응답. 마크다운 코드 블록 금지.`;
}

function safeParseScenes(raw: string): SceneSpec[] | null {
  if (!raw) return null;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m =
      raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      parsed = JSON.parse(m[1] || m[0]);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const scenes = (parsed as { scenes?: unknown }).scenes;
  if (!Array.isArray(scenes)) return null;
  const out: SceneSpec[] = [];
  scenes.forEach((s, i) => {
    if (!s || typeof s !== "object") return;
    const obj = s as Record<string, unknown>;
    out.push({
      title: typeof obj.title === "string" ? obj.title : "",
      subtitle: typeof obj.subtitle === "string" ? obj.subtitle : undefined,
      narration: typeof obj.narration === "string" ? obj.narration : "",
      photo_index:
        typeof obj.photo_index === "number" && obj.photo_index > 0
          ? Math.floor(obj.photo_index)
          : i + 1,
    });
  });
  return out.length ? out : null;
}

// 60초당 10회 — 사용자가 자막을 여러 번 재생성할 수 있게 generate-shorts 보다 후함.
serve(
  withGuard(
    { fn: "generate-shorts-script", limit: 10, windowSec: 60 },
    async (req, ctx) => {
      try {
        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

        const body = await req.json();
        const {
          photos,
          videoStyle,
          narrationType,
          location,
          companyName,
          phoneNumber,
          scriptMode,
          manualScript,
          businessCategory,
          workTopic,
        } = body;

        const photoSlice = (photos || []).slice(0, 6);
        if (photoSlice.length === 0) {
          return new Response(
            JSON.stringify({ error: "사진이 1장 이상 필요합니다." }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const systemPrompt = buildSystemPrompt(
          videoStyle || "일지형",
          narrationType || "있음",
        );
        const businessLabel = businessCategory ? String(businessCategory) : "";
        const hint = [
          businessLabel
            ? `업종: ${businessLabel}`
            : "업종: 사진으로 자동 판별",
          workTopic ? `오늘의 작업: "${workTopic}"` : "",
          `업체명: ${companyName || ""}`,
          `연락처: ${phoneNumber || ""}`,
          `활동 지역: ${location || "미입력"}`,
          `사진 수: ${photoSlice.length}장`,
        ]
          .filter(Boolean)
          .join("\n");

        let scenes: SceneSpec[] | null = null;
        let source: "manual" | "gemini" | "claude" | "mock" = "mock";

        // 직접 작성 대본 우선
        if (scriptMode === "manual" && manualScript) {
          const lines = String(manualScript)
            .split("\n")
            .map((l: string) => l.trim())
            .filter(Boolean);
          scenes = lines.map((line: string, i: number) => ({
            title: line.slice(0, 30),
            narration: line.slice(0, 60),
            photo_index: Math.min(i + 1, photoSlice.length),
          }));
          source = "manual";
        }

        // Gemini
        if (!scenes && GEMINI_API_KEY) {
          const parts: unknown[] = [];
          for (const photo of photoSlice) {
            const dataUrl: string = photo.dataUrl || photo;
            const m = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
            if (m) {
              parts.push({
                inline_data: { mime_type: `image/${m[1]}`, data: m[2] },
              });
            }
          }
          parts.push({
            text: `[힌트]\n${hint}\n\n위 힌트를 우선 반영해 JSON 으로만 답하세요.`,
          });
          try {
            const r = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  systemInstruction: { parts: [{ text: systemPrompt }] },
                  contents: [{ role: "user", parts }],
                  generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 1500,
                    responseMimeType: "application/json",
                  },
                }),
              },
            );
            if (r.ok) {
              const j = await r.json();
              const txt =
                j?.candidates?.[0]?.content?.parts?.[0]?.text || "";
              const parsed = safeParseScenes(txt);
              if (parsed) {
                scenes = parsed;
                source = "gemini";
              }
            } else {
              console.error("Gemini error:", r.status, await r.text());
            }
          } catch (e) {
            console.error("Gemini exception:", e);
          }
        }

        // Claude 폴백
        if (!scenes && ANTHROPIC_API_KEY) {
          const userContent: unknown[] = [];
          for (const photo of photoSlice) {
            const dataUrl: string = photo.dataUrl || photo;
            const m = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
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
          userContent.push({
            type: "text",
            text: `[힌트]\n${hint}\n\n위 힌트를 우선 반영해 JSON 으로만 답하세요.`,
          });
          try {
            const r = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "content-type": "application/json",
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 1500,
                system: [
                  {
                    type: "text",
                    text: systemPrompt,
                    cache_control: { type: "ephemeral" },
                  },
                ],
                messages: [{ role: "user", content: userContent }],
              }),
            });
            if (r.ok) {
              const j = await r.json();
              const txt = j?.content?.[0]?.text || "";
              const parsed = safeParseScenes(txt);
              if (parsed) {
                scenes = parsed;
                source = "claude";
              }
            } else {
              console.error("Claude error:", r.status, await r.text());
            }
          } catch (e) {
            console.error("Claude exception:", e);
          }
        }

        // 최후 폴백 — 사진 수에 맞춘 mock
        if (!scenes || scenes.length === 0) {
          scenes = photoSlice.map((_p: unknown, i: number) => ({
            title: i === 0 ? workTopic || "오늘의 작업" : `장면 ${i + 1}`,
            narration:
              i === 0
                ? `${companyName || "우리 가게"}의 ${workTopic || "작업"} 입니다.`
                : "정성껏 진행 중입니다.",
            photo_index: i + 1,
          }));
          source = "mock";
        }

        // 사진 수와 정합 — 부족하면 마지막 사진으로 패딩, 넘치면 자른다
        const photoCount = photoSlice.length;
        if (scenes.length > photoCount) {
          scenes = scenes.slice(0, photoCount);
        }
        while (scenes.length < photoCount) {
          scenes.push({
            title: "",
            narration: "",
            photo_index: scenes.length + 1,
          });
        }

        void logUsage({
          user_id: ctx.userId,
          fn_name: "generate-shorts-script",
          status: "ok",
          origin: ctx.origin,
          extra: {
            sceneCount: scenes.length,
            photoCount,
            source,
            videoStyle,
            narrationType,
            scriptMode: scriptMode || "ai",
          },
        });

        return new Response(
          JSON.stringify({
            scenes,
            source,
            sceneCount: scenes.length,
            photoCount,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (e) {
        console.error("generate-shorts-script error:", e);
        void logUsage({
          user_id: ctx.userId,
          fn_name: "generate-shorts-script",
          status: "error",
          origin: ctx.origin,
          extra: { message: e instanceof Error ? e.message : "unknown" },
        });
        return new Response(
          JSON.stringify({
            error: e instanceof Error ? e.message : "다시 시도해 주세요",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    },
  ),
);

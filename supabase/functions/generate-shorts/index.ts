import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withGuard, CORS_HEADERS, logUsage } from "../_shared/guard.ts";
import { checkMonthlyLimit } from "../_shared/usageGuard.ts";
import {
  base64ToBytes,
  uploadDataUrl,
  uploadPublicAsset,
} from "../_shared/storageUpload.ts";

const corsHeaders = CORS_HEADERS;

// ── Shotstack 엔드포인트 ─────────────────────────────────────────
// Shotstack 정식 호스트:
//   - Production (결제 후): https://api.shotstack.io/edit/v1
//   - Stage / Sandbox (무료): https://api.shotstack.io/edit/stage
// 무료 가입 직후엔 stage 키만 발급되므로 default 를 stage 로 둔다.
// 결제 후 prod 키로 전환하면 Supabase Secrets 에
// `SHOTSTACK_HOST=https://api.shotstack.io/edit/v1` 추가하면 끝.
const SHOTSTACK_HOST_DEFAULT = "https://api.shotstack.io/edit/stage";

// ── 영상 구성 상수 ───────────────────────────────────────────────
const PHOTO_SECONDS = 5;       // 사진 한 장당 노출 시간
const ENDING_SECONDS = 1;      // 마지막 엔딩 카드
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;

// 음성 ID 매핑 (기존과 동일)
const VOICE_MAP: Record<string, string> = {
  male_calm: "nPczCjzI2devNBz1zQrb",
  male_pro: "N2lVS1w4EtoT3dr4eOWO",
  male_strong: "TX3LPaxmHKxFdv7VOQHJ",
  female_friendly: "EXAVITQu4vr4xnSDxMaL",
  female_pro: "XrExE9yKIg1WjnnlVkGX",
  female_bright: "pFZP5JQG7iQjIQuC4Bku",
};

// ── ElevenLabs TTS (기존 로직 유지) ──────────────────────────────
async function generateNarrationBytes(
  text: string,
  apiKey: string,
  voiceId: string,
): Promise<Uint8Array | null> {
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
          model_id: "eleven_flash_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.4,
            use_speaker_boost: true,
            speed: 0.8,
          },
        }),
      },
    );
    if (!res.ok) {
      console.error("ElevenLabs error:", res.status, await res.text());
      return null;
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    console.error("ElevenLabs TTS error:", e);
    return null;
  }
}

async function generateNarrationBytesWithRetry(
  text: string,
  apiKey: string,
  voiceId: string,
  maxRetries = 2,
): Promise<Uint8Array | null> {
  if (!text || !apiKey) return null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const bytes = await generateNarrationBytes(text, apiKey, voiceId);
    if (bytes) return bytes;
    if (attempt < maxRetries) {
      const delay = 800 * Math.pow(2, attempt);
      console.log(
        `[ElevenLabs] retry ${attempt + 1}/${maxRetries} after ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

// ── Claude 스크립트 (기존 시스템 프롬프트 유지) ──────────────────
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

interface SceneSpec {
  title: string;
  subtitle?: string;
  narration: string;
  photo_index: number;
}

interface ShotstackRenderResult {
  renderId: string | null;
  errorMessage: string | null;
  raw: unknown;
}

async function postToShotstack(
  apiKey: string,
  host: string,
  payload: Record<string, unknown>,
): Promise<ShotstackRenderResult> {
  const url = `${host.replace(/\/+$/, "")}/render`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json:
      | { success?: boolean; message?: string; response?: { id?: string } }
      | null = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* 응답이 JSON 이 아닌 케이스 (HTML 에러 페이지 등) — text 그대로 노출 */
    }
    if (!res.ok) {
      const detail =
        json?.message ||
        (json as { error?: string } | null)?.error ||
        text.slice(0, 250) ||
        res.statusText ||
        "응답 본문 없음";
      console.error(
        `[Shotstack POST ${url}] ${res.status} ${res.statusText} — ${detail}`,
      );
      return {
        renderId: null,
        errorMessage: `Shotstack ${res.status}: ${detail}`,
        raw: json || text,
      };
    }
    const renderId = json?.response?.id || null;
    if (!renderId) {
      return {
        renderId: null,
        errorMessage: json?.message || "Shotstack 응답에 render id 없음",
        raw: json,
      };
    }
    return { renderId, errorMessage: null, raw: json };
  } catch (e) {
    console.error(`[Shotstack POST ${url}] 예외:`, e);
    return {
      renderId: null,
      errorMessage: e instanceof Error ? e.message : "Shotstack 호출 실패",
      raw: null,
    };
  }
}

interface BuildTimelineParams {
  photoUrls: string[];
  narrationUrls: (string | null)[];
  subtitles: string[];
  bgmUrl: string | null;
  companyName: string;
  phoneNumber: string;
}

// Shotstack 의 기본 title asset 은 라틴 폰트만 내장이라 한국어가 .notdef
// 글리프(빈 사각형) 로 렌더된다. timeline.fonts 에 한국어 woff2 를 등록하고
// HTML asset 에서 그 family 를 참조하면 한국어 자막이 정상 출력된다.
//
// 폰트 선정: Pretendard — Apple SD Gothic Neo / Noto Sans KR 호환의 한국어 친화 폰트.
// jsDelivr 의 GitHub raw CDN 은 안정적이며 Shotstack 렌더 노드가 fetch 가능.
const KO_FONT_URL_BOLD =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff2/Pretendard-Bold.woff2";
const KO_FONT_URL_REGULAR =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff2/Pretendard-Regular.woff2";
const KO_FONT_FAMILY = "Pretendard";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildShotstackPayload(p: BuildTimelineParams): Record<string, unknown> {
  const photoCount = p.photoUrls.length;
  const photoTotalSec = photoCount * PHOTO_SECONDS;

  // ── 사진 트랙 ──
  const photoClips = p.photoUrls.map((src, i) => ({
    asset: { type: "image", src },
    start: i * PHOTO_SECONDS,
    length: PHOTO_SECONDS,
    fit: "cover",
    transition: { in: "fade", out: "fade" },
  }));

  // ── 자막 트랙 ── HTML asset + Pretendard
  // width/height 는 픽셀(1080×1920 캔버스 기준). 하단 16% 지점에 띄운다.
  const subtitleClips = p.subtitles
    .map((text, i) => {
      if (!text || !text.trim()) return null;
      const safe = escapeHtml(text.trim());
      return {
        asset: {
          type: "html",
          html: `<div class="cap">${safe}</div>`,
          css:
            `.cap { font-family: '${KO_FONT_FAMILY}', sans-serif; font-weight: 700; ` +
            `color: #ffffff; font-size: 56px; line-height: 1.35; text-align: center; ` +
            `padding: 18px 28px; background: rgba(0,0,0,0.62); border-radius: 14px; ` +
            `display: inline-block; }`,
          width: 980,
          height: 240,
          background: "transparent",
        },
        start: i * PHOTO_SECONDS,
        length: PHOTO_SECONDS,
        position: "bottom",
        offset: { y: 0.08 },
        transition: { in: "fade", out: "fade" },
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // ── 엔딩 카드 ── (마지막 1초)
  const endingHtml =
    `<div class="ending">` +
    `<div class="company">${escapeHtml(p.companyName || "SMS")}</div>` +
    (p.phoneNumber
      ? `<div class="phone">${escapeHtml(p.phoneNumber)}</div>`
      : "") +
    `</div>`;
  const endingClip = {
    asset: {
      type: "html",
      html: endingHtml,
      css:
        `.ending { font-family: '${KO_FONT_FAMILY}', sans-serif; color: #ffffff; ` +
        `text-align: center; padding: 80px 40px; background: linear-gradient(135deg, #001130, #1a3a6a); ` +
        `border-radius: 24px; width: 100%; box-sizing: border-box; } ` +
        `.company { font-size: 96px; font-weight: 800; margin-bottom: 24px; line-height: 1.2; } ` +
        `.phone { font-size: 56px; font-weight: 500; opacity: 0.92; }`,
      width: 980,
      height: 1100,
      background: "transparent",
    },
    start: photoTotalSec,
    length: ENDING_SECONDS,
    position: "center",
    transition: { in: "fade", out: "fade" },
  };

  // ── 나레이션 트랙 ──
  const narrationClips = p.narrationUrls
    .map((src, i) => {
      if (!src) return null;
      return {
        asset: { type: "audio", src },
        start: i * PHOTO_SECONDS,
        length: PHOTO_SECONDS,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const tracks: Array<{ clips: unknown[] }> = [
    { clips: [endingClip] },     // 엔딩 (최상단)
    { clips: subtitleClips },    // 자막
    { clips: photoClips },       // 사진
  ];
  if (narrationClips.length > 0) {
    tracks.push({ clips: narrationClips });
  }

  return {
    timeline: {
      background: "#000000",
      // Shotstack 가 렌더 시 woff2 를 fetch → CSS 의 font-family 로 매칭
      fonts: [
        { src: KO_FONT_URL_BOLD },
        { src: KO_FONT_URL_REGULAR },
      ],
      ...(p.bgmUrl
        ? {
            soundtrack: {
              src: p.bgmUrl,
              effect: "fadeOut",
              volume: 0.25,
            },
          }
        : {}),
      tracks,
    },
    output: {
      format: "mp4",
      size: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT },
      fps: 30,
    },
  };
}

// ── 메인 핸들러 ──────────────────────────────────────────────────
serve(
  withGuard(
    { fn: "generate-shorts", limit: 5, windowSec: 60 },
    async (req, ctx) => {
      try {
        // 1) 월 한도 검증
        const quota = await checkMonthlyLimit(
          ctx.userId,
          ctx.clientKey,
          "generate-shorts",
        );
        if (!quota.allowed) {
          void logUsage({
            user_id: ctx.userId,
            fn_name: "generate-shorts",
            status: "rate_limited",
            origin: ctx.origin,
            extra: {
              blocked: "quota",
              plan: quota.plan,
              used: quota.used,
              max: quota.max,
            },
          });
          return new Response(
            JSON.stringify({
              error: "이번 달 영상 한도를 모두 사용했습니다.",
              used: quota.used,
              max: quota.max,
              plan: quota.plan,
            }),
            {
              status: 429,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "Retry-After": String(quota.retryAfterSec),
              },
            },
          );
        }

        const SHOTSTACK_API_KEY = Deno.env.get("SHOTSTACK_API_KEY");
        if (!SHOTSTACK_API_KEY) {
          return new Response(
            JSON.stringify({
              error:
                "SHOTSTACK_API_KEY 가 설정되지 않았습니다. Supabase Secrets 를 확인해 주세요.",
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        const SHOTSTACK_HOST =
          Deno.env.get("SHOTSTACK_HOST") || SHOTSTACK_HOST_DEFAULT;

        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
        const ENDING_BGM_URL = Deno.env.get("SHOTSTACK_BGM_URL"); // (선택) 공개 mp3 URL

        const body = await req.json();
        const {
          photos,
          videoStyle,
          narrationType,
          location,
          companyName,
          phoneNumber,
          voiceId: requestedVoiceId,
          scriptMode,
          manualScript,
          businessCategory,
          workTopic,
        } = body;

        const resolvedVoiceId =
          VOICE_MAP[requestedVoiceId || ""] ||
          requestedVoiceId ||
          VOICE_MAP.male_pro;

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

        // 2) 스크립트 — Gemini → Claude → mock 순 폴백
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
              if (parsed) scenes = parsed;
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
              if (parsed) scenes = parsed;
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
        }

        // 씬 길이를 사진 수와 정합 — 부족하면 마지막 사진으로 패딩, 넘치면 자른다
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

        // 3) 사진 업로드 (Supabase Storage → Shotstack 가 fetch)
        const userScope = ctx.userId || "anon";
        const jobId = crypto.randomUUID();
        const photoUrls: string[] = [];
        const uploadStart = Date.now();
        for (let i = 0; i < photoSlice.length; i++) {
          const dataUrl: string = photoSlice[i].dataUrl || photoSlice[i];
          const { url } = await uploadDataUrl(
            dataUrl,
            `${userScope}/${jobId}/photo-${i + 1}`,
          );
          if (!url) {
            return new Response(
              JSON.stringify({
                error:
                  "사진 업로드에 실패했습니다. Supabase Storage(shorts-assets) 설정을 확인해 주세요.",
              }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
          photoUrls.push(url);
        }
        console.log(
          `[upload] photos ${photoUrls.length}장 (${Date.now() - uploadStart}ms)`,
        );

        // 4) ElevenLabs 나레이션 → Storage 업로드
        const narrationUrls: (string | null)[] = new Array(scenes.length).fill(
          null,
        );
        const failedScenes: number[] = [];
        if (ELEVENLABS_API_KEY && narrationType !== "없음") {
          const t0 = Date.now();
          const settled = await Promise.allSettled(
            scenes.map(async (scene, idx) => {
              const text = (scene.narration || "").trim();
              if (!text) return { idx, url: null as string | null, skipped: true };
              const bytes = await generateNarrationBytesWithRetry(
                text,
                ELEVENLABS_API_KEY,
                resolvedVoiceId,
                2,
              );
              if (!bytes) return { idx, url: null, skipped: false };
              const uploadedUrl = await uploadPublicAsset({
                path: `${userScope}/${jobId}/narration-${idx + 1}.mp3`,
                bytes,
                contentType: "audio/mpeg",
              });
              return { idx, url: uploadedUrl, skipped: false };
            }),
          );

          let attempted = 0;
          settled.forEach((r, i) => {
            if (r.status === "fulfilled") {
              if (!r.value.skipped) {
                attempted++;
                if (r.value.url) narrationUrls[i] = r.value.url;
                else failedScenes.push(i);
              }
            } else {
              attempted++;
              failedScenes.push(i);
              console.error(
                `[ElevenLabs] scene ${i} 예외:`,
                (r as PromiseRejectedResult).reason,
              );
            }
          });

          const successCount = narrationUrls.filter(Boolean).length;
          console.log(
            `[ElevenLabs] 성공 ${successCount}/${scenes.length}, 실패 [${failedScenes.join(",")}] (${Date.now() - t0}ms)`,
          );

          if (attempted > 0 && successCount === 0) {
            void logUsage({
              user_id: ctx.userId,
              fn_name: "generate-shorts",
              status: "error",
              origin: ctx.origin,
              extra: { message: "elevenlabs_all_failed" },
            });
            return new Response(
              JSON.stringify({
                error:
                  "나레이션 음성 생성에 전부 실패했습니다. 잠시 후 다시 시도해주세요.",
                failedScenes,
              }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
        }

        // 5) Shotstack 페이로드 작성 + 호출
        const subtitles = scenes.map(
          (s) => s.title || s.subtitle || s.narration || "",
        );
        const payload = buildShotstackPayload({
          photoUrls,
          narrationUrls,
          subtitles,
          bgmUrl: ENDING_BGM_URL || null,
          companyName: companyName || "",
          phoneNumber: phoneNumber || "",
        });

        const shotstack = await postToShotstack(
          SHOTSTACK_API_KEY,
          SHOTSTACK_HOST,
          payload,
        );

        if (!shotstack.renderId) {
          void logUsage({
            user_id: ctx.userId,
            fn_name: "generate-shorts",
            status: "error",
            origin: ctx.origin,
            extra: {
              message: "shotstack_post_failed",
              detail: shotstack.errorMessage,
            },
          });
          return new Response(
            JSON.stringify({
              error: shotstack.errorMessage || "Shotstack render 요청 실패",
            }),
            {
              status: 502,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        void logUsage({
          user_id: ctx.userId,
          fn_name: "generate-shorts",
          status: "ok",
          origin: ctx.origin,
          extra: {
            sceneCount: scenes.length,
            photoCount,
            failedSceneCount: failedScenes.length,
            scriptMode: scriptMode || "ai",
            videoStyle,
            narrationType,
            renderId: shotstack.renderId,
            durationSec: photoCount * PHOTO_SECONDS + ENDING_SECONDS,
          },
        });

        return new Response(
          JSON.stringify({
            renderId: shotstack.renderId,
            message: "shotstack에 위임됨",
            sceneCount: scenes.length,
            photoCount,
            durationSec: photoCount * PHOTO_SECONDS + ENDING_SECONDS,
            failedScenes,
            scenes,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (e) {
        console.error("generate-shorts error:", e);
        void logUsage({
          user_id: ctx.userId,
          fn_name: "generate-shorts",
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

// ── 유틸 ─────────────────────────────────────────────────────────
function safeParseScenes(raw: string): SceneSpec[] | null {
  if (!raw) return null;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/\{[\s\S]*\}/);
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

// silence unused warning (base64ToBytes는 향후 raw mp3 디코딩용으로 export 유지)
void base64ToBytes;

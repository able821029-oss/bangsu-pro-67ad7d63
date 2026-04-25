import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withGuard, CORS_HEADERS, logUsage } from "../_shared/guard.ts";
import { checkMonthlyLimit } from "../_shared/usageGuard.ts";
import {
  base64ToBytes,
  uploadDataUrl,
  uploadPublicAsset,
} from "../_shared/storageUpload.ts";
import { getShotstackConfig } from "../_shared/shotstack.ts";

const corsHeaders = CORS_HEADERS;

// Shotstack 호스트/키/모드는 _shared/shotstack.ts 단일 출처에서 가져옴.
// 운영 전환: Supabase Secrets 에 SHOTSTACK_HOST=https://api.shotstack.io/edit/v1 + prod 키로 교체.

// ── 영상 구성 상수 ───────────────────────────────────────────────
const PHOTO_SECONDS = 5;       // 사진 한 장당 노출 시간
const ENDING_SECONDS = 3;      // 마지막 엔딩 카드 (로고 + 회사명 + 연락처)
// 영상 한 편의 절대 상한 — Shotstack 분당 과금 + 무료 stage 월 한도 보호.
// 클라이언트가 더 큰 값을 요청해도 이 값으로 강제 캡핑된다.
const MAX_DURATION_HARD_CAP_SEC = 120;
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
  /** Storage public URL — Shotstack 가 fetch 가능한 https URL 이어야 함 */
  logoUrl: string | null;
}

// Shotstack 한국어 자막 처리:
// - 기본 title asset 은 라틴 폰트만 내장 → 한국어가 .notdef (빈 사각형)
// - 시스템 폰트 fallback 도 실패 (렌더 노드에 NotoSansCJK 미설치 확인됨)
// - 따라서 timeline.fonts 에 외부 한국어 폰트를 등록해야 함
//
// 직전 시도(woff2)는 timeline 전체 reject → 검정 영상 사고.
// Shotstack 공식 예제는 .ttf 만 보이지만, .otf 도 동일 OpenType 컨테이너이므로
// 시도해 본다. URL 은 jsDelivr GitHub mirror (200 + 실제 바이트 검증 완료).
const KO_FONT_FAMILY = "Pretendard";
const KO_FONT_URL_BOLD =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@main/packages/pretendard/dist/public/static/Pretendard-Bold.otf";
const KO_FONT_URL_REGULAR =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@main/packages/pretendard/dist/public/static/Pretendard-Regular.otf";
const KO_FONT_STACK = `'${KO_FONT_FAMILY}', sans-serif`;

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
            `.cap { font-family: ${KO_FONT_STACK}; font-weight: 700; ` +
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

  // ── 엔딩 카드 ──
  // 직전 fix(flex layout) 가 Shotstack html 렌더에서 무시되어 회사명/전화번호가 겹쳐 그려짐.
  // 클래스 매칭 의존을 제거하기 위해 inline style 로만 작성.
  // 로고는 html <img> 가 비동기 fetch 못 따라가 빈 화면이 되는 케이스가 있어서
  // 별도 image clip 으로 분리한다 — Shotstack image asset 은 fetch+render 보장.
  const hasLogo = !!p.logoUrl;
  const endingTextHtml =
    `<div style="font-family:${KO_FONT_STACK};color:#ffffff;text-align:center;` +
    `padding:80px 60px;background:linear-gradient(135deg,#001130 0%,#1a3a6a 100%);` +
    `width:100%;height:100%;box-sizing:border-box;">` +
    // 로고 영역 자리 — image clip 이 위쪽 -0.18 offset 에 그려지므로 텍스트가 겹치지 않게 비워둠
    (hasLogo ? `<div style="height:320px;"></div>` : "") +
    `<div style="font-size:96px;font-weight:800;line-height:1.15;` +
    `margin-bottom:48px;word-break:keep-all;">` +
    `${escapeHtml(p.companyName || "SMS")}</div>` +
    (p.phoneNumber
      ? `<div style="font-size:56px;font-weight:500;opacity:0.92;` +
        `letter-spacing:0.04em;line-height:1.2;">` +
        `${escapeHtml(p.phoneNumber)}</div>`
      : "") +
    `</div>`;

  const endingTextClip = {
    asset: {
      type: "html",
      html: endingTextHtml,
      // css 키는 빈 문자열로 두어도 inline style 만으로 동작. 일부 spec 은 css 필수라
      // 안전 차원으로 reset 한 줄만.
      css: `* { margin: 0; padding: 0; box-sizing: border-box; }`,
      width: 1080,
      height: 1920,
      background: "transparent",
    },
    start: photoTotalSec,
    length: ENDING_SECONDS,
    position: "center",
    transition: { in: "fade", out: "fade" },
  };

  // 로고는 image asset 으로 별도 clip — html <img> 비동기 fetch 이슈 회피.
  // position: top, offset.y -0.18 → 위쪽에 배치 (텍스트 영역과 안 겹치도록).
  // scale 0.26 → 1080 캔버스의 26% = 약 280px 정사각형.
  const endingLogoClip = hasLogo
    ? {
        asset: { type: "image", src: p.logoUrl as string },
        start: photoTotalSec,
        length: ENDING_SECONDS,
        position: "top",
        offset: { y: -0.18 },
        scale: 0.26,
        fit: "contain",
        transition: { in: "fade", out: "fade" },
      }
    : null;

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

  // 트랙 순서: 위에 있을수록 화면 상단 레이어.
  // 로고는 텍스트 위 — 둘 다 ENDING_SECONDS 동안 동시 표시되므로 z-order 만 결정.
  const tracks: Array<{ clips: unknown[] }> = [
    ...(endingLogoClip ? [{ clips: [endingLogoClip] }] : []),  // 엔딩 로고 (이미지)
    { clips: [endingTextClip] },                                // 엔딩 텍스트
    { clips: subtitleClips },                                   // 사진 위 자막
    { clips: photoClips },                                      // 사진 (배경)
  ];
  if (narrationClips.length > 0) {
    tracks.push({ clips: narrationClips });
  }

  return {
    timeline: {
      background: "#000000",
      // timeline.fonts: Pretendard otf 두 weight 등록.
      // - 직전 woff2 시도는 검정 영상 회귀 발생 → otf 로 재시도.
      // - URL 은 jsDelivr GitHub mirror (HEAD 200 + 1.5MB 실제 바이트 검증 완료).
      // - css 의 font-family: 'Pretendard' 가 자동 매칭되어 한국어 글리프 출력.
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

        const shotstack = getShotstackConfig();
        if (!shotstack) {
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
        const SHOTSTACK_API_KEY = shotstack.apiKey;
        const SHOTSTACK_HOST = shotstack.host;

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
          logoUrl: requestedLogoUrl,
          voiceId: requestedVoiceId,
          scriptMode,
          manualScript,
          businessCategory,
          workTopic,
          maxDurationSec: requestedMaxDuration,
          // 자막 검수 워크플로우 — 클라이언트가 generate-shorts-script 에서 받아
          // 사용자가 편집한 scenes 를 그대로 재사용 (LLM 호출 스킵).
          scenes: providedScenes,
        } = body;

        const resolvedVoiceId =
          VOICE_MAP[requestedVoiceId || ""] ||
          requestedVoiceId ||
          VOICE_MAP.male_pro;

        // ── 영상 길이 cap ──
        // 클라이언트가 maxDurationSec 를 보내면 그 값을 사용하되,
        // MAX_DURATION_HARD_CAP_SEC(120s) 을 넘을 수 없다.
        const requestedCap =
          typeof requestedMaxDuration === "number" && requestedMaxDuration > 0
            ? requestedMaxDuration
            : MAX_DURATION_HARD_CAP_SEC;
        const effectiveMaxDuration = Math.min(
          requestedCap,
          MAX_DURATION_HARD_CAP_SEC,
        );
        // 사진 수 = floor((cap - 엔딩) / 사진당 시간). 최소 1장은 확보.
        const maxPhotosByDuration = Math.max(
          1,
          Math.floor(
            (effectiveMaxDuration - ENDING_SECONDS) / PHOTO_SECONDS,
          ),
        );

        const photoSlice = (photos || []).slice(0, maxPhotosByDuration);
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

        // 0순위: 클라이언트가 자막 검수 화면에서 편집한 scenes 를 그대로 받은 경우.
        // generate-shorts-script 결과를 사용자가 인라인 편집한 뒤 보내므로,
        // LLM 호출을 스킵하고 그대로 영상 렌더링에 사용한다.
        if (Array.isArray(providedScenes) && providedScenes.length > 0) {
          const cleaned: SceneSpec[] = [];
          for (let i = 0; i < providedScenes.length; i++) {
            const s = providedScenes[i];
            if (!s || typeof s !== "object") continue;
            const obj = s as Record<string, unknown>;
            cleaned.push({
              title: typeof obj.title === "string" ? obj.title : "",
              subtitle:
                typeof obj.subtitle === "string" ? obj.subtitle : undefined,
              narration:
                typeof obj.narration === "string" ? obj.narration : "",
              photo_index:
                typeof obj.photo_index === "number" && obj.photo_index > 0
                  ? Math.floor(obj.photo_index)
                  : i + 1,
            });
          }
          if (cleaned.length > 0) {
            scenes = cleaned;
            console.log(
              `[generate-shorts] 클라이언트 제공 scenes 사용 (${cleaned.length}개) — LLM 스킵`,
            );
          }
        }

        // 직접 작성 대본 우선
        if (!scenes && scriptMode === "manual" && manualScript) {
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

        // 3-2) 로고 업로드 — dataURL 이면 Storage 로 변환, 이미 https URL 이면 그대로 사용.
        // 실패해도 영상 자체는 만들어져야 하므로 null 로 fallback.
        let logoPublicUrl: string | null = null;
        let logoStatus:
          | "embedded"
          | "skipped_empty"
          | "skipped_invalid_format"
          | "upload_failed" = "skipped_empty";
        if (typeof requestedLogoUrl === "string" && requestedLogoUrl.length > 0) {
          if (requestedLogoUrl.startsWith("data:")) {
            const { url: uploadedLogoUrl } = await uploadDataUrl(
              requestedLogoUrl,
              `${userScope}/${jobId}/logo`,
            );
            if (uploadedLogoUrl) {
              logoPublicUrl = uploadedLogoUrl;
              logoStatus = "embedded";
              console.log(`[upload] logo 업로드 성공: ${uploadedLogoUrl}`);
            } else {
              logoStatus = "upload_failed";
              console.warn(
                "[upload] logo 업로드 실패 — 엔딩 카드 텍스트만 표시. " +
                  "shorts-assets 버킷의 allowed_mime_types 에 이미지 형식이 포함됐는지 확인.",
              );
            }
          } else if (/^https?:\/\//i.test(requestedLogoUrl)) {
            logoPublicUrl = requestedLogoUrl;
            logoStatus = "embedded";
            console.log(`[upload] logo 외부 URL 그대로 사용: ${requestedLogoUrl}`);
          } else {
            logoStatus = "skipped_invalid_format";
            console.warn(
              `[upload] logo 형식 인식 못함 (앞 30자: ${requestedLogoUrl.slice(0, 30)})`,
            );
          }
        } else {
          console.log("[upload] logoUrl 클라이언트가 보내지 않음 (또는 빈 값)");
        }

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
          logoUrl: logoPublicUrl,
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

        const finalDurationSec = photoCount * PHOTO_SECONDS + ENDING_SECONDS;
        const requestedPhotoCount = Array.isArray(photos) ? photos.length : 0;
        const trimmedByCap = requestedPhotoCount > photoCount;

        void logUsage({
          user_id: ctx.userId,
          fn_name: "generate-shorts",
          status: "ok",
          origin: ctx.origin,
          extra: {
            sceneCount: scenes.length,
            photoCount,
            requestedPhotoCount,
            trimmedByCap,
            failedSceneCount: failedScenes.length,
            scriptMode: scriptMode || "ai",
            videoStyle,
            narrationType,
            renderId: shotstack.renderId,
            durationSec: finalDurationSec,
            effectiveMaxDuration,
          },
        });

        return new Response(
          JSON.stringify({
            renderId: shotstack.renderId,
            message: "shotstack에 위임됨",
            sceneCount: scenes.length,
            photoCount,
            durationSec: finalDurationSec,
            maxDurationSec: effectiveMaxDuration,
            trimmedByCap,
            failedScenes,
            logoStatus,
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

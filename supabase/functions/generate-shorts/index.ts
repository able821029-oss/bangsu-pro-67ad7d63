import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.210.0/encoding/base64.ts";
import { withGuard, CORS_HEADERS, logUsage } from "../_shared/guard.ts";
import { checkMonthlyLimit } from "../_shared/usageGuard.ts";

const corsHeaders = CORS_HEADERS;

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
          // flash_v2_5: turbo 대비 ~30% 빠름 (속도 최적화 2026-04-20). 한국어 품질 유지.
          model_id: "eleven_flash_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true, speed: 0.8 },
        }),
      }
    );
    if (!res.ok) {
      console.error("ElevenLabs error:", res.status, await res.text());
      return null;
    }
    const audioBuffer = await res.arrayBuffer();
    return encodeBase64(audioBuffer);
  } catch (e) {
    console.error("ElevenLabs TTS error:", e);
    return null;
  }
}

/**
 * 지수 백오프 재시도 래퍼 — 최대 2회 추가 시도 (총 3번).
 * 매 시도마다 generateNarration이 null 반환하면 800ms·1600ms 대기 후 재시도.
 * ElevenLabs 429/500 일시적 장애를 자가 복구한다.
 */
async function generateNarrationWithRetry(
  text: string,
  apiKey: string,
  voiceId: string,
  maxRetries = 2,
): Promise<string | null> {
  if (!text || !apiKey) return null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const audio = await generateNarration(text, apiKey, voiceId);
    if (audio) return audio;
    if (attempt < maxRetries) {
      const delay = 800 * Math.pow(2, attempt);
      console.log(`[ElevenLabs] retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

// 공개 AI 엔드포인트 — Origin 검증 + 60초에 5회 rate limit (가장 비싼 호출)
serve(withGuard({ fn: "generate-shorts", limit: 5, windowSec: 60 }, async (req, ctx) => {
  try {
    // 서버측 월 영상 한도 검증 — plan별 maxVideo 기준
    const quota = await checkMonthlyLimit(ctx.userId, ctx.clientKey, "generate-shorts");
    if (!quota.allowed) {
      void logUsage({
        user_id: ctx.userId,
        fn_name: "generate-shorts",
        status: "rate_limited",
        origin: ctx.origin,
        extra: { blocked: "quota", plan: quota.plan, used: quota.used, max: quota.max },
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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    // ElevenLabs 성별 구분 자연스러운 음성 매핑
    const VOICE_MAP: Record<string, string> = {
      "male_calm": "nPczCjzI2devNBz1zQrb",      // Brian — 차분한 남성
      "male_pro": "N2lVS1w4EtoT3dr4eOWO",       // Marcus — 전문적 남성
      "male_strong": "TX3LPaxmHKxFdv7VOQHJ",    // Thomas — 힘있는 남성
      "female_friendly": "EXAVITQu4vr4xnSDxMaL", // Bella — 친근한 여성
      "female_pro": "XrExE9yKIg1WjnnlVkGX",     // Lily — 전문적 여성
      "female_bright": "pFZP5JQG7iQjIQuC4Bku",  // Freya — 밝은 여성
    };
    const ELEVENLABS_VOICE_ID = Deno.env.get("ELEVENLABS_VOICE_ID") || "nPczCjzI2devNBz1zQrb";

    const body = await req.json();
    const {
      photos,
      videoStyle,
      narrationType,
      location,
      buildingType,
      constructionDate,
      companyName,
      phoneNumber,
      voiceId: requestedVoiceId,
      scriptMode,
      manualScript,
      maxDurationSec,
      businessCategory,
      workTopic,
    } = body;
    const resolvedVoiceId = VOICE_MAP[requestedVoiceId || ""] || requestedVoiceId || ELEVENLABS_VOICE_ID;

    // 업종 한글 매핑
    const categoryLabels: Record<string, string> = {
      "건축_시공": "건축/시공 (방수, 도배, 타일, 미장, 리모델링, 인테리어 등)",
      "요식업": "요식업 (식당, 카페, 베이커리, 주점 등)",
      "미용_뷰티": "미용/뷰티 (헤어, 네일, 피부관리, 메이크업)",
      "자동차": "자동차 (세차, 정비, 튜닝, 광택 복원)",
      "청소_방역": "청소/방역 (입주청소, 사무실청소, 방역)",
      "반려동물": "반려동물 (미용, 훈련, 호텔링)",
      "의료_헬스": "의료/헬스 (PT, 필라테스, 물리치료, 한의원)",
      "교육": "교육 (학원, 공방, 개인 레슨)",
      "제조_판매": "제조/판매 (공방, 수공예, 가구, 소품)",
      "기타": "기타 서비스업",
    };
    const businessLabel = businessCategory ? categoryLabels[businessCategory] || businessCategory : "";

    const styleGuide: Record<string, string> = {
      "시공일지형": "진행 과정 순서(준비/작업/완료)로 텍스트 중심 장면을 구성합니다.",
      "홍보형": "완성된 결과물을 강조하고, 업체 브랜딩과 연락처를 부각합니다.",
      "Before/After형": "작업 전후 비교를 중심으로 극적인 변화를 텍스트로 보여줍니다.",
      "일지형": "작업 진행 과정 순서로 텍스트 중심 장면을 구성합니다.",
    };

    const animations = ["slide_up", "slide_left", "zoom_in", "fade_in"];

    const systemPrompt = `당신은 mirra.my 스타일의 쇼츠 영상 스크립트 작성 전문가입니다.
텍스트 애니메이션 중심의 세련된 영상을 만듭니다.

[매우 중요 — 업종 자동 판별]
이 앱은 모든 업종의 현장/작업 사진을 쇼츠 영상으로 만듭니다. 특정 업종(방수/건축 등)에만 한정하지 마세요.
사진을 먼저 면밀히 관찰하여 업종을 자동 판별한 뒤, 그 업종에 맞는 용어와 톤으로 스크립트를 작성하세요.

예시 업종 (사진에 맞게 자동 판별):
- 건축/시공 (방수, 도배, 미장, 타일, 리모델링, 인테리어, 조경 등)
- 요식업 (음식 플레이팅, 매장 소개, 신메뉴 공개, 오픈 준비)
- 미용/뷰티 (헤어 시술 전후, 네일, 피부관리, 메이크업)
- 자동차 (세차, 정비, 튜닝, 복원, 광택)
- 청소/방역 (입주청소, 사무실청소, 방역, 세척)
- 반려동물 (미용, 훈련, 호텔링)
- 의료/헬스 (물리치료, 필라테스, PT, 한의원)
- 기타 모든 서비스업 및 제조·판매업

업종을 잘못 판별하면 안 됩니다. 사진이 음식이면 "시공"이라 쓰지 말고, 사진이 헤어샵이면 "공사"라 쓰지 마세요.
용어는 **해당 업종 사장님이 실제로 쓰는 말**을 사용하세요.
업종을 확실히 알 수 없으면 일반적인 "작업", "결과", "서비스" 같은 중립적 용어를 사용하세요.

${styleGuide[videoStyle] || styleGuide["일지형"]}

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
1. 인트로 장면: 업종에 맞는 후킹 메시지. badge에 지역명 또는 업종 카테고리, title에 핵심 메시지(업체가 제공하는 서비스/가치), bg_type: "gradient", photo: null
2. 사진 장면 1~N: 업로드된 사진을 순서대로 보여줍니다. photo에 "photo_1", "photo_2" 등. bg_type: "photo". 사진 위에 업종에 맞는 짧은 설명 오버레이.
3. 하이라이트 장면: 결과물/가치를 강조. bg_type: "gradient", accent_color를 밝게.
4. 엔딩 장면: 업체명이 title, 전화번호가 subtitle. badge는 업종에 맞게 "예약 문의", "주문 문의", "상담 신청", "방문 예약" 등 중 하나. bg_type: "gradient", bg_colors: ["#001130", "#0a2a5a"]

animation 종류: "slide_up", "slide_left", "zoom_in", "fade_in" — 장면마다 다르게 교차 사용.
duration: 프레임 수 (24fps 기준). 최소 60(2.5초), 최대 96(4초). 보통 72~84(3~3.5초). 짧고 임팩트 있게.
bg_colors: 항상 2색 배열. 다크 네이비 계열 (#001130, #0a1628, #1a3a6a, #0d2847 등)
accent_color: "#237FFF" 또는 "#AB5EBE" 교차 사용.
narration: ${narrationType === "없음" ? "빈 문자열로" : "20자 이내 짧고 임팩트 있는 한국어 나레이션. 업종에 맞는 자연스러운 말투"}
총 장면 수: 사진 수 + 2~3개 (인트로, 하이라이트, 엔딩)
JSON만 응답. 마크다운 코드 블록 금지.`;

    let result: any;

    // ── 직접 작성 대본 → 장면 변환 ──
    if (scriptMode === "manual" && manualScript) {
      const lines = manualScript.split("\n").filter((l: string) => l.trim());
      const photoCount = (photos || []).length;
      const manualScenes: any[] = [];

      // 각 대본 줄 = 1개 장면, 사진이 있으면 배경으로 사용
      for (let i = 0; i < lines.length; i++) {
        const hasPhoto = i < photoCount;
        manualScenes.push({
          duration: 84,
          bg_type: hasPhoto ? "photo" : "gradient",
          bg_colors: ["#0a1628", "#1a3a6a"],
          badge: hasPhoto ? `${i + 1}단계` : "",
          title: lines[i],
          subtitle: "",
          accent_color: i % 2 === 0 ? "#237FFF" : "#AB5EBE",
          animation: animations[i % 4],
          photo: hasPhoto ? `photo_${i + 1}` : null,
          narration: lines[i],
        });
      }

      // 사진이 대본보다 많으면 나머지 사진도 장면 추가
      for (let i = lines.length; i < photoCount; i++) {
        manualScenes.push({
          duration: 84, bg_type: "photo", bg_colors: ["#001130", "#0d2847"],
          badge: `${i + 1}단계`, title: `시공 ${i + 1}단계`, subtitle: "",
          accent_color: i % 2 === 0 ? "#237FFF" : "#AB5EBE",
          animation: animations[i % 4], photo: `photo_${i + 1}`, narration: "",
        });
      }

      // 엔딩 — 업체명 + 로고 + 연락처 강조
      manualScenes.push({
        duration: 96, bg_type: "gradient", bg_colors: ["#001130", "#0a2a5a"],
        badge: "시공 문의", title: companyName || "SMS",
        subtitle: phoneNumber || "연락주세요", accent_color: "#237FFF",
        animation: "fade_in", photo: null,
        narration: `${companyName || "SMS"}에 문의하세요. ${phoneNumber || ""}`,
      });

      result = { scenes: manualScenes };
    }

    // ── Step 1: Gemini 2.0 Flash로 장면 스크립트 생성 (무료, 빠름) ──
    // GEMINI_API_KEY 미설정 시 Claude 폴백
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!result && GEMINI_API_KEY) {
      const parts: any[] = [];
      const photoSlice = (photos || []).slice(0, 5);
      for (const photo of photoSlice) {
        const dataUrl = photo.dataUrl || photo;
        const base64Match = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
        if (base64Match) {
          parts.push({
            inline_data: {
              mime_type: `image/${base64Match[1]}`,
              data: base64Match[2],
            },
          });
        }
      }
      const hintBlock = [
        businessLabel ? `업종 (프로필 지정): ${businessLabel}` : "업종: 사진으로 자동 판별",
        workTopic ? `오늘의 작업 (사장님이 직접 입력): "${workTopic}"` : "",
        `업체명: ${companyName || ""}`,
        `연락처: ${phoneNumber || ""}`,
        `활동 지역: ${location || "미입력"}`,
        `일자: ${constructionDate || "오늘"}`,
        `영상 스타일: ${videoStyle}`,
        `사진 수: ${photoSlice.length}장`,
      ]
        .filter(Boolean)
        .join("\n");

      parts.push({
        text: `[스크립트 생성 힌트]\n${hintBlock}\n\n위 업종과 "오늘의 작업" 문구를 반드시 스크립트에 반영하세요. 사진과 힌트가 모순되면 힌트를 우선합니다. JSON으로만 응답.`,
      });

      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: "user", parts }],
              generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 2048,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          try {
            result = JSON.parse(rawText);
          } catch {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) result = JSON.parse(jsonMatch[0]);
          }
          console.log("Gemini 2.0 Flash 스크립트 생성 성공");
        } else {
          console.error("Gemini API error:", geminiRes.status, await geminiRes.text());
        }
      } catch (e) {
        console.error("Gemini API error:", e);
      }
    }

    // ── Step 1-Fallback: Claude (Gemini 실패 또는 미설정 시) ──
    if (!result && ANTHROPIC_API_KEY) {
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
      const hintBlockClaude = [
        businessLabel ? `업종 (프로필 지정): ${businessLabel}` : "업종: 사진으로 자동 판별",
        workTopic ? `오늘의 작업 (사장님이 직접 입력): "${workTopic}"` : "",
        `업체명: ${companyName || ""}`,
        `연락처: ${phoneNumber || ""}`,
        `활동 지역: ${location || "미입력"}`,
        `일자: ${constructionDate || "오늘"}`,
        `영상 스타일: ${videoStyle}`,
        `사진 수: ${photoSlice.length}장`,
      ]
        .filter(Boolean)
        .join("\n");

      userContent.push({
        type: "text",
        text: `[스크립트 생성 힌트]\n${hintBlockClaude}\n\n위 업종과 "오늘의 작업" 문구를 반드시 스크립트에 반영하세요. 사진과 힌트가 모순되면 힌트를 우선합니다. JSON으로만 응답.`,
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
            model: "claude-haiku-4-5-20251001",
            // 실제 스크립트 JSON은 약 1200~1400 토큰 → 1500 여유.
            max_tokens: 1500,
            // 시스템 프롬프트 캐싱 — 재호출 시 입력 토큰 비용·시간 ~90% 절감
            system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
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

    // ── Fallback mock (AI 미설정/실패 시 — 업종 중립 + 힌트 반영) ──
    if (!result) {
      const photoCount = (photos || []).length;
      const topic = (workTopic || "").trim();
      const mockScenes: any[] = [];
      mockScenes.push({
        duration: 72, bg_type: "gradient", bg_colors: ["#0a1628", "#1a3a6a"],
        badge: location || "오늘의 현장",
        title: topic || companyName || "작업 리포트",
        subtitle: businessLabel || "정성을 담은 한 컷",
        accent_color: "#237FFF",
        animation: "slide_up", photo: null,
        narration: topic
          ? `오늘은 ${topic}입니다.`
          : `${companyName || "우리 가게"}의 작업을 소개합니다.`,
      });
      for (let i = 0; i < photoCount; i++) {
        mockScenes.push({
          duration: 84, bg_type: "photo", bg_colors: ["#001130", "#0d2847"],
          badge: `${i + 1}`,
          title: i === 0 ? "시작" : i === photoCount - 1 ? "완성" : "진행 중",
          subtitle: i === 0 ? "꼼꼼한 준비" : i === photoCount - 1 ? "완벽한 결과" : "한 걸음씩 정성껏",
          accent_color: i % 2 === 0 ? "#237FFF" : "#AB5EBE",
          animation: animations[i % 4],
          photo: `photo_${i + 1}`,
          narration:
            i === 0
              ? "준비부터 정성껏."
              : i === photoCount - 1
                ? "만족스러운 마무리."
                : "작업을 이어갑니다.",
        });
      }
      mockScenes.push({
        duration: 72, bg_type: "gradient", bg_colors: ["#0d2847", "#1a3a6a"],
        badge: "결과", title: "기대 이상의 마무리",
        subtitle: "매 순간 최선을", accent_color: "#AB5EBE",
        animation: "zoom_in", photo: null,
        narration: "정성껏 완성했습니다.",
      });
      mockScenes.push({
        duration: 84, bg_type: "gradient", bg_colors: ["#001130", "#0a2a5a"],
        badge: "문의 · 예약", title: companyName || "SMS",
        subtitle: phoneNumber || "연락 주세요", accent_color: "#237FFF",
        animation: "fade_in", photo: null,
        narration: `${companyName || "우리 가게"}로 편하게 연락 주세요.`,
      });
      result = { scenes: mockScenes, isMock: true };
    }

    // ── Step 2: ElevenLabs 나레이션 (씬별 격리 + 재시도 + 부분 실패 허용) ──
    // Promise.allSettled로 한 씬이 실패해도 다른 씬에 영향 없음.
    // 재시도 포함해도 최종 실패한 씬은 failedScenes에 기록해 클라이언트가 경고/진행 선택.
    // 모든 시도가 실패한 경우에만 500으로 차단.
    const scenes: any[] = result.scenes || [];
    const narrationAudios: (string | null)[] = new Array(scenes.length).fill(null);
    const failedScenes: number[] = [];

    if (ELEVENLABS_API_KEY && narrationType !== "없음") {
      console.log(
        `ElevenLabs TTS 병렬 시작 (allSettled + retry) — ${scenes.length}개 장면, voiceId: ${resolvedVoiceId}`
      );
      const t0 = Date.now();

      type NarrationResult = { idx: number; audio: string | null; skipped: boolean };
      const settled = await Promise.allSettled<NarrationResult>(
        scenes.map(async (scene, idx) => {
          const text = (scene.narration || "").trim();
          if (!text) return { idx, audio: null, skipped: true };
          const audio = await generateNarrationWithRetry(text, ELEVENLABS_API_KEY, resolvedVoiceId, 2);
          return { idx, audio, skipped: false };
        })
      );

      let attemptedCount = 0;
      settled.forEach((r, i) => {
        if (r.status === "fulfilled") {
          narrationAudios[i] = r.value.audio;
          if (!r.value.skipped) {
            attemptedCount++;
            if (!r.value.audio) failedScenes.push(i);
          }
        } else {
          attemptedCount++;
          failedScenes.push(i);
          const reason = (r as PromiseRejectedResult).reason;
          console.error(
            `[ElevenLabs] scene ${i} 최종 예외:`,
            reason instanceof Error ? reason.message : reason
          );
        }
      });

      const successCount = narrationAudios.filter(Boolean).length;

      // 하나도 성공하지 못한 경우에만 500 (부분 실패는 허용)
      if (attemptedCount > 0 && successCount === 0) {
        console.error(`ElevenLabs 전체 실패 — ${attemptedCount}개 씬 모두 실패`);
        void logUsage({
          user_id: ctx.userId,
          fn_name: "generate-shorts",
          status: "error",
          origin: ctx.origin,
          extra: {
            message: "elevenlabs_all_failed",
            attempted: attemptedCount,
            sceneCount: scenes.length,
          },
        });
        return new Response(
          JSON.stringify({
            error: "나레이션 음성 생성에 전부 실패했습니다. 잠시 후 다시 시도해주세요.",
            failedScenes,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(
        `ElevenLabs TTS 완료 — 성공 ${successCount}/${scenes.length}, 실패 씬 [${failedScenes.join(",")}] (${Date.now() - t0}ms)`
      );
    }

    void logUsage({
      user_id: ctx.userId,
      fn_name: "generate-shorts",
      status: "ok",
      origin: ctx.origin,
      extra: {
        sceneCount: scenes.length,
        failedSceneCount: failedScenes.length,
        scriptMode: scriptMode || "ai",
        videoStyle,
        narrationType,
        isMock: !!result.isMock,
      },
    });

    return new Response(
      JSON.stringify({ ...result, narrationAudios, failedScenes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      JSON.stringify({ error: e instanceof Error ? e.message : "다시 시도해 주세요" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));

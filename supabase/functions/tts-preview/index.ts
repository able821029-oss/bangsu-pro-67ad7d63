import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withGuard, CORS_HEADERS, logUsage } from "../_shared/guard.ts";

const corsHeaders = CORS_HEADERS;

const VOICE_MAP: Record<string, string> = {
  "male_calm": "nPczCjzI2devNBz1zQrb",
  "male_pro": "N2lVS1w4EtoT3dr4eOWO",
  "male_strong": "TX3LPaxmHKxFdv7VOQHJ",
  "female_friendly": "EXAVITQu4vr4xnSDxMaL",
  "female_pro": "XrExE9yKIg1WjnnlVkGX",
  "female_bright": "pFZP5JQG7iQjIQuC4Bku",
};

// 공개 TTS 미리듣기 — Origin 검증 + 60초에 60회 rate limit (가벼움)
serve(withGuard({ fn: "tts-preview", limit: 60, windowSec: 60 }, async (req, ctx) => {
  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      void logUsage({
        user_id: ctx.userId,
        fn_name: "tts-preview",
        status: "error",
        origin: ctx.origin,
        extra: { message: "api_key_missing" },
      });
      return new Response(JSON.stringify({ error: "API key missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { voiceId, text } = await req.json();
    const resolvedVoiceId = VOICE_MAP[voiceId] || voiceId || VOICE_MAP.male_calm;
    const safeText = (text || "안녕하세요").slice(0, 100); // 최대 100자 제한

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: safeText,
          // 미리듣기·실제 나레이션 모두 flash_v2_5로 통일해 음색 일치 + 속도 최적
          model_id: "eleven_flash_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true, speed: 0.8 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      void logUsage({
        user_id: ctx.userId,
        fn_name: "tts-preview",
        status: "error",
        origin: ctx.origin,
        extra: { message: `elevenlabs_${res.status}`, voiceId: resolvedVoiceId },
      });
      return new Response(JSON.stringify({ error: `ElevenLabs ${res.status}`, detail: errText.slice(0, 200) }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // base64로 인코딩해서 JSON으로 반환 (CORS 문제 없이 오디오 전달)
    const audioBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(audioBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    void logUsage({
      user_id: ctx.userId,
      fn_name: "tts-preview",
      status: "ok",
      origin: ctx.origin,
      extra: { voiceId: resolvedVoiceId, textLen: safeText.length, audioBytes: audioBuffer.byteLength },
    });

    return new Response(JSON.stringify({ ok: true, audio: base64 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    void logUsage({
      user_id: ctx.userId,
      fn_name: "tts-preview",
      status: "error",
      origin: ctx.origin,
      extra: { message: e instanceof Error ? e.message : "unknown" },
    });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "오류" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));

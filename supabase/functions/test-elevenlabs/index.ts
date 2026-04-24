import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withGuard, CORS_HEADERS, logUsage } from "../_shared/guard.ts";

const corsHeaders = CORS_HEADERS;

// 관리자 키 검증 도구 — Origin 검증 + 60초에 10회 rate limit
serve(withGuard({ fn: "test-elevenlabs", limit: 10, windowSec: 60 }, async (req, ctx) => {
  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      void logUsage({
        user_id: ctx.userId,
        fn_name: "test-elevenlabs",
        status: "error",
        origin: ctx.origin,
        extra: { message: "api_key_missing" },
      });
      return new Response(
        JSON.stringify({ ok: false, error: "ELEVENLABS_API_KEY 미설정" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 초소형 TTS 호출로 키 유효성 확인 (1단어, ~1초)
    const res = await fetch(
      "https://api.elevenlabs.io/v1/text-to-speech/nPczCjzI2devNBz1zQrb",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: "테스트",
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      void logUsage({
        user_id: ctx.userId,
        fn_name: "test-elevenlabs",
        status: "error",
        origin: ctx.origin,
        extra: { message: `elevenlabs_${res.status}`, detail: text.slice(0, 200) },
      });
      return new Response(
        JSON.stringify({ ok: false, error: `ElevenLabs ${res.status}: ${text.slice(0, 100)}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    void logUsage({
      user_id: ctx.userId,
      fn_name: "test-elevenlabs",
      status: "ok",
      origin: ctx.origin,
      extra: { audioBytes: audioBuffer.byteLength },
    });
    return new Response(
      JSON.stringify({
        ok: true,
        audioBytes: audioBuffer.byteLength,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    void logUsage({
      user_id: ctx.userId,
      fn_name: "test-elevenlabs",
      status: "error",
      origin: ctx.origin,
      extra: { message: e instanceof Error ? e.message : "unknown" },
    });
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "오류" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
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
      return new Response(
        JSON.stringify({ ok: false, error: `ElevenLabs ${res.status}: ${text.slice(0, 100)}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new Response(
      JSON.stringify({
        ok: true,
        audioBytes: audioBuffer.byteLength,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "오류" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

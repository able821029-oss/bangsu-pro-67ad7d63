import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
  delay = 1500,
): Promise<Response> {
  const response = await fetch(url, options);
  if (response.status === 429 && retries > 0) {
    console.warn(`Rate limited. Retrying in ${delay}ms... (${retries} left)`);
    await new Promise((r) => setTimeout(r, delay));
    return fetchWithRetry(url, options, retries - 1, delay * 2);
  }
  return response;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY가 설정되지 않았습니다" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, voiceId, mode } = await req.json();

    if (!text || !voiceId) {
      return new Response(JSON.stringify({ error: "text와 voiceId가 필요합니다" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const modelId = mode === "preview" ? "eleven_turbo_v2_5" : "eleven_multilingual_v2";

    const response = await fetchWithRetry(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
            speed: 0.9,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs error:", response.status, errText);

      let userMessage: string;
      switch (response.status) {
        case 401:
          userMessage = "API 키가 유효하지 않습니다. ElevenLabs 대시보드에서 키를 확인해 주세요.";
          break;
        case 402:
          userMessage = "ElevenLabs 유료 플랜이 필요합니다. 무료 플랜에서는 라이브러리 목소리를 API로 사용할 수 없습니다.";
          break;
        case 429:
          userMessage = "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
          break;
        default:
          userMessage = `ElevenLabs 오류 (${response.status})`;
      }

      return new Response(JSON.stringify({ error: userMessage, status: response.status }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = base64Encode(audioBuffer);

    return new Response(JSON.stringify({ audioContent: base64Audio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("elevenlabs-tts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "TTS 오류" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

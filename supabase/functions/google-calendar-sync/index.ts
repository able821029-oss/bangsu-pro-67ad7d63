import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials not configured");
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await resp.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "유효하지 않은 토큰" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, title, schedule_date, schedule_time, memo, location, google_event_id } = body;

    // Get user's refresh token
    const { data: profile } = await supabase
      .from("profiles")
      .select("google_refresh_token")
      .eq("user_id", user.id)
      .single();

    if (!profile?.google_refresh_token) {
      return new Response(JSON.stringify({ error: "구글 캘린더가 연동되지 않았습니다", synced: false }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await refreshAccessToken(profile.google_refresh_token);

    // Build event
    const startDateTime = schedule_time
      ? `${schedule_date}T${schedule_time}:00+09:00`
      : null;
    const endDateTime = schedule_time
      ? `${schedule_date}T${schedule_time.split(":").map((v: string, i: number) => i === 0 ? String(Number(v) + 1).padStart(2, "0") : v).join(":")}:00+09:00`
      : null;

    const event: Record<string, unknown> = {
      summary: title,
      description: memo || "",
      location: location || "",
    };

    if (startDateTime && endDateTime) {
      event.start = { dateTime: startDateTime, timeZone: "Asia/Seoul" };
      event.end = { dateTime: endDateTime, timeZone: "Asia/Seoul" };
    } else {
      event.start = { date: schedule_date };
      event.end = { date: schedule_date };
    }

    let result;
    if (action === "update" && google_event_id) {
      result = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${google_event_id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
    } else if (action === "delete" && google_event_id) {
      result = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${google_event_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } else {
      result = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
    }

    if (!result.ok && action !== "delete") {
      const errText = await result.text();
      console.error("Google Calendar API error:", errText);
      return new Response(JSON.stringify({ error: "캘린더 동기화 실패", synced: false }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let googleEventId = google_event_id;
    if (action !== "delete" && result.ok) {
      const eventData = await result.json();
      googleEventId = eventData.id;
    }

    return new Response(JSON.stringify({ success: true, synced: true, google_event_id: googleEventId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: unknown) {
    console.error("google-calendar-sync error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "오류 발생", synced: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

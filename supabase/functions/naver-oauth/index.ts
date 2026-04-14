import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 네이버 OAuth 콜백 핸들러
 *
 * 흐름:
 * 1) 프론트엔드가 /auth/naver/callback?code=XXX&state=YYY 로 돌아옴
 * 2) 프론트엔드가 이 Edge Function에 code, state 전달 (POST)
 * 3) Edge Function이 네이버 API로 access_token 교환
 * 4) access_token으로 네이버 사용자 정보 조회
 * 5) Supabase admin API로 사용자 upsert + 세션 토큰 반환
 * 6) 프론트엔드가 setSession으로 로그인 완료
 *
 * 필수 Supabase Edge Function secrets:
 *   NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 *   SUPABASE_URL (자동), SUPABASE_SERVICE_ROLE_KEY (자동)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, state } = await req.json();
    if (!code || !state) {
      return json({ error: "code, state 필수" }, 400);
    }

    const NAVER_CLIENT_ID = Deno.env.get("NAVER_CLIENT_ID");
    const NAVER_CLIENT_SECRET = Deno.env.get("NAVER_CLIENT_SECRET");
    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      return json({ error: "네이버 클라이언트 설정 누락" }, 500);
    }

    // ── Step 1: code → access_token 교환 ──
    const tokenRes = await fetch(
      `https://nid.naver.com/oauth2.0/token?` +
        `grant_type=authorization_code` +
        `&client_id=${NAVER_CLIENT_ID}` +
        `&client_secret=${NAVER_CLIENT_SECRET}` +
        `&code=${code}` +
        `&state=${state}`
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error("[Naver] token exchange failed:", tokenData);
      return json({ error: "네이버 토큰 교환 실패", detail: tokenData }, 400);
    }

    // ── Step 2: access_token → 네이버 프로필 조회 ──
    const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profileData = await profileRes.json();
    if (profileData.resultcode !== "00") {
      console.error("[Naver] profile fetch failed:", profileData);
      return json({ error: "네이버 프로필 조회 실패" }, 400);
    }
    const naverUser = profileData.response;
    const email = naverUser.email;
    const name = naverUser.name || naverUser.nickname || "";
    if (!email) {
      return json(
        {
          error:
            "네이버 계정 이메일을 가져올 수 없습니다. 네이버 개발자센터에서 '이메일' 필수 제공항목을 체크했는지 확인해 주세요.",
        },
        400
      );
    }

    // ── Step 3: Supabase admin으로 사용자 upsert + 매직 링크 ──
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 기존 사용자 조회
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existing?.users?.find((u) => u.email === email);

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
      // provider 메타데이터 업데이트
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: { ...existingUser.app_metadata, provider: "naver" },
        user_metadata: { ...existingUser.user_metadata, full_name: name },
      });
    } else {
      // 신규 가입
      const { data: created, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true, // 네이버는 이메일 검증된 것으로 간주
          user_metadata: { full_name: name, provider: "naver" },
          app_metadata: { provider: "naver" },
        });
      if (createErr || !created?.user) {
        return json({ error: "사용자 생성 실패", detail: createErr?.message }, 500);
      }
      userId = created.user.id;
    }

    // ── Step 4: 매직 링크 생성 (프론트에서 setSession으로 사용) ──
    const { data: linkData, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
    if (linkErr || !linkData?.properties) {
      return json({ error: "세션 생성 실패", detail: linkErr?.message }, 500);
    }

    // 프론트엔드는 action_link의 token_hash를 사용해서 verifyOtp로 세션 확보
    return json({
      ok: true,
      email,
      name,
      userId,
      token_hash: linkData.properties.hashed_token,
      action_link: linkData.properties.action_link,
    });
  } catch (e) {
    console.error("[naver-oauth]", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

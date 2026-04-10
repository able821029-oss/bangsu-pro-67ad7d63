import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, newPassword } = await req.json();

    if (!email || !newPassword) {
      return new Response(JSON.stringify({ error: "이메일과 새 비밀번호를 입력해주세요" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ error: "비밀번호는 6자 이상이어야 합니다" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    // 이메일로 사용자 조회
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw listErr;

    const user = users.find(u => u.email === email);
    if (!user) {
      return new Response(JSON.stringify({ error: "등록되지 않은 이메일입니다" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 비밀번호 변경
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reset-password error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "오류 발생" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

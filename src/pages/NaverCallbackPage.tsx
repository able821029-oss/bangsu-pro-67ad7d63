import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * 네이버 OAuth 콜백 페이지
 * URL: /auth/naver/callback?code=XXX&state=YYY
 *
 * 흐름:
 * 1) URL에서 code, state 추출
 * 2) sessionStorage의 state와 비교 (CSRF 방어)
 * 3) naver-oauth Edge Function 호출 → token_hash 수신
 * 4) supabase.auth.verifyOtp로 세션 생성
 * 5) 성공 시 홈으로 이동
 */
export default function NaverCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("네이버 로그인 처리 중...");

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state");
        const error = params.get("error");

        if (error) {
          setStatus("error");
          setMessage("네이버 로그인이 취소되었습니다.");
          return;
        }
        if (!code || !state) {
          setStatus("error");
          setMessage("인증 코드가 없습니다. 다시 시도해 주세요.");
          return;
        }

        // CSRF 방어 — state 검증
        const savedState = sessionStorage.getItem("naver_oauth_state");
        if (savedState !== state) {
          setStatus("error");
          setMessage("보안 검증 실패. 다시 시도해 주세요.");
          return;
        }
        sessionStorage.removeItem("naver_oauth_state");

        // Edge Function 호출
        setMessage("네이버 계정 정보를 확인하는 중...");
        const { data, error: fnErr } = await supabase.functions.invoke("naver-oauth", {
          body: { code, state },
        });

        if (fnErr || !data?.ok) {
          setStatus("error");
          setMessage(data?.error || fnErr?.message || "네이버 로그인 실패");
          return;
        }

        // 매직링크 token_hash로 세션 생성
        setMessage("로그인 중...");
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          type: "magiclink",
          token_hash: data.token_hash,
        });

        if (verifyErr) {
          setStatus("error");
          setMessage("세션 생성 실패: " + verifyErr.message);
          return;
        }

        setStatus("success");
        setMessage("로그인 성공! 잠시 후 이동합니다.");
        setTimeout(() => {
          window.location.href = "/";
        }, 800);
      } catch (e) {
        console.error("[Naver Callback]", e);
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "알 수 없는 오류");
      }
    })();
  }, []);

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center px-6"
      style={{ minHeight: "100dvh" }}
    >
      <div className="max-w-sm w-full text-center space-y-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
          style={{
            background:
              status === "success"
                ? "rgba(34,197,94,0.15)"
                : status === "error"
                  ? "rgba(239,68,68,0.15)"
                  : "rgba(35,127,255,0.15)",
          }}
        >
          {status === "loading" && (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          )}
          {status === "success" && (
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          )}
          {status === "error" && (
            <AlertTriangle className="w-8 h-8 text-red-400" />
          )}
        </div>
        <h2 className="text-lg font-bold">
          {status === "success"
            ? "로그인 완료"
            : status === "error"
              ? "로그인 실패"
              : "네이버 로그인"}
        </h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        {status === "error" && (
          <button
            onClick={() => (window.location.href = "/")}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
          >
            로그인 화면으로 돌아가기
          </button>
        )}
      </div>
    </div>
  );
}

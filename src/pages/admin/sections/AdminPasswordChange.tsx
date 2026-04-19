import { ShieldCheck } from "lucide-react";

/**
 * 관리자 비밀번호 변경 — 지원 중단 안내 화면.
 *
 * 인증은 2026-04-19부터 Supabase `profiles.is_admin` 서버 측 플래그로 전환되었으며,
 * 관리자 계정의 "비밀번호"는 메인 로그인(Phone OTP 등)에서 관리됩니다.
 */
export function AdminPasswordChange() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" /> 관리자 인증 안내
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          관리자 권한은 Supabase <code className="px-1 py-0.5 bg-muted rounded text-xs">profiles.is_admin</code> 플래그로 제어됩니다.
        </p>
      </div>

      <div className="glass-card p-5 space-y-3 max-w-md">
        <p className="text-sm text-foreground font-semibold">관리자 부여 방법</p>
        <ol className="text-xs text-muted-foreground space-y-2 list-decimal pl-4">
          <li>대상 사용자가 앱에서 메인 로그인(Phone OTP/이메일)을 1회 완료</li>
          <li>Supabase SQL Editor에서 실행:<br/>
            <code className="block mt-1 px-2 py-1.5 bg-background/60 rounded text-[11px] break-all">
              UPDATE public.profiles SET is_admin = true WHERE user_id = &lt;대상 user_id&gt;;
            </code>
          </li>
          <li>해당 사용자가 앱에서 <code className="px-1 bg-muted rounded">#/admin</code> 접근 시 자동으로 대시보드가 열립니다</li>
        </ol>
        <p className="text-[11px] text-muted-foreground pt-2 border-t border-white/5">
          기존 <code className="px-1 bg-muted rounded">VITE_ADMIN_ID</code> / <code className="px-1 bg-muted rounded">VITE_ADMIN_PW</code> 환경변수는 더 이상 사용되지 않습니다 (클라이언트 번들 노출 이슈로 제거됨).
        </p>
      </div>
    </div>
  );
}

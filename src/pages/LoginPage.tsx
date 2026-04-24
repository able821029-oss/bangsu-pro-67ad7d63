import AuthPage from "@/pages/AuthPage";

/**
 * SMS 로그인 페이지 — 이메일 · 비밀번호 일반 로그인.
 *
 * Supabase Email provider는 기본 활성화되어 추가 대시보드 설정이 필요하지 않다.
 * 실제 인증 화면은 AuthPage가 담당하며, 이 컴포넌트는 라우팅상의 진입점일 뿐이다.
 */
export function LoginPage() {
  return <AuthPage />;
}

export default LoginPage;

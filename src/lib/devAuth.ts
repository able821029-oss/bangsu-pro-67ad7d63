/**
 * Dev Test Mode — Supabase 인증 우회
 *
 * localhost에서만 작동. SMS OTP / 이메일 로그인 설정 없이도
 * 내부 화면을 테스트할 수 있도록 가짜 세션을 localStorage에 심는다.
 *
 * 프로덕션 빌드(import.meta.env.PROD)에서는 강제로 비활성화된다.
 */

const FLAG_KEY = "sms_dev_test_mode";

export function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h.startsWith("192.168.") || h.startsWith("172.");
}

export function isDevModeAllowed(): boolean {
  // 프로덕션 빌드에서는 무조건 비활성화
  if (import.meta.env.PROD) return false;
  return isLocalHost();
}

export function isDevModeActive(): boolean {
  if (!isDevModeAllowed()) return false;
  try {
    return localStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function enableDevMode(): void {
  if (!isDevModeAllowed()) return;
  try {
    localStorage.setItem(FLAG_KEY, "1");
  } catch {
    // ignore
  }
}

export function disableDevMode(): void {
  try {
    localStorage.removeItem(FLAG_KEY);
  } catch {
    // ignore
  }
}

/** AuthProvider가 실제 Supabase user 대신 주입할 가짜 사용자 */
export const DEV_USER = {
  id: "dev-test-user-00000000-0000-0000-0000-000000000000",
  email: "dev@sms.local",
  phone: "",
  app_metadata: {},
  user_metadata: { full_name: "테스트 사용자" },
  aud: "authenticated",
  role: "authenticated",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as const;

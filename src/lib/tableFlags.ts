/**
 * Supabase 테이블 존재 여부 플래그 (localStorage 기반, 24시간 TTL)
 *
 * 마이그레이션 미실행 환경에서 테이블이 없는데도 계속 REST 호출을 시도하면
 * 브라우저 콘솔에 'Failed to load resource 404'가 반복 노출된다.
 * DevTools의 네트워크 기록은 JS로 억제 불가이므로 **애초에 요청을 안 보내는** 방법이 유일.
 *
 * - 요청 1회 시도 후 테이블 부재 확인되면 플래그 저장 → 이후 24시간 동안 skip
 * - TTL 만료되면 다시 확인 (DB 관리자가 테이블 만들었을 수 있으므로)
 */

const TTL_MS = 24 * 60 * 60 * 1000; // 24시간

function storageKey(table: string): string {
  return `sms_table_missing_${table}`;
}

export function isTableKnownMissing(table: string): boolean {
  try {
    const raw = localStorage.getItem(storageKey(table));
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    if (Date.now() - ts > TTL_MS) {
      // TTL 만료 — 다시 확인할 수 있도록 플래그 제거
      localStorage.removeItem(storageKey(table));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function markTableMissing(table: string): void {
  try {
    localStorage.setItem(storageKey(table), String(Date.now()));
  } catch {
    // localStorage 사용 불가 환경 (iframe 등) — 무시
  }
}

export function clearTableMissing(table: string): void {
  try {
    localStorage.removeItem(storageKey(table));
  } catch {
    // ignore
  }
}

/**
 * PostgREST/Supabase의 "테이블 없음" 에러 매칭
 */
export function isTableMissingError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message || "";
  return (
    msg.includes("does not exist") ||
    msg.includes("Could not find the table") ||
    msg.includes("PGRST106") ||
    error.code === "PGRST106" ||
    error.code === "42P01"
  );
}

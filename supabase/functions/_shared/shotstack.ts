// Shotstack 환경 설정 단일 출처
// generate-shorts, generate-shorts-status, admin/test-tools 등에서 import 해서 사용.
//
// 환경변수:
//   - SHOTSTACK_API_KEY (필수)            : Shotstack 발급 API 키
//   - SHOTSTACK_HOST    (선택, 기본 stage): 정식 호스트 URL
//                                            stage:  https://api.shotstack.io/edit/stage  (무료, 워터마크)
//                                            prod :  https://api.shotstack.io/edit/v1     (유료, 워터마크 없음)
//
// 운영 전환 절차:
//   1. shotstack.io 에서 유료 플랜 결제 → Production API Key 발급
//   2. Supabase Secrets 에 두 값 등록:
//        SHOTSTACK_API_KEY = <prod 키>
//        SHOTSTACK_HOST    = https://api.shotstack.io/edit/v1
//   3. Edge Function 재배포 불필요 (env 즉시 반영)

export type ShotstackMode = "stage" | "prod" | "custom";

export interface ShotstackConfig {
  readonly apiKey: string;
  readonly host: string; // 끝의 슬래시 제거된 정규화된 형태
  readonly mode: ShotstackMode;
}

const STAGE_HOST = "https://api.shotstack.io/edit/stage";
const PROD_HOST = "https://api.shotstack.io/edit/v1";

function detectMode(host: string): ShotstackMode {
  if (host === STAGE_HOST) return "stage";
  if (host === PROD_HOST) return "prod";
  return "custom";
}

/**
 * Shotstack 환경설정을 읽어서 반환.
 * API 키가 없으면 `null` 반환 — 호출부에서 500 에러 응답 처리.
 *
 * 첫 호출 시 mode/host 를 1회 로깅 (cold start 가시성).
 */
let _logged = false;
export function getShotstackConfig(): ShotstackConfig | null {
  const apiKey = Deno.env.get("SHOTSTACK_API_KEY");
  if (!apiKey) {
    if (!_logged) {
      console.error(
        "[shotstack] SHOTSTACK_API_KEY 가 설정되지 않았습니다. " +
          "Supabase Project Settings → Edge Functions → Secrets 확인.",
      );
      _logged = true;
    }
    return null;
  }

  const rawHost = Deno.env.get("SHOTSTACK_HOST") || STAGE_HOST;
  const host = rawHost.replace(/\/+$/, "");
  const mode = detectMode(host);

  if (!_logged) {
    if (mode === "stage") {
      console.warn(
        `[shotstack] mode=stage host=${host} — 영상에 워터마크가 표시됩니다. ` +
          "운영 전환 시 SHOTSTACK_HOST=https://api.shotstack.io/edit/v1 + prod 키로 교체.",
      );
    } else if (mode === "prod") {
      console.log(`[shotstack] mode=prod host=${host} — 워터마크 없음.`);
    } else {
      console.log(`[shotstack] mode=custom host=${host}`);
    }
    _logged = true;
  }

  return { apiKey, host, mode };
}

/** 키 유효성 빠른 확인 — 관리자 도구에서 호출. */
export async function pingShotstack(): Promise<{
  ok: boolean;
  status: number;
  mode: ShotstackMode;
  host: string;
  detail?: string;
}> {
  const cfg = getShotstackConfig();
  if (!cfg) {
    return { ok: false, status: 0, mode: "stage", host: STAGE_HOST, detail: "SHOTSTACK_API_KEY 미설정" };
  }
  try {
    // probe: 존재하지 않는 renderId 조회 — 401/403 이면 키 문제, 404 이면 키는 valid
    const res = await fetch(`${cfg.host}/render/probe-${Date.now()}`, {
      method: "GET",
      headers: { "x-api-key": cfg.apiKey, Accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      const t = await res.text().catch(() => "");
      return { ok: false, status: res.status, mode: cfg.mode, host: cfg.host, detail: `인증 실패: ${t.slice(0, 120)}` };
    }
    // 200 또는 404 모두 키는 valid 상태로 간주
    return { ok: true, status: res.status, mode: cfg.mode, host: cfg.host };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      mode: cfg.mode,
      host: cfg.host,
      detail: e instanceof Error ? e.message : "네트워크 오류",
    };
  }
}

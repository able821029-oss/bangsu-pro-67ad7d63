// 회사 정보 단일 출처 (Single Source of Truth)
// 클라이언트로부터 사업자 정보 수령 후 이 파일만 수정하면
// 개인정보처리방침·이용약관·푸터·이메일 발신 등 전 영역에 즉시 반영됨.
//
// 빈 값(`""`) 항목은 출시 전 반드시 채워야 함.
// 환경변수 (`VITE_COMPANY_*`)가 있으면 빌드 시 우선 적용 — 다중 환경(dev/staging/prod) 지원용.

interface CustomerService {
  readonly email: string;
  readonly phone: string;
  readonly hours: string;
}

interface PrivacyOfficer {
  readonly name: string;
  readonly email: string;
}

interface AnalyticsToggles {
  readonly ga4: boolean;
  readonly clarity: boolean;
  readonly sentry: boolean;
}

export interface CompanyInfo {
  readonly legalName: string;
  readonly serviceName: string;
  readonly businessRegistrationNumber: string;
  readonly representativeName: string;
  readonly businessAddress: string;
  readonly ecommerceRegistrationNumber: string;
  readonly customerService: CustomerService;
  readonly privacyOfficer: PrivacyOfficer;
  readonly privacyPolicyEffectiveDate: string;
  readonly analytics: AnalyticsToggles;
}

const env = import.meta.env;

function pick(key: string, fallback: string): string {
  const value = (env as Record<string, string | undefined>)[key];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

export const COMPANY_INFO: CompanyInfo = {
  // 정식 상호 (사업자등록증 기재)
  legalName: pick("VITE_COMPANY_LEGAL_NAME", "SMS(셀프마케팅서비스)"),

  // 서비스 약식 명칭
  serviceName: pick("VITE_COMPANY_SERVICE_NAME", "SMS"),

  // 사업자등록번호 (하이픈 포함, 예: "123-45-67890")
  businessRegistrationNumber: pick(
    "VITE_COMPANY_BUSINESS_NUMBER",
    "[사업자등록번호 미등록]",
  ),

  // 대표자명
  representativeName: pick(
    "VITE_COMPANY_REPRESENTATIVE",
    "[대표자명 미등록]",
  ),

  // 사업장 주소 (도로명 주소 권장)
  businessAddress: pick(
    "VITE_COMPANY_ADDRESS",
    "[사업장 주소 미등록]",
  ),

  // 통신판매업 신고번호 (예: "제2026-서울강남-12345호")
  ecommerceRegistrationNumber: pick(
    "VITE_COMPANY_ECOMMERCE_NUMBER",
    "[통신판매업 신고번호 미등록]",
  ),

  customerService: {
    email: pick("VITE_COMPANY_CS_EMAIL", "support@sms-app.kr"),
    phone: pick("VITE_COMPANY_CS_PHONE", "[고객센터 전화 미등록]"),
    hours: pick(
      "VITE_COMPANY_CS_HOURS",
      "평일 10:00 ~ 18:00 (주말·공휴일 제외)",
    ),
  },

  privacyOfficer: {
    name: pick("VITE_COMPANY_PRIVACY_OFFICER_NAME", "SMS 운영팀"),
    email: pick(
      "VITE_COMPANY_PRIVACY_OFFICER_EMAIL",
      "support@sms-app.kr",
    ),
  },

  privacyPolicyEffectiveDate: pick(
    "VITE_PRIVACY_POLICY_EFFECTIVE_DATE",
    "2026년 4월 25일",
  ),

  // 분석 도구 사용 여부 — 해당 키가 .env에 등록되어 있으면 자동 true
  analytics: {
    ga4: Boolean(env.VITE_GA_ID && env.VITE_GA_ID.trim() !== ""),
    clarity: Boolean(env.VITE_CLARITY_ID && env.VITE_CLARITY_ID.trim() !== ""),
    sentry: Boolean(env.VITE_SENTRY_DSN && env.VITE_SENTRY_DSN.trim() !== ""),
  },
};

// 출시 전 누락 정보 자가 진단 — 콘솔 경고 출력 (개발 모드)
export function getMissingCompanyFields(): string[] {
  const missing: string[] = [];
  if (COMPANY_INFO.businessRegistrationNumber.startsWith("[")) {
    missing.push("사업자등록번호");
  }
  if (COMPANY_INFO.representativeName.startsWith("[")) {
    missing.push("대표자명");
  }
  if (COMPANY_INFO.businessAddress.startsWith("[")) {
    missing.push("사업장 주소");
  }
  if (COMPANY_INFO.ecommerceRegistrationNumber.startsWith("[")) {
    missing.push("통신판매업 신고번호");
  }
  if (COMPANY_INFO.customerService.phone.startsWith("[")) {
    missing.push("고객센터 전화번호");
  }
  return missing;
}

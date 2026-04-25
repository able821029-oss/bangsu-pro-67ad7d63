// 개인정보처리방침 — 한국 개인정보보호법 표준 양식 기반.
// 2026-04-25 출시 준비.
// 회사 정보 / 처리 위탁 항목은 실제 법인 등록 후 갱신 필요.

import { ArrowLeft } from "lucide-react";

export function PrivacyPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="pb-24 max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="뒤로가기"
          className="p-2 -ml-2 rounded-lg hover:bg-secondary"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">개인정보처리방침</h1>
      </div>

      <div className="px-4 pt-4 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <p className="text-foreground">
          SMS(셀프마케팅서비스, 이하 "회사")는 「개인정보 보호법」 등 관련 법령을
          준수하며, 이용자의 개인정보를 안전하게 보호하기 위해 최선을 다합니다.
          본 개인정보처리방침은 회사가 운영하는 SMS 모바일 앱 서비스(이하
          "서비스")에 적용됩니다.
        </p>

        <Section title="1. 수집하는 개인정보 항목 및 수집 방법">
          <p className="font-semibold text-foreground">가. 회원가입 시</p>
          <p>이메일 주소, 비밀번호(암호화 저장)</p>

          <p className="font-semibold text-foreground mt-3">나. 서비스 이용 중</p>
          <p>업체명, 대표 전화번호, 활동 지역, 업체 로고·대표 사진, 작업 사진,
            작성한 블로그·영상 콘텐츠</p>

          <p className="font-semibold text-foreground mt-3">다. 자동 수집</p>
          <p>IP 주소, 브라우저·기기 정보, 쿠키, 서비스 이용 기록(접속 시각, 사용
            기능, 오류 로그)</p>

          <p className="font-semibold text-foreground mt-3">라. 결제 시 (유료
            플랜 가입자)</p>
          <p>결제 수단 정보(카드사 명의·번호 일부 등)는 결제 대행사(카카오페이·토스페이먼츠)가 직접 처리하며 회사는 보유하지 않습니다.</p>
        </Section>

        <Section title="2. 개인정보 수집·이용 목적">
          <List
            items={[
              "회원 가입 의사 확인, 본인 식별, 부정 이용 방지",
              "서비스 제공 (블로그·영상 자동 생성, 일정 관리, 발행 보조)",
              "유료 결제 처리 및 영수증 발급",
              "고객 문의 응답, 공지사항 전달",
              "서비스 개선을 위한 통계 분석, 신규 기능 개발",
              "법령상 의무 이행 (전자상거래법, 통신비밀보호법 등)",
            ]}
          />
        </Section>

        <Section title="3. 개인정보의 보유 및 이용 기간">
          <p>회원 탈퇴 시 즉시 파기합니다. 단, 다음 정보는 관련 법령에 따라 일정
            기간 보관합니다.</p>
          <List
            items={[
              "계약·청약 철회 기록: 5년 (전자상거래법)",
              "대금 결제·재화 공급 기록: 5년 (전자상거래법)",
              "소비자 불만·분쟁 처리 기록: 3년 (전자상거래법)",
              "접속 로그 기록: 3개월 (통신비밀보호법)",
            ]}
          />
        </Section>

        <Section title="4. 개인정보의 제3자 제공">
          <p>회사는 이용자의 개인정보를 외부에 제공하지 않습니다. 단, 이용자가
            동의했거나 법령에 의해 요구되는 경우는 예외로 합니다.</p>
        </Section>

        <Section title="5. 개인정보 처리 위탁">
          <p>회사는 서비스 운영을 위해 다음 업체에 개인정보 처리를 위탁합니다.
            모든 위탁사는 개인정보 보호 의무를 계약으로 부담합니다.</p>
          <div className="mt-2 space-y-2">
            <ProcessorRow
              name="Supabase Inc. (미국)"
              purpose="회원 인증·데이터베이스·파일 저장"
            />
            <ProcessorRow
              name="Anthropic, PBC (미국)"
              purpose="AI 블로그·SEO 분석 (Claude API)"
            />
            <ProcessorRow
              name="ElevenLabs Inc. (미국)"
              purpose="쇼츠 영상 음성 합성 (TTS)"
            />
            <ProcessorRow
              name="Shotstack Pty Ltd. (호주)"
              purpose="쇼츠 영상 클라우드 렌더링"
            />
            <ProcessorRow
              name="Google LLC (미국)"
              purpose="AI 보조 (Gemini API), 일정 연동(선택)"
            />
            <ProcessorRow
              name="Cloudflare, Inc. (미국)"
              purpose="웹앱 호스팅·전송"
            />
            <ProcessorRow
              name="카카오페이·토스페이먼츠 (한국)"
              purpose="결제 처리"
            />
          </div>
        </Section>

        <Section title="6. 정보주체의 권리·의무 및 행사 방법">
          <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
          <List
            items={[
              "개인정보 열람 요구",
              "개인정보 정정·삭제 요구",
              "개인정보 처리정지 요구",
              "회원 탈퇴 (마이페이지 → 앱 설정에서 직접 처리 가능)",
            ]}
          />
          <p className="mt-2">권리 행사는 마이페이지의 해당 기능을 이용하거나
            아래 개인정보 보호책임자에게 이메일로 요청할 수 있습니다.</p>
        </Section>

        <Section title="7. 개인정보의 안전성 확보 조치">
          <List
            items={[
              "비밀번호 단방향 암호화 저장 (Supabase Auth)",
              "전송 구간 HTTPS 전 구간 암호화 (HSTS preload)",
              "데이터베이스 행 단위 접근 제어(Row Level Security)",
              "서비스 함수 접근 토큰 분리 및 정기 갱신",
              "관리자 접근 로그 보관 및 이상 행위 모니터링",
            ]}
          />
        </Section>

        <Section title="8. 쿠키·자동수집 도구의 운영">
          <p>회사는 서비스 품질 분석을 위해 다음 도구를 사용합니다. 이용자는
            브라우저 설정에서 쿠키를 거부하거나 삭제할 수 있으며, 이 경우 일부
            기능이 제한될 수 있습니다.</p>
          <List
            items={[
              "Google Analytics 4 — 페이지 방문·행동 통계",
              "Microsoft Clarity — 익명 사용자 행동 분석",
              "Sentry — 오류 추적(개인정보 마스킹)",
            ]}
          />
        </Section>

        <Section title="9. 개인정보 보호책임자">
          <div className="rounded-lg border border-border p-3 space-y-1 text-foreground">
            <p>책임자: SMS 운영팀</p>
            <p>이메일: support@sms-app.kr</p>
          </div>
          <p className="mt-2">개인정보 침해에 대한 신고나 상담이 필요하신 경우
            아래 기관에 문의하실 수 있습니다.</p>
          <List
            items={[
              "개인정보분쟁조정위원회 (1833-6972 / kopico.go.kr)",
              "개인정보침해신고센터 (118 / privacy.kisa.or.kr)",
              "대검찰청 사이버수사과 (1301 / spo.go.kr)",
              "경찰청 사이버수사국 (182 / ecrm.cyber.go.kr)",
            ]}
          />
        </Section>

        <Section title="10. 처리방침의 변경">
          <p>본 방침은 법령·정책 또는 보안 기술의 변경에 따라 내용 추가·삭제·수정이
            있을 수 있으며, 변경 시 시행 7일 전부터 서비스 내 공지사항을 통해
            안내합니다.</p>
        </Section>

        <div className="border-t border-border pt-4">
          <p className="text-xs">시행일: 2026년 4월 25일</p>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-bold text-foreground mb-2">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 list-disc list-inside marker:text-muted-foreground/60">
      {items.map((item, i) => (
        <li key={i} className="leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  );
}

function ProcessorRow({ name, purpose }: { name: string; purpose: string }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="font-semibold text-foreground min-w-[40%]">{name}</span>
      <span className="text-muted-foreground flex-1">{purpose}</span>
    </div>
  );
}

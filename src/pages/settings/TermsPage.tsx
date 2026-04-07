import { ArrowLeft } from "lucide-react";

export function TermsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="pb-24 max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">이용약관</h1>
      </div>
      <div className="px-4 pt-4 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <div>
          <p className="font-bold text-foreground mb-2">제1조 (목적)</p>
          <p>본 약관은 SMS(셀프마케팅서비스)가 제공하는 모바일 앱 서비스 이용에 관한 조건 및 절차, 이용자와 회사 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.</p>
        </div>
        <div>
          <p className="font-bold text-foreground mb-2">제2조 (서비스 이용)</p>
          <p>① 서비스는 만 14세 이상의 개인 또는 사업자가 이용할 수 있습니다.</p>
          <p className="mt-1">② 유료 서비스는 결제 완료 후 즉시 이용 가능합니다.</p>
          <p className="mt-1">③ 구독 서비스는 월 단위로 자동 갱신되며, 해지 시 해당 월 말일까지 이용 가능합니다.</p>
        </div>
        <div>
          <p className="font-bold text-foreground mb-2">제3조 (환불 정책)</p>
          <p>① 구독 시작일로부터 7일 이내에 서비스를 이용하지 않은 경우 전액 환불이 가능합니다.</p>
          <p className="mt-1">② 이용 내역이 있는 경우 환불이 제한될 수 있습니다.</p>
        </div>
        <div>
          <p className="font-bold text-foreground mb-2">제4조 (개인정보 보호)</p>
          <p>회사는 이용자의 개인정보를 관련 법령에 따라 안전하게 보호하며, 수집된 정보는 서비스 제공 목적 외에 사용하지 않습니다.</p>
        </div>
        <div>
          <p className="font-bold text-foreground mb-2">제5조 (서비스 변경 및 중단)</p>
          <p>회사는 서비스 개선을 위해 서비스 내용을 변경할 수 있으며, 변경 시 사전 공지합니다.</p>
        </div>
        <div>
          <p className="font-bold text-foreground mb-2">제6조 (금지 행위)</p>
          <p>이용자는 서비스를 통해 타인의 명예를 훼손하거나 불법 콘텐츠를 생성·배포해서는 안 됩니다.</p>
        </div>
        <div>
          <p className="font-bold text-foreground mb-2">제7조 (면책조항)</p>
          <p>회사는 천재지변, 시스템 장애 등 불가항력적인 사유로 서비스 제공이 불가한 경우 책임을 지지 않습니다.</p>
        </div>
        <div className="border-t border-border pt-4">
          <p className="text-xs">시행일: 2026년 1월 1일</p>
          <p className="text-xs mt-1">문의: support@sms-app.kr</p>
        </div>
      </div>
    </div>
  );
}

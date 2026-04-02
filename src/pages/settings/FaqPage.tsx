import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqCategories = [
  {
    title: "이용 방법",
    items: [
      { q: "사진은 몇 장까지 찍을 수 있나요?", a: "요금제에 따라 다릅니다. 무료 플랜은 2장, 베이직 5장, 프로/무제한 플랜은 최대 10장까지 촬영할 수 있습니다." },
      { q: "어떤 공사 유형을 지원하나요?", a: "옥상방수, 외벽방수, 지하방수, 균열보수, 욕실방수, 기타 등 6가지 유형을 지원합니다." },
      { q: "글이 마음에 안 들면 다시 쓸 수 있나요?", a: "네, 게시 탭에서 제목과 본문을 직접 수정하거나 AI 글쓰기를 다시 실행할 수 있습니다." },
    ],
  },
  {
    title: "업로드·SNS",
    items: [
      { q: "네이버 블로그에 자동으로 올라가나요?", a: "아니요. 2020년 5월 네이버가 API를 종료했습니다. 앱이 글을 복사하고 네이버 앱을 열어드리면 붙여넣기 후 직접 발행하셔야 합니다." },
      { q: "인스타그램·틱톡도 같은 방식인가요?", a: "네, 인스타그램과 틱톡도 반자동 방식입니다. 앱이 내용을 복사하고 해당 앱을 열어드립니다." },
    ],
  },
  {
    title: "요금제·결제",
    items: [
      { q: "무료로 먼저 써볼 수 있나요?", a: "네, 무료 플랜으로 월 5건까지 네이버 블로그 글을 작성할 수 있습니다." },
      { q: "연간 결제와 월 결제 차이는?", a: "연간 결제 시 2개월 무료 혜택이 적용되어 10개월 가격으로 12개월 이용이 가능합니다." },
      { q: "환불은 어떻게 하나요?", a: "결제일로부터 7일 이내 미사용 시 전액 환불이 가능합니다. 설정 > 문의하기에서 요청해주세요." },
    ],
  },
  {
    title: "쿠폰·소개",
    items: [
      { q: "지인 소개 혜택은 언제 적용되나요?", a: "소개받은 분이 유료 플랜에 가입하면 즉시 1개월 무료 이용권이 지급됩니다." },
      { q: "쿠폰 중복 사용이 되나요?", a: "쿠폰은 1회 결제당 1장만 적용 가능합니다. 여러 쿠폰을 보유 중이면 가장 높은 할인 쿠폰이 자동 적용됩니다." },
    ],
  },
];

export function FaqPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">❓ 자주 묻는 질문</h1>
      </div>

      {faqCategories.map((cat) => (
        <div key={cat.title} className="space-y-1">
          <p className="text-sm font-semibold text-primary px-1">[{cat.title}]</p>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Accordion type="single" collapsible>
              {cat.items.map((item, i) => (
                <AccordionItem key={i} value={`${cat.title}-${i}`} className="border-border">
                  <AccordionTrigger className="px-4 text-sm text-left hover:no-underline">
                    Q. {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 text-sm text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      ))}

      <div className="text-center pt-2">
        <p className="text-sm text-muted-foreground mb-2">원하는 답변을 못 찾으셨나요?</p>
        <Button variant="outline" onClick={onBack}>문의하기</Button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Search } from "lucide-react";

interface FaqItem { q: string; a: string; category: string; }

const faqs: FaqItem[] = [
  { category: "시작하기", q: "어떻게 시작하나요?", a: "회원가입 후 현장 사진을 찍으면 AI가 자동으로 블로그 글을 작성합니다. 사진만 있으면 됩니다!" },
  { category: "시작하기", q: "사진은 몇 장 필요한가요?", a: "최소 1장이면 되지만, 3장 이상을 권장합니다. 시공 전/중/후 사진이 있으면 더 좋은 글이 만들어집니다." },
  { category: "시작하기", q: "어떤 사진을 찍어야 하나요?", a: "시공 현장, 작업 과정, 완성된 모습 등 실제 작업 사진을 찍으세요." },
  { category: "블로그", q: "네이버 블로그에 어떻게 올리나요?", a: "AI가 작성한 글을 복사해서 네이버 블로그에 붙여넣기하면 됩니다. 해시태그도 자동 생성됩니다." },
  { category: "블로그", q: "글 스타일을 바꿀 수 있나요?", a: "네, 장인형/친근형/전문기업형 3가지 페르소나 중 선택할 수 있습니다." },
  { category: "블로그", q: "SEO 최적화가 되나요?", a: "네, 네이버 C-Rank와 D.I.A+ 알고리즘에 최적화된 글을 자동 생성합니다." },
  { category: "영상", q: "쇼츠 영상은 어떻게 만드나요?", a: "쇼츠 탭에서 사진 선택 → 스타일/BGM → '영상 생성 시작'을 누르면 됩니다." },
  { category: "영상", q: "나레이션을 넣을 수 있나요?", a: "네, 남성/여성 6가지 AI 음성 중 선택할 수 있습니다." },
  { category: "영상", q: "만든 영상을 다운로드할 수 있나요?", a: "네, '갤러리에 저장' 버튼으로 MP4 파일을 다운로드할 수 있습니다." },
  { category: "요금제", q: "무료로도 사용할 수 있나요?", a: "네, 무료 플랜으로 월 5건의 블로그와 1건의 영상을 만들 수 있습니다." },
  { category: "요금제", q: "플랜은 변경 가능한가요?", a: "네, 마이페이지 > 요금제 변경에서 언제든 변경할 수 있습니다." },
  { category: "기타", q: "데이터는 안전한가요?", a: "모든 데이터는 암호화되어 저장되며, 본인만 접근할 수 있습니다." },
  { category: "기타", q: "탈퇴하고 싶어요", a: "마이페이지 > 앱 설정에서 계정 삭제를 요청할 수 있습니다." },
];

export function FaqPage({ onBack }: { onBack: () => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const filtered = search ? faqs.filter(f => f.q.includes(search) || f.a.includes(search)) : faqs;
  const categories = [...new Set(filtered.map(f => f.category))];

  return (
    <div className="pb-24 max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} aria-label="뒤로가기" className="p-2 -ml-2 rounded-lg hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">자주 묻는 질문</h1>
      </div>

      <div className="px-4 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input placeholder="질문 검색..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 rounded-xl bg-card pl-10 pr-4 text-sm text-foreground placeholder-muted-foreground border border-border focus-visible:outline-none focus:ring-1 focus:ring-primary/40" />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {categories.map(cat => (
          <div key={cat}>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">{cat}</p>
            <div className="space-y-1">
              {filtered.filter(f => f.category === cat).map((faq) => {
                const gi = faqs.indexOf(faq);
                const isOpen = openIdx === gi;
                return (
                  <div key={gi} className="bg-card border border-border rounded-xl overflow-hidden">
                    <button onClick={() => setOpenIdx(isOpen ? null : gi)} className="w-full flex items-center justify-between p-4 text-left">
                      <span className="text-sm font-medium text-foreground pr-2">{faq.q}</span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                    </button>
                    {isOpen && <div className="px-4 pb-4"><p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p></div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

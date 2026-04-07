import { ArrowLeft, Star, TrendingUp } from "lucide-react";

const reviews = [
  { name: "김OO 사장님", job: "방수 전문 10년", region: "강남구", rating: 5, text: "솔직히 처음엔 반신반의했어요. 근데 3주 만에 견적 문의가 2배로 늘었습니다. 사진만 찍으면 되니까 정말 편하고요.", ago: "2주 전", avatar: "김", gain: "견적 +200%" },
  { name: "박OO 사장님", job: "도배 전문", region: "송파구", rating: 5, text: "네이버 블로그 운영하고 싶었는데 글 쓰는 게 너무 힘들었거든요. 이거 쓰고 나서 검색 순위가 확 올라갔어요.", ago: "1달 전", avatar: "박", gain: "검색 1위" },
  { name: "이OO 사장님", job: "외벽 페인트 15년", region: "마포구", rating: 5, text: "月 9,900원에 이 정도면 대박이죠. 예전에 광고 쓸 때는 한 달에 20만원 넘게 나갔는데...", ago: "3주 전", avatar: "이", gain: "광고비 절감" },
  { name: "최OO 사장님", job: "타일 시공 전문", region: "서초구", rating: 5, text: "쇼츠 영상 기능이 생기고 나서 인스타 팔로워가 늘었어요. 현장 영상이 자동으로 만들어지니까 신기합니다.", ago: "1주 전", avatar: "최", gain: "인스타 성장" },
  { name: "정OO 사장님", job: "방수 도장 전문", region: "노원구", rating: 4, text: "처음 설치하고 바로 쓸 수 있어서 좋았어요. 사진 찍는 거 하나도 안 바뀌었는데 블로그가 알아서 올라가더라고요.", ago: "2달 전", avatar: "정", gain: "방문자 3배" },
  { name: "한OO 사장님", job: "실내 인테리어", region: "용인시", rating: 5, text: "지인 소개로 시작했는데 이제 저도 다른 사장님들한테 소개해주고 있어요. 진짜 쓸만합니다.", ago: "3달 전", avatar: "한", gain: "지인 소개 중" },
  { name: "윤OO 사장님", job: "욕실 리모델링", region: "성남시", rating: 5, text: "60대인데도 어렵지 않게 쓸 수 있어요. 사진 찍으면 끝이라 우리 같은 사람한테 딱이에요.", ago: "3주 전", avatar: "윤", gain: "초보도 가능" },
  { name: "강OO 사장님", job: "철거·인테리어", region: "광진구", rating: 5, text: "한 달 써보니까 블로그 방문자 수가 300명에서 900명으로 늘었어요. 계속 쓸 생각입니다.", ago: "1달 전", avatar: "강", gain: "방문자 3배" },
];

const stats = [
  { label: "평균 별점", value: "4.9", unit: "★", color: "#FBBF24" },
  { label: "재구독률", value: "94", unit: "%", color: "#22C55E" },
  { label: "평균 견적 증가", value: "67", unit: "%↑", color: "#237FFF" },
  { label: "사용 중", value: "1,240", unit: "명+", color: "#AB5EBE" },
];

export function ReviewsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="pb-28 max-w-lg mx-auto">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold">사용자 리뷰</h1>
          <p className="text-xs text-muted-foreground">실제 사장님들의 생생한 후기</p>
        </div>
      </div>

      {/* 히어로 */}
      <div className="px-4 pt-5 pb-4 text-center">
        <div className="text-4xl mb-3">⭐</div>
        <p className="text-xl font-black leading-snug">
          전국 1,240명 사장님이<br/>선택한 마케팅 도구
        </p>
      </div>

      {/* 통계 그리드 */}
      <div className="grid grid-cols-2 gap-3 px-4 mb-5">
        {stats.map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-3xl font-black" style={{ color: s.color }}>
              {s.value}<span className="text-lg">{s.unit}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 리뷰 카드 */}
      <div className="px-4 space-y-3">
        {reviews.map((r, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center font-black text-white text-base shrink-0"
                style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
                {r.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm">{r.name}</p>
                  <span className="text-[10px] bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded-md font-semibold shrink-0">인증</span>
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-semibold shrink-0 flex items-center gap-0.5">
                    <TrendingUp className="w-2.5 h-2.5" />{r.gain}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{r.job} · {r.region}</p>
              </div>
              <p className="text-xs text-muted-foreground shrink-0">{r.ago}</p>
            </div>
            <div className="flex gap-0.5 mb-2">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className="w-4 h-4" fill={i <= r.rating ? "#FBBF24" : "none"} stroke={i <= r.rating ? "#FBBF24" : "#6B7280"} />
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">"{r.text}"</p>
          </div>
        ))}
      </div>

      {/* 하단 CTA */}
      <div className="px-4 pt-5">
        <div className="rounded-2xl p-5 space-y-3 text-center"
          style={{ background: "linear-gradient(135deg,rgba(35,127,255,0.08),rgba(171,94,190,0.08))", border: "1px solid rgba(35,127,255,0.18)" }}>
          <p className="font-bold text-sm">나도 후기 남기기</p>
          <p className="text-xs text-muted-foreground">솔직한 후기가 다른 사장님들께 도움이 됩니다</p>
          <button className="w-full py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
            리뷰 작성하기
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { ChevronRight, Star } from "lucide-react";

const painSlides = [
  {
    emoji: "😩",
    pain: "블로그 글 쓸 시간이 없다",
    painSub: "현장 끝나면 지쳐서 사진만 쌓임",
    solution: "사진 찍으면 AI가 3분 만에 완성",
    solutionSub: "네이버 블로그에 바로 붙여넣기",
    accent: "#237FFF",
    bg: "#030810",
  },
  {
    emoji: "📞",
    pain: "견적 전화가 안 온다",
    painSub: "경쟁업체는 블로그가 있는데 나는 없음",
    solution: "검색하면 내 업체가 맨 위에",
    solutionSub: "주 3회 발행으로 C-Rank 자동 유지",
    accent: "#AB5EBE",
    bg: "#060310",
  },
  {
    emoji: "💸",
    pain: "광고비가 너무 비싸다",
    painSub: "클릭당 5,000원 네이버 광고, 효과는 글쎄",
    solution: "월 9,900원으로 광고 대체",
    solutionSub: "블로그 자연 유입은 광고와 달리 누적됨",
    accent: "#22C55E",
    bg: "#030A05",
  },
  {
    emoji: "🏗️",
    pain: "포트폴리오가 없다",
    painSub: "시공 사진은 카톡에만 있어 고객에게 못 보여줌",
    solution: "시공마다 자동 포트폴리오 생성",
    solutionSub: "네이버 블로그가 나의 온라인 명함",
    accent: "#F97316",
    bg: "#080300",
  },
];

const reviews = [
  { name: "김OO", job: "방수 10년 · 강남구", rating: 5, text: "3주 만에 견적 문의 2배로 늘었어요. 사진만 찍으면 되니까 정말 편합니다.", avatar: "김" },
  { name: "박OO", job: "도배 전문 · 송파구", rating: 5, text: "검색 순위가 확 올라갔어요. 네이버 블로그 운영하고 싶었는데 딱이에요.", avatar: "박" },
  { name: "이OO", job: "외벽 페인트 · 마포구", rating: 5, text: "月 9,900원에 이 정도면 대박. 광고비 한 달 20만원 아꼈습니다.", avatar: "이" },
  { name: "최OO", job: "타일 시공 · 서초구", rating: 5, text: "쇼츠 영상 기능 생기고 인스타 팔로워 늘었어요. 신기합니다.", avatar: "최" },
  { name: "정OO", job: "방수 도장 · 노원구", rating: 4, text: "사진 찍는 거 하나도 안 바뀌었는데 블로그가 알아서 올라가더라고요.", avatar: "정" },
  { name: "한OO", job: "실내 인테리어 · 용인", rating: 5, text: "지인 소개로 시작했는데 이제 제가 다른 사장님들한테 소개합니다.", avatar: "한" },
  { name: "윤OO", job: "욕실 리모델링 · 성남", rating: 5, text: "60대인데도 어렵지 않아요. 사진 찍으면 끝이라 딱 맞아요.", avatar: "윤" },
  { name: "강OO", job: "철거 인테리어 · 광진", rating: 5, text: "한 달 만에 블로그 방문자 300→900명으로 3배 늘었어요.", avatar: "강" },
];

function Stars({ n }: { n: number }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={14} fill={i <= n ? "#FBBF24" : "none"} stroke={i <= n ? "#FBBF24" : "#4B5563"} />
      ))}
    </div>
  );
}

interface OnboardingSlidesProps {
  onComplete: () => void;
}

export function OnboardingSlides({ onComplete }: OnboardingSlidesProps) {
  const [phase, setPhase] = useState<"pain" | "reviews">("pain");
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const autoRef = useRef<ReturnType<typeof setInterval>>();
  const reviewRef = useRef<HTMLDivElement>(null);
  const scrollPos = useRef(0);

  // 자동 슬라이드
  useEffect(() => {
    if (phase !== "pain") return;
    autoRef.current = setInterval(() => {
      goNext();
    }, 3000);
    return () => clearInterval(autoRef.current);
  }, [idx, phase]);

  // 리뷰 자동 스크롤
  useEffect(() => {
    if (phase !== "reviews" || !reviewRef.current) return;
    const el = reviewRef.current;
    const tick = () => {
      scrollPos.current += 0.7;
      if (scrollPos.current >= el.scrollWidth / 2) scrollPos.current = 0;
      el.scrollLeft = scrollPos.current;
    };
    const id = setInterval(tick, 16);
    return () => clearInterval(id);
  }, [phase]);

  const goNext = () => {
    clearInterval(autoRef.current);
    setFading(true);
    setTimeout(() => {
      if (idx < painSlides.length - 1) {
        setIdx(i => i + 1);
      } else {
        setPhase("reviews");
      }
      setFading(false);
    }, 220);
  };

  const slide = painSlides[idx];

  if (phase === "reviews") {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 100, overflowY: "auto",
        background: "linear-gradient(145deg,#060D1F,#0E0720)",
        display: "flex", flexDirection: "column", alignItems: "center",
        paddingBottom: 40,
        animation: "fadeIn 0.4s ease",
      }}>
        <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

        <div style={{ textAlign: "center", padding: "52px 24px 20px" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⭐</div>
          <p style={{ fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1.3 }}>
            실제 사장님들의<br/>생생한 후기
          </p>
          <p style={{ fontSize: 13, color: "rgba(180,185,210,.55)", marginTop: 8 }}>
            전국 시공업체 사장님 1,240명 사용 중
          </p>
        </div>

        {/* 통계 */}
        <div style={{ display: "flex", gap: 10, padding: "0 20px", marginBottom: 24, width: "100%", maxWidth: 400 }}>
          {[
            { v: "4.9★", l: "평균 별점", c: "#FBBF24" },
            { v: "94%", l: "재구독률", c: "#22C55E" },
            { v: "+67%", l: "견적 증가", c: "#237FFF" },
          ].map(s => (
            <div key={s.l} style={{
              flex: 1, background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16, padding: "12px 8px", textAlign: "center",
            }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: s.c }}>{s.v}</p>
              <p style={{ fontSize: 11, color: "rgba(180,185,210,.5)", marginTop: 3 }}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* 리뷰 무한 스크롤 */}
        <div ref={reviewRef} style={{ width: "100%", overflowX: "hidden", marginBottom: 28 }}>
          <div style={{ display: "flex", gap: 12, paddingLeft: 20, width: "max-content" }}>
            {[...reviews, ...reviews].map((r, i) => (
              <div key={i} style={{
                width: 250, flexShrink: 0,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 18, padding: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg,#237FFF,#AB5EBE)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 900, fontSize: 15, color: "#fff",
                  }}>{r.avatar}</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{r.name} 사장님</p>
                    <p style={{ fontSize: 11, color: "rgba(180,185,210,.5)" }}>{r.job}</p>
                  </div>
                </div>
                <Stars n={r.rating} />
                <p style={{ fontSize: 13, color: "rgba(220,225,240,.8)", lineHeight: 1.6, marginTop: 8 }}>
                  "{r.text}"
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: "0 24px", width: "100%", maxWidth: 400 }}>
          <button
            onClick={onComplete}
            style={{
              width: "100%", padding: "17px",
              background: "linear-gradient(135deg,#237FFF,#AB5EBE)",
              border: "none", borderRadius: 18, cursor: "pointer",
              fontSize: 17, fontWeight: 800, color: "#fff",
              boxShadow: "0 8px 32px rgba(35,127,255,0.4)",
            }}
          >
            무료로 시작하기 →
          </button>
          <p style={{ textAlign: "center", fontSize: 12, color: "rgba(180,185,210,.35)", marginTop: 10 }}>
            신용카드 불필요 · 지금 즉시 사용 가능
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: slide.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "0 26px",
      opacity: fading ? 0 : 1,
      transition: "opacity 0.22s ease, background 0.5s ease",
    }}>
      {/* 진행 점 */}
      <div style={{ position: "absolute", top: 52, display: "flex", gap: 6 }}>
        {painSlides.map((_, i) => (
          <div key={i} style={{
            height: 7,
            width: i === idx ? 24 : 7,
            borderRadius: 4, transition: "all 0.35s ease",
            background: i === idx ? slide.accent : "rgba(255,255,255,0.18)",
          }} />
        ))}
      </div>

      {/* 고통 카드 */}
      <div style={{ width: "100%", maxWidth: 340, marginBottom: 18 }}>
        <div style={{ fontSize: 52, textAlign: "center", marginBottom: 14 }}>{slide.emoji}</div>
        <div style={{
          background: "rgba(255,60,60,0.09)",
          border: "1px solid rgba(255,80,80,0.22)",
          borderRadius: 22, padding: "20px 22px",
        }}>
          <p style={{ fontSize: 18, fontWeight: 900, color: "#fff", textAlign: "center", lineHeight: 1.35 }}>
            "{slide.pain}"
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,160,160,.55)", textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
            {slide.painSub}
          </p>
        </div>
      </div>

      {/* 화살표 */}
      <div style={{ fontSize: 26, color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>↓</div>

      {/* 해결책 카드 */}
      <div style={{
        width: "100%", maxWidth: 340,
        background: `rgba(${slide.accent === "#237FFF" ? "35,127,255" : slide.accent === "#AB5EBE" ? "171,94,190" : slide.accent === "#22C55E" ? "34,197,94" : "249,115,22"},0.1)`,
        border: `1px solid ${slide.accent}35`,
        borderRadius: 22, padding: "20px 22px",
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: slide.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
          SMS 해결책
        </p>
        <p style={{ fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1.35 }}>
          {slide.solution}
        </p>
        <p style={{ fontSize: 13, color: "rgba(180,185,210,.6)", marginTop: 8, lineHeight: 1.5 }}>
          {slide.solutionSub}
        </p>
      </div>

      {/* 하단 버튼 */}
      <div style={{
        position: "absolute", bottom: 44,
        display: "flex", gap: 12, alignItems: "center",
      }}>
        <button
          onClick={onComplete}
          style={{ fontSize: 13, color: "rgba(180,185,210,.35)", background: "none", border: "none", cursor: "pointer" }}
        >
          건너뛰기
        </button>
        <button
          onClick={goNext}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: slide.accent, border: "none", borderRadius: 50,
            padding: "13px 26px", cursor: "pointer",
            fontSize: 14, fontWeight: 700, color: "#fff",
            boxShadow: `0 4px 20px ${slide.accent}50`,
          }}
        >
          {idx < painSlides.length - 1 ? "다음" : "후기 보기"}
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

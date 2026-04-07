import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, Calendar, PenLine, Upload, Sparkles } from "lucide-react";

interface OnboardingSlidesProps {
  onComplete: () => void;
}

const slides = [
  {
    icon: Sparkles,
    title: "SMS에 오신 걸 환영합니다",
    subtitle: "셀프마케팅서비스",
    description: "블로그 글 작성부터 일정 관리까지\n한 곳에서 해결하세요.",
    gradient: "from-primary to-accent",
  },
  {
    icon: PenLine,
    title: "AI 콘텐츠 생성",
    subtitle: "사진만 올리면 끝",
    description: "공사 사진을 올리면 AI가\n블로그 글을 자동으로 작성합니다.",
    gradient: "from-primary to-blue-400",
  },
  {
    icon: Calendar,
    title: "일정 관리",
    subtitle: "구글 캘린더 연동",
    description: "공사 일정을 등록하면\n구글 캘린더에 자동 동기화됩니다.",
    gradient: "from-accent to-purple-400",
  },
  {
    icon: Upload,
    title: "SNS 업로드",
    subtitle: "네이버·인스타 한번에",
    description: "작성된 콘텐츠를 네이버 블로그,\n인스타그램에 바로 업로드하세요.",
    gradient: "from-green-500 to-emerald-400",
  },
];

export function OnboardingSlides({ onComplete }: OnboardingSlidesProps) {
  const [current, setCurrent] = useState(0);
  const isLast = current === slides.length - 1;
  const slide = slides[current];

  const next = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrent((p) => p + 1);
    }
  };

  const skip = () => onComplete();

  return (
    <div className="fixed inset-0 z-[90] bg-background flex flex-col items-center justify-between overflow-hidden">
      {/* Skip button */}
      <div className="w-full flex justify-end p-4">
        <button
          onClick={skip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1"
        >
          건너뛰기
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center max-w-sm mx-auto">
        <div
          className={`w-28 h-28 rounded-3xl bg-gradient-to-br ${slide.gradient} flex items-center justify-center mb-10 shadow-xl`}
          style={{
            animation: "slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
          }}
        >
          <slide.icon className="w-14 h-14 text-white" strokeWidth={1.5} />
        </div>

        <p
          className="text-xs font-semibold tracking-[3px] uppercase text-muted-foreground mb-3"
          style={{ animation: "fadeUp 0.4s ease-out 0.1s both" }}
        >
          {slide.subtitle}
        </p>

        <h2
          className="text-2xl font-extrabold text-foreground mb-4"
          style={{ animation: "fadeUp 0.4s ease-out 0.15s both" }}
        >
          {slide.title}
        </h2>

        <p
          className="text-base text-muted-foreground whitespace-pre-line leading-relaxed"
          style={{ animation: "fadeUp 0.4s ease-out 0.2s both" }}
        >
          {slide.description}
        </p>
      </div>

      {/* Dots + Button */}
      <div className="w-full px-6 pb-12 flex flex-col items-center gap-8">
        {/* Dots indicator */}
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current
                  ? "w-8 bg-primary"
                  : "w-2 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <Button
          onClick={next}
          size="lg"
          className="w-full max-w-xs text-base font-bold h-14 rounded-2xl"
        >
          {isLast ? "시작하기" : "다음"}
          {!isLast && <ChevronRight className="w-5 h-5 ml-1" />}
        </Button>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: scale(0.5) rotate(-8deg); opacity: 0; }
          to { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes fadeUp {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

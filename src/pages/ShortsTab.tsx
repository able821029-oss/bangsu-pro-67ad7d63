import { Film, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/appStore";
import { ShortsCreator } from "@/components/ShortsCreator";
import type { TabId } from "@/components/BottomNav";

export function ShortsTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const subscription = useAppStore((s) => s.subscription);
  const isPremium = subscription.plan === "프로" || subscription.plan === "무제한";

  if (isPremium) {
    return <ShortsCreator onClose={() => onNavigate("home")} />;
  }

  return (
    <div className="px-4 pt-16 pb-24 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[80vh] space-y-6">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #237FFF, #AB5EBE)" }}
      >
        <Film className="w-10 h-10 text-white" />
      </div>

      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold">쇼츠 영상 만들기</h1>
          <Lock className="w-5 h-5 text-amber-500" />
        </div>
        <p className="text-sm text-muted-foreground">
          현장 사진으로 쇼츠 영상을 자동 생성합니다.<br />
          <span className="text-primary font-semibold">프로 · 무제한 플랜</span>에서 사용 가능합니다.
        </p>
      </div>

      <div className="w-full bg-card border border-border rounded-2xl p-4 space-y-2.5">
        {[
          "AI가 사진 → 쇼츠 영상 자동 생성",
          "틱톡 · 인스타 릴스 최적화",
          "자막 + 배경음악 자동 삽입",
          "나레이션 목소리 6종 선택",
          "월 20개 영상 생성 (프로 플랜)",
        ].map((feat, i) => (
          <p key={i} className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            {feat}
          </p>
        ))}
      </div>

      <Button
        className="w-full h-12 text-base font-bold"
        style={{ background: "linear-gradient(135deg, #237FFF, #AB5EBE)", color: "white" }}
        onClick={() => onNavigate("settings")}
      >
        프로 플랜 업그레이드
      </Button>

      <Button variant="ghost" className="text-muted-foreground" onClick={() => onNavigate("home")}>
        나중에 하기
      </Button>
    </div>
  );
}

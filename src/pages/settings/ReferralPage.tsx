import { ArrowLeft, Copy, MessageSquare, Share2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/appStore";
import { useToast } from "@/hooks/use-toast";

export function ReferralPage({ onBack }: { onBack: () => void }) {
  const { referralCode, referralCount } = useAppStore();
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    toast({ title: "✅ 소개 코드가 복사되었습니다." });
  };

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">👥 지인 소개</h1>
      </div>

      {/* Referral Code */}
      <div className="bg-primary/10 border border-primary/30 rounded-xl p-5 text-center space-y-3">
        <p className="text-sm text-muted-foreground">내 소개 코드</p>
        <p className="text-2xl font-black tracking-wider text-primary">{referralCode}</p>
        <Button variant="outline" onClick={handleCopy}>
          <Copy className="w-4 h-4" /> 코드 복사
        </Button>
      </div>

      {/* Share Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" className="w-full">
          <MessageSquare className="w-5 h-5" /> 카카오톡 공유
        </Button>
        <Button variant="secondary" size="lg" className="w-full">
          <Share2 className="w-5 h-5" /> 문자 공유
        </Button>
      </div>

      {/* Stats */}
      <div className="bg-card rounded-xl border border-border p-4">
        <p className="text-sm font-semibold mb-3">소개 현황</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">{referralCount}</p>
            <p className="text-xs text-muted-foreground">가입한 지인</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-success">{referralCount}</p>
            <p className="text-xs text-muted-foreground">적립된 무료 월</p>
          </div>
        </div>
      </div>

      {/* Reward Structure */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2"><Gift className="w-4 h-4 text-primary" /> 보상 구조</p>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold text-sm">→</span>
            <div>
              <p className="text-sm font-semibold">소개한 사람</p>
              <p className="text-xs text-muted-foreground">1개월 무료 이용권 지급</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-success font-bold text-sm">→</span>
            <div>
              <p className="text-sm font-semibold">가입한 사람</p>
              <p className="text-xs text-muted-foreground">첫 달 50% 할인 적용</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

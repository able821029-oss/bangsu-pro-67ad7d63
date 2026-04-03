import { ArrowLeft, Copy, MessageSquare, Share2, Gift, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/appStore";
import { useToast } from "@/hooks/use-toast";

export function ReferralPage({ onBack }: { onBack: () => void }) {
  const { referralCount } = useAppStore();
  const { toast } = useToast();
  const referralCode = "SMS";

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    toast({ title: "소개 코드가 복사되었습니다." });
  };

  const handleKakaoShare = () => {
    const text = `사장님~ 현장 사진만 올리면\nAI가 블로그 글 써주는 앱이에요.\n진짜 편합니다. 무료로 써보세요!\n\n코드 입력하면 첫달 50% 할인:\nSMS`;
    navigator.clipboard.writeText(text);
    toast({ title: "카카오톡 공유 메시지가 복사되었습니다." });
  };

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">지인 소개</h1>
        </div>
      </div>

      {/* Referral Code */}
      <div className="glass-card p-5 text-center space-y-3" style={{ borderColor: "rgba(35,127,255,0.3)" }}>
        <p className="text-sm text-muted-foreground">내 소개 코드</p>
        <p className="text-2xl font-black tracking-wider text-primary">{referralCode}</p>
        <Button variant="outline" onClick={handleCopy}>
          <Copy className="w-4 h-4" /> 코드 복사
        </Button>
      </div>

      {/* Share Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" className="w-full" onClick={handleKakaoShare}>
          <MessageSquare className="w-5 h-5" /> 카카오톡 공유
        </Button>
        <Button variant="secondary" size="lg" className="w-full">
          <Share2 className="w-5 h-5" /> 문자 공유
        </Button>
      </div>

      {/* Stats */}
      <div className="glass-card p-4">
        <p className="text-sm font-semibold mb-3">소개 현황</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">{referralCount}</p>
            <p className="text-xs text-muted-foreground">가입한 지인</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-[#22C55E]">{referralCount}</p>
            <p className="text-xs text-muted-foreground">적립된 무료 월</p>
          </div>
        </div>
      </div>

      {/* Reward Structure */}
      <div className="glass-card p-4 space-y-3">
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
            <span className="text-[#22C55E] font-bold text-sm">→</span>
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

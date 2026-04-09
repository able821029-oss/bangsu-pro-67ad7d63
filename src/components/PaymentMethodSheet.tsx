import { useState } from "react";
import { CreditCard } from "lucide-react";
import { TestModeBadge } from "@/components/TestModeBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores/appStore";

interface PaymentMethodSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  planName: string;
  amount: number;
}

function KakaoPayLogo() {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: "#FFCD00",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="32" height="20" viewBox="0 0 80 48" fill="none">
        <circle cx="16" cy="24" r="10" fill="#3A1D1D" />
        <rect x="14" y="30" width="4" height="8" rx="1" fill="#FFCD00" />
        <text x="32" y="32" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="22" fill="#3A1D1D">
          pay
        </text>
      </svg>
    </div>
  );
}

function TossPayLogo() {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        background: "#0064FF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="36" height="20" viewBox="0 0 90 48" fill="none">
        <text
          x="2"
          y="36"
          fontFamily="Arial Black, Helvetica Neue, sans-serif"
          fontWeight="900"
          fontSize="32"
          fill="#FFFFFF"
        >
          toss
        </text>
      </svg>
    </div>
  );
}

export function PaymentMethodSheet({ open, onOpenChange, planName, amount }: PaymentMethodSheetProps) {
  const { toast } = useToast();
  const upgradePlan = useAppStore((s) => s.upgradePlan);
  const [loading, setLoading] = useState<"kakao" | "toss" | null>(null);

  const handleKakaoPay = async () => {
    setLoading("kakao");
    try {
      const appUrl = window.location.origin;
      const { data, error } = await supabase.functions.invoke("kakao-pay", {
        body: {
          action: "ready",
          userId: `user_${Date.now()}`,
          planName,
          amount,
          approvalUrl: `${appUrl}/payment/kakao/success`,
          cancelUrl: `${appUrl}/payment/kakao/cancel`,
          failUrl: `${appUrl}/payment/kakao/fail`,
        },
      });

      if (error) throw error;

      if (data?.test_mode) {
        upgradePlan(planName);
        toast({
          title: "플랜 변경 완료",
          description: `${planName} 플랜이 적용되었습니다. (${amount.toLocaleString()}원/월)`,
        });
        onOpenChange(false);
      } else if (data?.next_redirect_mobile_url) {
        window.location.href = data.next_redirect_mobile_url;
      }
    } catch (err: any) {
      toast({ title: "결제 오류", description: err.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleTossPay = async () => {
    setLoading("toss");
    upgradePlan(planName);
    toast({
      title: "플랜 변경 완료",
      description: `${planName} 플랜이 적용되었습니다. (${amount.toLocaleString()}원/월)`,
    });
    setLoading(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            결제 수단 선택
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-sm text-muted-foreground">선택한 플랜</p>
            <p className="text-lg font-bold">
              {planName} — ₩{amount.toLocaleString()}/월
            </p>
          </div>

          {/* 카카오페이 */}
          <button
            onClick={handleKakaoPay}
            disabled={loading !== null}
            className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-card hover:border-primary/50 transition-all text-left disabled:opacity-50"
          >
            <KakaoPayLogo />
            <div className="flex-1">
              <p className="font-semibold text-sm">카카오페이</p>
              <p className="text-xs text-muted-foreground">카카오톡으로 간편 결제</p>
            </div>
            <TestModeBadge label="테스트" inline />
          </button>

          {/* 토스페이 */}
          <button
            onClick={handleTossPay}
            disabled={loading !== null}
            className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-card hover:border-primary/50 transition-all text-left disabled:opacity-50"
          >
            <TossPayLogo />
            <div className="flex-1">
              <p className="font-semibold text-sm">토스페이</p>
              <p className="text-xs text-muted-foreground">신용카드 · 체크카드</p>
            </div>
            <TestModeBadge label="테스트" inline />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { TestModeBadge } from "@/components/TestModeBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PaymentMethodSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  planName: string;
  amount: number;
}

const PLAN_AMOUNTS: Record<string, number> = {
  "베이직": 9900,
  "프로": 19900,
  "무제한": 39900,
};

export function PaymentMethodSheet({ open, onOpenChange, planName, amount }: PaymentMethodSheetProps) {
  const { toast } = useToast();
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
        toast({
          title: "🔧 테스트 모드",
          description: `카카오페이 테스트 결제가 시뮬레이션되었습니다. (${planName} ${amount.toLocaleString()}원)`,
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
    toast({
      title: "🔧 테스트 모드",
      description: `토스페이먼츠 테스트 결제가 시뮬레이션되었습니다. (${planName} ${amount.toLocaleString()}원)`,
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
            <p className="text-lg font-bold">{planName} — ₩{amount.toLocaleString()}/월</p>
          </div>

          {/* Kakao Pay */}
          <button
            onClick={handleKakaoPay}
            disabled={loading !== null}
            className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-card hover:border-primary/50 transition-all text-left disabled:opacity-50"
          >
            <svg width="48" height="48" viewBox="0 0 56 56" fill="none" className="shrink-0">
              <rect width="56" height="56" rx="14" fill="#FFCD00"/>
              <circle cx="16" cy="28" r="3" fill="#3A1D1D"/>
              <text x="20" y="33" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="16" fill="#3A1D1D">pay</text>
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-sm">카카오페이</p>
              <p className="text-xs text-muted-foreground">카카오톡으로 간편 결제</p>
            </div>
            <TestModeBadge label="테스트" inline />
          </button>

          {/* Toss Pay */}
          <button
            onClick={handleTossPay}
            disabled={loading !== null}
            className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-card hover:border-primary/50 transition-all text-left disabled:opacity-50"
          >
            <svg width="48" height="48" viewBox="0 0 56 56" fill="none" className="shrink-0">
              <rect width="56" height="56" rx="28" fill="white"/>
              <path d="M28 8 C28 8 14 20 14 30 C14 37.7 20.3 44 28 44 C35.7 44 42 37.7 42 30 C42 20 28 8 28 8Z" fill="#1B64DA"/>
              <path d="M36 12 C36 12 28 20 28 26 C28 29.3 30.7 32 34 32 C37.3 32 40 29.3 40 26 C40 20 36 12 36 12Z" fill="#4FA8FF"/>
            </svg>
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

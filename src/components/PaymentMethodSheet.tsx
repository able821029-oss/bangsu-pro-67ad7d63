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
          title: "테스트 모드",
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
            <img
              src="/kakaopay.png"
              width="48" height="48"
              className="shrink-0 rounded-xl object-contain"
              alt="카카오페이"
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = "none";
                const fallback = document.createElement("div");
                fallback.style.cssText = "width:48px;height:48px;border-radius:12px;background:#FFCD00;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:#3A1D1D;flex-shrink:0;";
                fallback.textContent = "pay";
                el.parentElement?.insertBefore(fallback, el);
              }}
            />
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
            <img
              src="/toss.png"
              width="48" height="48"
              className="shrink-0 rounded-full object-contain"
              alt="토스페이"
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = "none";
                const fallback = document.createElement("div");
                fallback.style.cssText = "width:48px;height:48px;border-radius:50%;background:#0064FF;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;color:white;flex-shrink:0;";
                fallback.textContent = "toss";
                el.parentElement?.insertBefore(fallback, el);
              }}
            />
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

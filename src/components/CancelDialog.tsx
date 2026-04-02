import { useState } from "react";
import { AlertTriangle, Ticket, ArrowDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const cancelReasons = ["비용 부담", "기능 불만족", "잘 안 쓰게 됨", "기타"];

export function CancelDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"offer" | "reason">("offer");
  const [selectedReason, setSelectedReason] = useState("");

  const handleCoupon = () => {
    toast({ title: "🎉 1개월 50% 할인 쿠폰이 지급되었습니다!" });
    onOpenChange(false);
    setStep("offer");
  };

  const handleDowngrade = () => {
    toast({ title: "무료 플랜으로 전환되었습니다." });
    onOpenChange(false);
    setStep("offer");
  };

  const handleCancel = () => {
    setStep("reason");
  };

  const handleConfirmCancel = () => {
    toast({ title: "구독이 해지되었습니다. 30일 이내 재가입 시 웰백 쿠폰이 자동 발급됩니다." });
    onOpenChange(false);
    setStep("offer");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setStep("offer"); }}>
      <DialogContent className="max-w-sm bg-card border-border">
        {step === "offer" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="w-5 h-5 text-warning" />
                잠깐요! 지금 해지하면 아까워요
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              <button
                onClick={handleCoupon}
                className="w-full text-left bg-primary/10 border border-primary/30 rounded-xl p-4 hover:bg-primary/20 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Ticket className="w-5 h-5 text-primary" />
                  <p className="font-semibold text-sm">1개월 50% 할인 쿠폰 받고 유지</p>
                </div>
                <p className="text-xs text-muted-foreground">다음 결제 시 자동 적용됩니다</p>
              </button>

              <button
                onClick={handleDowngrade}
                className="w-full text-left bg-card border border-border rounded-xl p-4 hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDown className="w-5 h-5 text-info" />
                  <p className="font-semibold text-sm">플랜 다운그레이드 (무료로 전환)</p>
                </div>
                <p className="text-xs text-muted-foreground">월 5건까지 무료로 이용 가능합니다</p>
              </button>

              <button
                onClick={handleCancel}
                className="w-full text-left bg-card border border-border rounded-xl p-4 hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <LogOut className="w-5 h-5 text-destructive" />
                  <p className="font-semibold text-sm text-destructive">그래도 해지</p>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">해지 사유를 알려주세요</DialogTitle>
            </DialogHeader>

            <div className="space-y-2 mt-2">
              {cancelReasons.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm ${
                    selectedReason === reason
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <Button
              variant="destructive"
              className="w-full mt-3"
              disabled={!selectedReason}
              onClick={handleConfirmCancel}
            >
              해지 확인
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              30일 이내 재가입 시 웰백 쿠폰이 자동 발급됩니다
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

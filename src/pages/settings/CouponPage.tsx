import { useState } from "react";
import { ArrowLeft, Ticket, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores/appStore";
import { useToast } from "@/hooks/use-toast";

export function CouponPage({ onBack }: { onBack: () => void }) {
  const { coupons, addCoupon } = useAppStore();
  const { toast } = useToast();
  const [code, setCode] = useState("");

  const handleRegister = () => {
    if (!code.trim()) return;
    addCoupon({
      id: crypto.randomUUID(),
      code: code.trim().toUpperCase(),
      discount: "10% 할인",
      expiresAt: "2026-06-30",
      used: false,
    });
    toast({ title: "✅ 쿠폰이 등록되었습니다." });
    setCode("");
  };

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">🎫 쿠폰·혜택</h1>
      </div>

      {/* Register Coupon */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold">쿠폰 코드 등록</p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-secondary rounded-lg px-3 py-3 text-sm outline-none text-foreground uppercase"
            placeholder="쿠폰 코드 입력"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button onClick={handleRegister} size="default">
            <Plus className="w-4 h-4" /> 등록
          </Button>
        </div>
      </div>

      {/* Coupon List */}
      <div>
        <p className="text-sm font-semibold mb-3">보유 쿠폰 ({coupons.filter((c) => !c.used).length}장)</p>
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className={`bg-card rounded-xl border p-4 flex items-center gap-3 ${
                coupon.used ? "border-border opacity-50" : "border-primary/30"
              }`}
            >
              <Ticket className={`w-8 h-8 shrink-0 ${coupon.used ? "text-muted-foreground" : "text-primary"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm">{coupon.discount}</p>
                  {!coupon.used && <Badge variant="success" className="text-xs">사용 가능</Badge>}
                  {coupon.used && <Badge variant="default" className="text-xs">사용완료</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">코드: {coupon.code}</p>
                <p className="text-xs text-muted-foreground">{coupon.expiresAt} 만료</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

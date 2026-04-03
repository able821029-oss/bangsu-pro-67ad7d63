import { ArrowLeft, Gift } from "lucide-react";

export function CouponPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">🎫 쿠폰·혜택</h1>
      </div>

      <div className="bg-card rounded-[--radius] border border-border p-8 text-center space-y-4">
        <Gift className="w-16 h-16 text-primary/40 mx-auto" />
        <p className="text-lg font-bold">🎁 준비 중입니다</p>
        <p className="text-sm text-muted-foreground">곧 오픈됩니다!</p>
        <p className="text-xs text-muted-foreground">쿠폰 및 혜택 기능이 준비되고 있습니다.<br />조금만 기다려주세요.</p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { ArrowLeft, Check, X, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TestModeBadge } from "@/components/TestModeBadge";
import { PaymentMethodSheet } from "@/components/PaymentMethodSheet";
import { useAppStore } from "@/stores/appStore";
import { CancelDialog } from "@/components/CancelDialog";

const plans = [
  {
    name: "무료", price: "₩0", amount: 0, monthly: "5건", platforms: "네이버만", persona: "1종", photos: "2장", highlight: false, videoCredits: "1크레딧/월",
    features: { seo: false, photoAuto: false, persona3: false, admin: false },
  },
  {
    name: "베이직", price: "₩9,900", amount: 9900, monthly: "50건", platforms: "3개", persona: "3종", photos: "5장", highlight: false, videoCredits: "3크레딧/월",
    features: { seo: true, photoAuto: false, persona3: true, admin: false },
  },
  {
    name: "프로", price: "₩19,900", amount: 19900, monthly: "150건", platforms: "전체", persona: "전체", photos: "10장", highlight: true, videoCredits: "10크레딧/월",
    features: { seo: true, photoAuto: true, persona3: true, admin: false },
  },
  {
    name: "무제한", price: "₩39,900", amount: 39900, monthly: "무제한", platforms: "전체", persona: "전체", photos: "10장", highlight: false, videoCredits: "30크레딧/월",
    features: { seo: true, photoAuto: true, persona3: true, admin: true },
  },
] as const;

const featureLabels = [
  { key: "seo" as const, label: "자동 SEO 키워드 삽입" },
  { key: "photoAuto" as const, label: "사진 배치 자동화" },
  { key: "persona3" as const, label: "페르소나 3종" },
  { key: "admin" as const, label: "관리자 모드" },
];

export function PricingPlan({ onBack }: { onBack: () => void }) {
  const subscription = useAppStore((s) => s.subscription);
  const [showCancel, setShowCancel] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<{ name: string; amount: number } | null>(null);

  return (
    <div className="pb-24 max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">요금제·결제</h1>
      </div>
      <div className="px-4 pt-4 space-y-5">

      {/* Current Plan */}
      <div className="bg-primary/10 border border-primary/30 rounded-[--radius] p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">현재 플랜</p>
          <p className="text-lg font-bold text-primary">{subscription.plan}</p>
          <p className="text-xs text-muted-foreground">{subscription.expiresAt} 만료</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{subscription.usedCount}/{subscription.maxCount}</p>
          <p className="text-xs text-muted-foreground">이번달 사용량</p>
        </div>
      </div>

      {/* Annual Discount Badge */}
      <div className="bg-success/10 border border-success/30 rounded-[--radius] px-4 py-3 text-center">
        <p className="text-sm font-semibold text-success">연간 결제 시 2개월 무료!</p>
      </div>

      {/* Plan Cards */}
      <div className="space-y-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-[--radius] border-2 p-4 transition-all ${
              plan.highlight
                ? "border-primary bg-primary/5"
                : subscription.plan === plan.name
                ? "border-primary/50 bg-card"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {plan.highlight && <Crown className="w-5 h-5 text-primary" />}
                <span className="font-bold text-lg">{plan.name}</span>
                {plan.highlight && <Badge variant="default" className="text-xs">추천</Badge>}
                {subscription.plan === plan.name && <Badge variant="info" className="text-xs">현재</Badge>}
              </div>
              <span className="text-xl font-bold">{plan.price}<span className="text-sm font-normal text-muted-foreground">/월</span></span>
            </div>

            {/* Basic features */}
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><Check className="w-3 h-3 text-success" /> 월 {plan.monthly}</div>
              <div className="flex items-center gap-1"><Check className="w-3 h-3 text-success" /> 플랫폼 {plan.platforms}</div>
              <div className="flex items-center gap-1"><Check className="w-3 h-3 text-success" /> 페르소나 {plan.persona}</div>
              <div className="flex items-center gap-1"><Check className="w-3 h-3 text-success" /> 사진 {plan.photos}</div>
            </div>

            {/* Detailed feature checklist */}
            <div className="mt-3 pt-3 border-t border-border space-y-1.5">
              {featureLabels.map((f) => (
                <div key={f.key} className="flex items-center gap-2 text-xs">
                  {plan.features[f.key] ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-muted-foreground/40" />
                  )}
                  <span className={plan.features[f.key] ? "text-foreground" : "text-muted-foreground/50"}>
                    {f.label}
                  </span>
                </div>
              ))}
            </div>

            {subscription.plan !== plan.name && (
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant={plan.highlight ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => plan.amount > 0 ? setPaymentPlan({ name: plan.name, amount: plan.amount }) : null}
                >
                  {plan.price === "₩0" ? "무료로 시작" : "업그레이드"}
                </Button>
                {plan.price !== "₩0" && <TestModeBadge label="테스트" inline />}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Cancel Button */}
      {subscription.plan !== "무료" && (
        <button onClick={() => setShowCancel(true)} className="w-full text-center text-sm text-muted-foreground underline py-2">
          구독 해지
        </button>
      )}

      <CancelDialog open={showCancel} onOpenChange={setShowCancel} />

      {paymentPlan && (
        <PaymentMethodSheet
          open={!!paymentPlan}
          onOpenChange={(v) => !v && setPaymentPlan(null)}
          planName={paymentPlan.name}
          amount={paymentPlan.amount}
        />
      )}
      </div>
    </div>
  );
}

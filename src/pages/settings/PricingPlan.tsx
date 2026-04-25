import { useState } from "react";
import { ArrowLeft, Check, X, Crown, Gift, Users, Copy, MessageSquare, Share2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PaymentMethodSheet } from "@/components/PaymentMethodSheet";
import { useAppStore } from "@/stores/appStore";
import { CancelDialog } from "@/components/CancelDialog";
import { useToast } from "@/hooks/use-toast";

const plans = [
  {
    name: "무료", price: "₩0", amount: 0,
    monthly: "5건", video: "월 1개", platforms: "네이버만", persona: "1종", photos: "2장",
    highlight: false,
    features: { seo: false, photoAuto: false, persona3: false, admin: false },
  },
  {
    name: "베이직", price: "₩9,900", amount: 9900,
    monthly: "50건", video: "월 5개", platforms: "3개", persona: "3종", photos: "5장",
    highlight: false,
    features: { seo: true, photoAuto: false, persona3: true, admin: false },
  },
  {
    name: "프로", price: "₩29,900", amount: 29900,
    monthly: "150건", video: "월 20개", platforms: "전체", persona: "전체", photos: "10장",
    highlight: true,
    features: { seo: true, photoAuto: true, persona3: true, admin: false },
  },
  {
    name: "무제한", price: "₩59,900", amount: 59900,
    monthly: "무제한", video: "월 50개", platforms: "전체", persona: "전체", photos: "10장",
    highlight: false,
    features: { seo: true, photoAuto: true, persona3: true, admin: true },
  },
] as const;

const featureLabels = [
  { key: "seo" as const, label: "자동 SEO 키워드 삽입" },
  { key: "photoAuto" as const, label: "사진 배치 자동화" },
  { key: "persona3" as const, label: "페르소나 3종" },
  { key: "admin" as const, label: "관리자 모드" },
];

// 소개 1명당 추가 한도
const REFERRAL_BLOG_BONUS = 10;  // 블로그 10건
const REFERRAL_VIDEO_BONUS = 2;  // 영상 2개

export function PricingPlan({ onBack }: { onBack: () => void }) {
  const subscription = useAppStore((s) => s.subscription);
  const referralCount = useAppStore((s) => s.referralCount);
  const referralCode = useAppStore((s) => s.referralCode);
  const { toast } = useToast();
  const [showCancel, setShowCancel] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<{ name: string; amount: number } | null>(null);
  const [showReferral, setShowReferral] = useState(false);

  const blogUsedPct = subscription.maxCount > 0
    ? Math.min((subscription.usedCount / subscription.maxCount) * 100, 100) : 0;
  const videoUsedPct = (subscription.maxVideo ?? 1) > 0
    ? Math.min(((subscription.videoUsed ?? 0) / (subscription.maxVideo ?? 1)) * 100, 100) : 0;

  const blogNearLimit = blogUsedPct >= 70;
  const videoNearLimit = videoUsedPct >= 70;
  const showReferralNudge = blogNearLimit || videoNearLimit;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast({ title: "소개 코드 복사됨", description: `코드: ${referralCode}` });
  };

  const handleKakaoShare = () => {
    const msg = `사장님~ 현장 사진만 찍으면 AI가 블로그 글 써주는 앱이에요.\n정말 편합니다. 무료로 써보세요!\n\n가입할 때 이 코드 입력하면 첫 달 50% 할인:\n${referralCode}`;
    navigator.clipboard.writeText(msg);
    toast({ title: "카카오톡 메시지 복사됨", description: "그대로 붙여넣기 해서 보내세요" });
  };

  return (
    <div className="pb-24 max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">요금제·결제</h1>
      </div>

      <div className="px-4 pt-4 space-y-5">

        {/* 현재 플랜 사용량 */}
        <div className="bg-card border border-border rounded-[--radius] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">현재 플랜</p>
              <p className="text-lg font-bold text-primary">{subscription.plan}</p>
            </div>
            <p className="text-xs text-muted-foreground">{subscription.expiresAt} 만료</p>
          </div>

          {/* 블로그 사용량 */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">블로그 글</span>
              <span className={blogNearLimit ? "text-amber-500 font-semibold" : "text-muted-foreground"}>
                {subscription.usedCount} / {subscription.maxCount}건
              </span>
            </div>
            <Progress value={blogUsedPct} className="h-1.5" />
          </div>

          {/* 영상 사용량 */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">쇼츠 영상</span>
              <span className={videoNearLimit ? "text-amber-500 font-semibold" : "text-muted-foreground"}>
                {subscription.videoUsed ?? 0} / {subscription.maxVideo ?? 1}개
              </span>
            </div>
            <Progress value={videoUsedPct} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground/70 pt-0.5">
              AI 영상 생성 (Shotstack 기반 안정 렌더링)
            </p>
          </div>
        </div>

        {/* ── 지인 소개로 한도 추가 (한도 70% 이상이면 자동 표시) ── */}
        <div
          className="rounded-[--radius] border-2 overflow-hidden"
          style={{ borderColor: showReferralNudge ? "#237FFF" : "rgba(255,255,255,0.1)" }}
        >
          <button
            className="w-full flex items-center justify-between p-4"
            style={{ background: showReferralNudge ? "rgba(35,127,255,0.08)" : "transparent" }}
            onClick={() => setShowReferral(!showReferral)}
          >
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              <div className="text-left">
                <p className="text-sm font-bold">지인 소개하면 한도가 늘어나요</p>
                <p className="text-xs text-muted-foreground">
                  1명 소개 시 블로그 +{REFERRAL_BLOG_BONUS}건 · 영상 +{REFERRAL_VIDEO_BONUS}개 추가
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {showReferralNudge && (
                <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full font-semibold">
                  한도 부족
                </span>
              )}
              {showReferral ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>

          {showReferral && (
            <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">

              {/* 내 소개 코드 */}
              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">내 소개 코드</p>
                <div className="flex items-center justify-center gap-3">
                  <p className="text-2xl font-black tracking-widest text-primary">{referralCode}</p>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-primary text-primary"
                  >
                    <Copy className="w-3 h-3" /> 복사
                  </button>
                </div>
              </div>

              {/* 보상 구조 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-primary/10 rounded-xl p-3 text-center space-y-1">
                  <p className="text-xs text-muted-foreground">소개한 나</p>
                  <p className="text-sm font-bold text-primary">블로그 +{REFERRAL_BLOG_BONUS}건</p>
                  <p className="text-sm font-bold text-primary">영상 +{REFERRAL_VIDEO_BONUS}개</p>
                  <p className="text-[10px] text-muted-foreground">이번 달 한도에 추가</p>
                </div>
                <div className="bg-green-500/10 rounded-xl p-3 text-center space-y-1">
                  <p className="text-xs text-muted-foreground">가입한 지인</p>
                  <p className="text-sm font-bold text-green-600">첫 달 50% 할인</p>
                  <p className="text-[10px] text-muted-foreground">소개 코드 입력 시</p>
                </div>
              </div>

              {/* 소개 현황 */}
              <div className="flex items-center justify-between bg-secondary/50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm">지금까지 소개한 지인</span>
                </div>
                <span className="text-lg font-bold text-primary">{referralCount}명</span>
              </div>

              {/* 공유 버튼 */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={handleKakaoShare} className="gap-2">
                  <MessageSquare className="w-4 h-4" /> 카카오톡
                </Button>
                <Button variant="secondary"
                  onClick={() => {
                    const msg = `현장 사진만 찍으면 AI가 블로그 글 써주는 앱!\n소개 코드 ${referralCode} 입력하면 첫 달 50% 할인`;
                    navigator.share?.({ text: msg }) || navigator.clipboard.writeText(msg);
                    toast({ title: "공유 메시지 복사됨" });
                  }}
                  className="gap-2"
                >
                  <Share2 className="w-4 h-4" /> 문자·기타
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 연간 할인 배너 */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-[--radius] px-4 py-3 text-center">
          <p className="text-sm font-semibold text-green-600">연간 결제 시 2개월 무료!</p>
        </div>

        {/* 플랜 카드 */}
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
                <span className="text-xl font-bold">
                  {plan.price}<span className="text-sm font-normal text-muted-foreground">/월</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> 글 {plan.monthly}</div>
                <div className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> 쇼츠 {plan.video}</div>
                <div className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> 플랫폼 {plan.platforms}</div>
                <div className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> 사진 {plan.photos}</div>
              </div>

              <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                {featureLabels.map((f) => (
                  <div key={f.key} className="flex items-center gap-2 text-xs">
                    {plan.features[f.key]
                      ? <Check className="w-3.5 h-3.5 text-green-500" />
                      : <X className="w-3.5 h-3.5 text-muted-foreground/30" />}
                    <span className={plan.features[f.key] ? "text-foreground" : "text-muted-foreground/40"}>
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
                    onClick={() => plan.amount > 0
                      ? setPaymentPlan({ name: plan.name, amount: plan.amount })
                      : null}
                  >
                    {plan.price === "₩0" ? "무료로 시작" : "업그레이드"}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

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

import { TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const churnReasons = [
  { reason: "비용 부담", count: 12, percent: 38 },
  { reason: "기능 불만족", count: 8, percent: 25 },
  { reason: "잘 안 쓰게 됨", count: 7, percent: 22 },
  { reason: "기타", count: 5, percent: 15 },
];

const churnStats = {
  totalChurned: 32,
  retained: 18,
  retentionRate: 56,
  couponUsed: 10,
  downgraded: 8,
  welbackReturned: 4,
};

export function AdminChurn() {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <TrendingDown className="w-5 h-5 text-primary" /> 이탈 현황 통계
      </h2>

      {/* Overview */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{churnStats.totalChurned}</p>
          <p className="text-xs text-muted-foreground">해지 시도</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-success">{churnStats.retained}</p>
          <p className="text-xs text-muted-foreground">이탈 방지</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-primary">{churnStats.retentionRate}%</p>
          <p className="text-xs text-muted-foreground">유지율</p>
        </div>
      </div>

      {/* Retention Breakdown */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold">이탈 방지 수단 현황</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">50% 할인 쿠폰 수락</span>
            <Badge variant="success" className="text-xs">{churnStats.couponUsed}명</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">무료 다운그레이드</span>
            <Badge variant="info" className="text-xs">{churnStats.downgraded}명</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">30일 내 웰백 복귀</span>
            <Badge variant="warning" className="text-xs">{churnStats.welbackReturned}명</Badge>
          </div>
        </div>
      </div>

      {/* Churn Reasons */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold">해지 사유 집계</p>
        <div className="space-y-3">
          {churnReasons.map((r) => (
            <div key={r.reason}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">{r.reason}</span>
                <span className="text-xs text-muted-foreground">{r.count}건 ({r.percent}%)</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5">
                <div
                  className="bg-primary rounded-full h-2.5 transition-all"
                  style={{ width: `${r.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

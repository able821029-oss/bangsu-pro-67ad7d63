import { BarChart3, Users, Gift } from "lucide-react";

const mockData = {
  totalReferrals: 47,
  totalConverted: 31,
  totalFreeMonths: 31,
  topReferrers: [
    { name: "김방수", code: "BANGSU-K1M2", referred: 8, converted: 6 },
    { name: "이시공", code: "BANGSU-L3E4", referred: 5, converted: 4 },
    { name: "박누수", code: "BANGSU-P5A6", referred: 4, converted: 3 },
    { name: "최방수", code: "BANGSU-C7H8", referred: 3, converted: 2 },
  ],
};

export function AdminReferrals() {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" /> 레퍼럴 현황
      </h2>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <Users className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{mockData.totalReferrals}</p>
          <p className="text-xs text-muted-foreground">총 소개</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <Users className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold">{mockData.totalConverted}</p>
          <p className="text-xs text-muted-foreground">가입 전환</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <Gift className="w-5 h-5 text-info mx-auto mb-1" />
          <p className="text-2xl font-bold">{mockData.totalFreeMonths}</p>
          <p className="text-xs text-muted-foreground">무료 지급(월)</p>
        </div>
      </div>

      {/* Top Referrers */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold">상위 추천인</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">이름</th>
              <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">코드</th>
              <th className="text-center px-4 py-2 text-xs text-muted-foreground font-medium">소개</th>
              <th className="text-center px-4 py-2 text-xs text-muted-foreground font-medium">전환</th>
            </tr>
          </thead>
          <tbody>
            {mockData.topReferrers.map((r) => (
              <tr key={r.code} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                <td className="px-4 py-3 text-center">{r.referred}</td>
                <td className="px-4 py-3 text-center text-success font-semibold">{r.converted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

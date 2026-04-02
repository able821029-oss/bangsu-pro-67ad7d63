import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const mockUsers = [
  { id: "1", name: "김방수", email: "kim@example.com", plan: "프로", monthlyUsed: 42, monthlyMax: 150, joinedAt: "2026-01-15" },
  { id: "2", name: "이시공", email: "lee@example.com", plan: "베이직", monthlyUsed: 28, monthlyMax: 50, joinedAt: "2026-02-03" },
  { id: "3", name: "박누수", email: "park@example.com", plan: "무료", monthlyUsed: 3, monthlyMax: 5, joinedAt: "2026-03-10" },
  { id: "4", name: "최방수", email: "choi@example.com", plan: "무제한", monthlyUsed: 87, monthlyMax: 999, joinedAt: "2025-11-20" },
  { id: "5", name: "정시공", email: "jung@example.com", plan: "베이직", monthlyUsed: 50, monthlyMax: 50, joinedAt: "2026-01-28" },
];

const planColor: Record<string, "default" | "info" | "success" | "warning"> = {
  "무료": "warning",
  "베이직": "info",
  "프로": "success",
  "무제한": "default",
};

export function AdminUsers() {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" /> 가입자 목록
      </h2>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">이름</th>
                <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">이메일</th>
                <th className="text-center px-4 py-2 text-xs text-muted-foreground font-medium">플랜</th>
                <th className="text-center px-4 py-2 text-xs text-muted-foreground font-medium">사용량</th>
                <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">가입일</th>
              </tr>
            </thead>
            <tbody>
              {mockUsers.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={planColor[u.plan]} className="text-xs">{u.plan}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={u.monthlyUsed >= u.monthlyMax ? "text-destructive font-semibold" : ""}>
                      {u.monthlyUsed}/{u.monthlyMax === 999 ? "∞" : u.monthlyMax}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.joinedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Users, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface UserRow {
  id: string;
  name: string;
  email: string;
  plan: string;
  joinedAt: string;
}

const planColor: Record<string, "default" | "info" | "success" | "warning"> = {
  "무료": "warning",
  "베이직": "info",
  "프로": "success",
  "비즈니스": "default",
  "무제한": "default",
};

export function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    // profiles 테이블에서 사용자 정보 + subscriptions 조인
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, created_at")
      .order("created_at", { ascending: false });

    const { data: subs } = await supabase
      .from("subscriptions")
      .select("user_id, plan");

    const subMap = new Map((subs || []).map(s => [s.user_id, s.plan]));

    // auth.users에서 이메일 가져오기 (profiles에 없으므로 session으로는 못 가져옴)
    // 대신 profiles의 name + user_id로 표시
    const rows: UserRow[] = (profiles || []).map(p => ({
      id: p.user_id,
      name: p.name || "(이름 미설정)",
      email: p.user_id.slice(0, 8) + "...",
      plan: subMap.get(p.user_id) || "무료",
      joinedAt: p.created_at ? new Date(p.created_at).toLocaleDateString("ko-KR") : "-",
    }));

    setUsers(rows);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> 가입자 목록
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{users.length}명</span>
          <Button variant="ghost" size="sm" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : users.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">가입자가 없습니다</p>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">이름</th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">ID</th>
                  <th className="text-center px-4 py-2 text-xs text-muted-foreground font-medium">플랜</th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">가입일</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{u.email}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={planColor[u.plan] || "warning"} className="text-xs">{u.plan}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.joinedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Ticket, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface AdminCoupon {
  id: string;
  code: string;
  discount: string;
  expiresAt: string;
  usedCount: number;
  totalIssued: number;
}

const mockCoupons: AdminCoupon[] = [
  { id: "1", code: "WELCOME50", discount: "50%", expiresAt: "2026-05-01", usedCount: 23, totalIssued: 100 },
  { id: "2", code: "SPRING20", discount: "20%", expiresAt: "2026-04-30", usedCount: 45, totalIssued: 200 },
  { id: "3", code: "REFER100", discount: "1개월 무료", expiresAt: "2026-12-31", usedCount: 12, totalIssued: 50 },
];

export function AdminCoupons() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState(mockCoupons);
  const [newCode, setNewCode] = useState("");
  const [newDiscount, setNewDiscount] = useState("");
  const [newExpiry, setNewExpiry] = useState("");

  const handleAdd = () => {
    if (!newCode || !newDiscount) return;
    setCoupons((prev) => [
      ...prev,
      { id: crypto.randomUUID(), code: newCode.toUpperCase(), discount: newDiscount, expiresAt: newExpiry || "2026-12-31", usedCount: 0, totalIssued: 0 },
    ]);
    toast({ title: "✅ 쿠폰이 생성되었습니다." });
    setNewCode("");
    setNewDiscount("");
    setNewExpiry("");
  };

  const handleDelete = (id: string) => {
    setCoupons((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "쿠폰이 삭제되었습니다." });
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Ticket className="w-5 h-5 text-primary" /> 쿠폰 관리
      </h2>

      {/* Create */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold">새 쿠폰 생성</p>
        <div className="grid grid-cols-3 gap-2">
          <input className="bg-secondary rounded-lg px-3 py-2 text-sm outline-none text-foreground uppercase" placeholder="코드" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
          <input className="bg-secondary rounded-lg px-3 py-2 text-sm outline-none text-foreground" placeholder="할인 (예: 50%)" value={newDiscount} onChange={(e) => setNewDiscount(e.target.value)} />
          <input type="date" className="bg-secondary rounded-lg px-3 py-2 text-sm outline-none text-foreground" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
        </div>
        <Button size="sm" onClick={handleAdd}><Plus className="w-4 h-4" /> 생성</Button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {coupons.map((c) => (
          <div key={c.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm font-mono">{c.code}</span>
                <Badge variant="default" className="text-xs">{c.discount}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                사용 {c.usedCount}/{c.totalIssued}건 · 만료: {c.expiresAt}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

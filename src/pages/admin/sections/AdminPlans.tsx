import { useState } from "react";
import { CreditCard, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface PlanData {
  name: string;
  price: number;
  monthlyLimit: number | null;
  platforms: string;
  personas: string;
  maxPhotos: number;
}

const defaultPlans: PlanData[] = [
  { name: "무료", price: 0, monthlyLimit: 5, platforms: "네이버만", personas: "1종", maxPhotos: 2 },
  { name: "베이직", price: 9900, monthlyLimit: 50, platforms: "3개", personas: "3종", maxPhotos: 5 },
  { name: "프로", price: 19900, monthlyLimit: 150, platforms: "전체", personas: "전체", maxPhotos: 10 },
  { name: "무제한", price: 39900, monthlyLimit: null, platforms: "전체", personas: "전체", maxPhotos: 10 },
];

export function AdminPlans() {
  const { toast } = useToast();
  const [plans, setPlans] = useState(defaultPlans);

  const updatePlan = (idx: number, field: keyof PlanData, value: string | number | null) => {
    setPlans((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const handleSave = () => {
    toast({ title: "요금제가 저장되었습니다." });
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-primary" /> 요금제 관리
      </h2>

      <div className="space-y-3">
        {plans.map((plan, idx) => (
          <div key={plan.name} className="bg-card rounded-xl border border-border p-4">
            <p className="font-bold text-sm mb-3">{plan.name}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">가격 (원)</label>
                <input
                  type="number"
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                  value={plan.price}
                  onChange={(e) => updatePlan(idx, "price", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">월 건수</label>
                <input
                  type="number"
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                  value={plan.monthlyLimit ?? 999}
                  onChange={(e) => updatePlan(idx, "monthlyLimit", e.target.value === "999" ? null : Number(e.target.value))}
                  placeholder="무제한은 999"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">최대 사진</label>
                <input
                  type="number"
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                  value={plan.maxPhotos}
                  onChange={(e) => updatePlan(idx, "maxPhotos", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">플랫폼</label>
                <input
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                  value={plan.platforms}
                  onChange={(e) => updatePlan(idx, "platforms", e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button className="w-full" onClick={handleSave}>
        <Save className="w-4 h-4" /> 전체 저장
      </Button>
    </div>
  );
}

import { Building2, Phone, MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/appStore";
import { useToast } from "@/hooks/use-toast";

export function SettingsTab() {
  const { settings, updateSettings } = useAppStore();
  const { toast } = useToast();

  const handleSave = () => {
    toast({ title: "✅ 설정이 저장되었습니다." });
  };

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <h1 className="text-xl font-bold">⚙️ 설정</h1>

      {/* Company Info */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <p className="text-sm font-semibold">업체 정보</p>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Building2 className="w-3 h-3" /> 업체명
          </label>
          <input
            className="w-full bg-secondary rounded-lg px-3 py-3 text-sm outline-none text-foreground"
            placeholder="예) 대한방수"
            value={settings.companyName}
            onChange={(e) => updateSettings({ companyName: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="w-3 h-3" /> 전화번호
          </label>
          <input
            className="w-full bg-secondary rounded-lg px-3 py-3 text-sm outline-none text-foreground"
            placeholder="예) 010-1234-5678"
            value={settings.phoneNumber}
            onChange={(e) => updateSettings({ phoneNumber: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" /> 주요 시공 지역
          </label>
          <input
            className="w-full bg-secondary rounded-lg px-3 py-3 text-sm outline-none text-foreground"
            placeholder="예) 서울 강남, 서초, 송파"
            value={settings.serviceArea}
            onChange={(e) => updateSettings({ serviceArea: e.target.value })}
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <p className="text-sm font-semibold">자동 삽입 설정</p>

        <ToggleRow
          label="업체명·전화번호 본문 자동삽입"
          checked={settings.autoInsertCompany}
          onChange={(v) => updateSettings({ autoInsertCompany: v })}
        />
        <ToggleRow
          label="SEO 키워드 자동삽입"
          checked={settings.autoInsertSeo}
          onChange={(v) => updateSettings({ autoInsertSeo: v })}
        />
      </div>

      {/* Naver Status */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">네이버 딥링크 연동</p>
            <p className="text-xs text-muted-foreground mt-0.5">naver://blog/write</p>
          </div>
          <div className="flex items-center gap-1 text-success">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-semibold">활성</span>
          </div>
        </div>
      </div>

      <Button size="lg" className="w-full" onClick={handleSave}>
        설정 저장
      </Button>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm">{label}</p>
      <button
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full transition-colors relative ${checked ? "bg-primary" : "bg-secondary"}`}
      >
        <div
          className={`absolute top-1 w-5 h-5 rounded-full bg-foreground transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`}
        />
      </button>
    </div>
  );
}

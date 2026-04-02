import { useRef } from "react";
import { ArrowLeft, Building2, Phone, MapPin, Upload, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/appStore";
import { useToast } from "@/hooks/use-toast";

export function ProfileSettings({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings } = useAppStore();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateSettings({ logoUrl: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    toast({ title: "✅ 프로필이 저장되었습니다." });
  };

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">프로필 설정</h1>
      </div>

      {/* Logo Upload */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold">업체 로고</p>
        <div className="flex items-center gap-4">
          <div
            onClick={() => logoInputRef.current?.click()}
            className="w-20 h-20 rounded-xl bg-secondary border-2 border-dashed border-border flex items-center justify-center cursor-pointer overflow-hidden hover:border-primary transition-colors"
          >
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="로고" className="w-full h-full object-cover" />
            ) : (
              <Upload className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            <p>홈 상단 및 생성 글 하단에 표시됩니다</p>
            <p className="mt-1">권장: 200×200px, PNG/JPG</p>
          </div>
        </div>
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
      </div>

      {/* Company Info */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <p className="text-sm font-semibold">업체 정보</p>
        <Field icon={Building2} label="업체명" placeholder="예) 대한방수" value={settings.companyName} onChange={(v) => updateSettings({ companyName: v })} />
        <Field icon={Phone} label="대표 전화번호" placeholder="예) 010-1234-5678" value={settings.phoneNumber} onChange={(v) => updateSettings({ phoneNumber: v })} />
        <Field icon={MapPin} label="주요 시공 지역" placeholder="예) 서울 강남, 서초, 송파" value={settings.serviceArea} onChange={(v) => updateSettings({ serviceArea: v })} />
      </div>

      {/* SNS Connection Status */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold">SNS 연동 상태</p>
        <ConnStatus label="네이버 블로그" connected={settings.naverConnected} />
        <ConnStatus label="인스타그램" connected={settings.instagramConnected} />
        <ConnStatus label="틱톡" connected={settings.tiktokConnected} />
      </div>

      {/* Toggles */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <p className="text-sm font-semibold">자동 삽입 설정</p>
        <ToggleRow label="업체명·전화번호 본문 자동삽입" checked={settings.autoInsertCompany} onChange={(v) => updateSettings({ autoInsertCompany: v })} />
        <ToggleRow label="SEO 키워드 자동삽입" checked={settings.autoInsertSeo} onChange={(v) => updateSettings({ autoInsertSeo: v })} />
      </div>

      <Button size="lg" className="w-full" onClick={handleSave}>설정 저장</Button>
    </div>
  );
}

function Field({ icon: Icon, label, placeholder, value, onChange }: { icon: React.ElementType; label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </label>
      <input
        className="w-full bg-secondary rounded-lg px-3 py-3 text-sm outline-none text-foreground"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ConnStatus({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm">{label}</p>
      <div className={`flex items-center gap-1 ${connected ? "text-success" : "text-muted-foreground"}`}>
        {connected ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
        <span className="text-xs font-semibold">{connected ? "연동됨" : "미연동"}</span>
      </div>
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
        <div className={`absolute top-1 w-5 h-5 rounded-full bg-foreground transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

import { useRef, useEffect, useState } from "react";
import { ArrowLeft, Building2, Phone, MapPin, Upload, Camera, User, FileText, CheckCircle2, XCircle, Briefcase, Check, Loader2 } from "lucide-react";
import { useAppStore, BUSINESS_CATEGORY_LABELS, type BusinessCategory } from "@/stores/appStore";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ProfileSettings({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings } = useAppStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimerRef = useRef<number | null>(null);
  const firstRunRef = useRef(true);

  // ── DB 자동 저장 (debounce 600ms) ──
  useEffect(() => {
    // 최초 마운트 시에는 DB에서 방금 로드된 값이라 저장 불필요
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    if (!user) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    setSaveStatus("saving");
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({
            company_name: settings.companyName,
            phone_number: settings.phoneNumber,
            service_area: settings.serviceArea,
            business_category: settings.businessCategory || "",
            company_description: settings.companyDescription,
            logo_url: settings.logoUrl,
            face_photo_url: settings.facePhotoUrl,
          })
          .eq("user_id", user.id);

        if (error) {
          console.warn("[Profile] save error:", error.message);
          setSaveStatus("error");
          toast({ title: "저장 실패", description: error.message, variant: "destructive" });
        } else {
          setSaveStatus("saved");
          window.setTimeout(() => setSaveStatus("idle"), 1500);
        }
      } catch (e) {
        console.warn("[Profile] save exception:", e);
        setSaveStatus("error");
      }
    }, 600);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [
    settings.companyName,
    settings.phoneNumber,
    settings.serviceArea,
    settings.businessCategory,
    settings.companyDescription,
    settings.logoUrl,
    settings.facePhotoUrl,
    user,
    toast,
  ]);

  const handleImageUpload = (field: "logoUrl" | "facePhotoUrl") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => updateSettings({ [field]: ev.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!settings.companyName.trim()) {
      toast({ title: "업체명을 입력해 주세요", variant: "destructive" });
      return;
    }
    toast({ title: "프로필이 저장되었습니다", description: `${settings.companyName} · ${settings.phoneNumber}` });
  };

  const handleConnect = (platform: string) => {
    toast({ title: `${platform} 업로드 안내`, description: "글 작성 후 복사 → 붙여넣기 방식으로 업로드합니다." });
  };

  return (
    <div className="pb-28 min-h-screen bg-background">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 px-5 pt-4 pb-3 flex items-center gap-3"
        style={{ background: "rgba(14,19,34,0.92)", backdropFilter: "blur(20px)" }}>
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-white/5">
          <ArrowLeft className="w-5 h-5 text-[#C1C6D7]" />
        </button>
        <h1 className="text-xl font-bold text-foreground headline-font">프로필 설정</h1>
        <div className="ml-auto text-xs" aria-live="polite">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> 저장 중…
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Check className="w-3 h-3" /> 저장됨
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-red-400">저장 실패</span>
          )}
        </div>
      </div>

      <div className="px-5 space-y-5">
        {/* 프로필 사진 + 로고 */}
        <div className="glass-card p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">프로필 이미지</p>
          <div className="flex gap-6 items-start">
            {/* 얼굴 사진 */}
            <div className="flex flex-col items-center gap-2">
              <div
                onClick={() => faceInputRef.current?.click()}
                className="w-24 h-24 rounded-full p-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}
              >
                <div className="w-full h-full rounded-full bg-background overflow-hidden flex items-center justify-center">
                  {settings.facePhotoUrl ? (
                    <img src={settings.facePhotoUrl} alt="얼굴" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">대표 사진</span>
              <input ref={faceInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload("facePhotoUrl")} />
            </div>

            {/* 업체 로고 */}
            <div className="flex flex-col items-center gap-2">
              <div
                onClick={() => logoInputRef.current?.click()}
                className="w-24 h-24 rounded-2xl border-2 border-dashed border-border bg-[#161B2B] flex items-center justify-center cursor-pointer hover:border-[#4C8EFF] transition-colors overflow-hidden"
              >
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="로고" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">로고</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">업체 로고</span>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload("logoUrl")} />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">얼굴 사진은 블로그 글 하단, 로고는 쇼츠 영상 엔딩에 표시됩니다</p>
        </div>

        {/* 업체 정보 */}
        <div className="glass-card p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">업체 정보</p>
          <Field icon={Building2} label="업체명" placeholder="예) 우리가게" value={settings.companyName} onChange={(v) => updateSettings({ companyName: v })} />
          <Field icon={Phone} label="대표 전화번호" placeholder="예) 010-1234-5678" value={settings.phoneNumber} onChange={(v) => updateSettings({ phoneNumber: v })} />
          <Field icon={MapPin} label="주요 활동 지역" placeholder="예) 서울 강남, 서초, 송파" value={settings.serviceArea} onChange={(v) => updateSettings({ serviceArea: v })} />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Briefcase className="w-3 h-3" /> 업종 <span className="text-[#EF4444]">*</span>
            </label>
            <select
              className="w-full bg-[#161B2B] border border-white/5 rounded-xl px-3 py-3 text-sm text-foreground focus-visible:outline-none focus:ring-1 focus:ring-[#ADC6FF]/40"
              value={settings.businessCategory || ""}
              onChange={(e) => updateSettings({ businessCategory: e.target.value as BusinessCategory })}
            >
              <option value="">업종을 선택해 주세요</option>
              {(Object.entries(BUSINESS_CATEGORY_LABELS) as [BusinessCategory, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground">AI가 업종에 맞는 용어로 글과 영상을 만들어드립니다</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="w-3 h-3" /> 업체 소개
            </label>
            <textarea
              className="w-full bg-[#161B2B] border border-white/5 rounded-xl px-3 py-3 text-sm text-foreground placeholder-muted-foreground focus-visible:outline-none focus:ring-1 focus:ring-[#ADC6FF]/40 resize-none"
              placeholder="예) 오랜 경력의 전문 업체입니다. 정성껏 작업해 드립니다."
              rows={3}
              value={settings.companyDescription}
              onChange={(e) => updateSettings({ companyDescription: e.target.value })}
            />
          </div>
        </div>

        {/* SNS 연동 */}
        <div className="glass-card p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">SNS 연동 상태</p>
          <ConnStatus label="네이버 블로그" connected={settings.naverConnected} />
          <ConnStatus label="인스타그램" connected={settings.instagramConnected} onConnect={() => handleConnect("인스타그램")} />
          <ConnStatus label="틱톡" connected={settings.tiktokConnected} onConnect={() => handleConnect("틱톡")} />
        </div>

        {/* 자동 삽입 */}
        <div className="glass-card p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">자동 삽입 설정</p>
          <ToggleRow label="업체명·전화번호 본문 자동삽입" checked={settings.autoInsertCompany} onChange={(v) => updateSettings({ autoInsertCompany: v })} />
          <ToggleRow label="SEO 키워드 자동삽입" checked={settings.autoInsertSeo} onChange={(v) => updateSettings({ autoInsertSeo: v })} />
        </div>

        {/* 저장 */}
        <button onClick={handleSave}
          className="w-full h-[52px] rounded-full text-white font-bold text-sm"
          style={{ background: "linear-gradient(135deg, #237FFF, #AB5EBE)" }}>
          설정 저장
        </button>
      </div>
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
        className="w-full bg-[#161B2B] border border-white/5 rounded-xl px-3 py-3 text-sm text-foreground placeholder-muted-foreground focus-visible:outline-none focus:ring-1 focus:ring-[#ADC6FF]/40"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ConnStatus({ label, connected, onConnect }: { label: string; connected: boolean; onConnect?: () => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <p className="text-sm text-[#C1C6D7]">{label}</p>
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1 text-xs font-semibold ${connected ? "text-[#4AE176]" : "text-muted-foreground"}`}>
          {connected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          {connected ? "연동됨" : "미연동"}
        </span>
        {!connected && onConnect && (
          <button onClick={onConnect} className="text-[10px] font-semibold text-primary bg-[#ADC6FF]/10 px-2 py-1 rounded-lg">연결하기</button>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-[#C1C6D7]">{label}</p>
      <button onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative ${checked ? "bg-[#4C8EFF]" : "bg-secondary"}`}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

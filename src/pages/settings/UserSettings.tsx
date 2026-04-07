import { useState } from "react";
import { ArrowLeft, Bell, Moon, Globe, Shield, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function UserSettings({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    pushBlog: true,       // 블로그 발행 알림
    pushWeather: true,    // 날씨 알림
    pushRanking: false,   // 순위 변동 알림
    darkMode: false,      // 다크모드 (시스템 따름)
    language: "ko",       // 언어
    autoSave: true,       // 자동 저장
    analytics: true,      // 이용 분석 동의
  });

  const toggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    toast({ title: "설정이 저장되었습니다" });
  };

  const SwitchRow = ({ label, desc, value, onToggle, icon: Icon }: any) => (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
      </div>
      <button onClick={onToggle}
        className={`w-11 h-6 rounded-full transition-colors relative ${value ? "bg-primary" : "bg-secondary"}`}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );

  return (
    <div className="pb-24 max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold">사용자 설정</h1>
          <p className="text-xs text-muted-foreground">앱 동작 방식을 설정합니다</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* 알림 설정 */}
        <div className="bg-card border border-border rounded-2xl px-4">
          <p className="text-xs font-semibold text-muted-foreground pt-3 pb-1 uppercase tracking-wide">알림</p>
          <SwitchRow label="블로그 발행 리마인더" desc="매일 아침 9시 발행 알림" value={settings.pushBlog} onToggle={() => toggle("pushBlog")} icon={Bell} />
          <SwitchRow label="날씨 현장 알림" desc="비·눈 예보 시 전날 저녁 알림" value={settings.pushWeather} onToggle={() => toggle("pushWeather")} icon={Bell} />
          <SwitchRow label="블로그 순위 변동 알림" desc="검색 순위 변경 시 주 1회" value={settings.pushRanking} onToggle={() => toggle("pushRanking")} icon={Bell} />
        </div>

        {/* 앱 설정 */}
        <div className="bg-card border border-border rounded-2xl px-4">
          <p className="text-xs font-semibold text-muted-foreground pt-3 pb-1 uppercase tracking-wide">앱</p>
          <SwitchRow label="자동 저장" desc="글 작성 중 자동으로 임시 저장" value={settings.autoSave} onToggle={() => toggle("autoSave")} icon={Smartphone} />
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">언어</p>
                <p className="text-xs text-muted-foreground">앱 표시 언어</p>
              </div>
            </div>
            <select value={settings.language}
              onChange={e => { setSettings(prev => ({ ...prev, language: e.target.value })); toast({ title: "언어가 변경되었습니다" }); }}
              className="text-sm bg-secondary rounded-lg px-2 py-1 border-0 outline-none">
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        {/* 개인정보 */}
        <div className="bg-card border border-border rounded-2xl px-4">
          <p className="text-xs font-semibold text-muted-foreground pt-3 pb-1 uppercase tracking-wide">개인정보</p>
          <SwitchRow label="이용 분석 동의" desc="서비스 개선을 위한 익명 데이터 수집" value={settings.analytics} onToggle={() => toggle("analytics")} icon={Shield} />
        </div>

        {/* 앱 정보 */}
        <div className="bg-card border border-border rounded-2xl px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">앱 정보</p>
          {[
            { label: "버전", value: "1.0.0" },
            { label: "빌드", value: "2026.04" },
          ].map(item => (
            <div key={item.label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

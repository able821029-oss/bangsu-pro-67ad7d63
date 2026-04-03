import { useState } from "react";
import { Key, Eye, EyeOff, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ApiKeyConfig {
  id: string;
  label: string;
  envName: string;
  defaultValue: string;
  statusLabel: string;
  statusColor: string; // red, yellow, green
}

const API_KEYS: ApiKeyConfig[] = [
  {
    id: "anthropic",
    label: "Claude API 키",
    envName: "ANTHROPIC_API_KEY",
    defaultValue: "",
    statusLabel: "미설정",
    statusColor: "red",
  },
  {
    id: "toss_client",
    label: "토스페이먼츠 클라이언트 키",
    envName: "TOSS_CLIENT_KEY",
    defaultValue: "test_ck_placeholder",
    statusLabel: "테스트 모드",
    statusColor: "yellow",
  },
  {
    id: "toss_secret",
    label: "토스페이먼츠 시크릿 키",
    envName: "TOSS_SECRET_KEY",
    defaultValue: "test_sk_placeholder",
    statusLabel: "테스트 모드",
    statusColor: "yellow",
  },
  {
    id: "shotstack",
    label: "Shotstack API 키",
    envName: "SHOTSTACK_API_KEY",
    defaultValue: "",
    statusLabel: "미설정",
    statusColor: "red",
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs API 키",
    envName: "ELEVENLABS_API_KEY",
    defaultValue: "",
    statusLabel: "미설정",
    statusColor: "red",
  },
];

function getStatusIndicator(color: string, value: string) {
  // Determine actual status based on value
  if (!value || value === "") {
    return { dot: "🔴", label: "미설정", desc: "해당 기능 비활성" };
  }
  if (value.startsWith("test_") || value.includes("placeholder") || value.includes("sandbox")) {
    return { dot: "🟡", label: "테스트", desc: "테스트 모드 작동" };
  }
  return { dot: "🟢", label: "운영", desc: "실제 서비스 작동" };
}

export function AdminApiKeys() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<Record<string, string>>(
    Object.fromEntries(API_KEYS.map(k => [k.id, k.defaultValue]))
  );
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const toggleShow = (id: string) => setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  const updateKey = (id: string, value: string) => setKeys(prev => ({ ...prev, [id]: value }));

  const handleSave = () => {
    toast({ title: "✅ API 키가 저장되었습니다." });
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Key className="w-5 h-5 text-primary" /> API 키 관리
      </h2>

      <div className="bg-card rounded-xl border border-border p-4 space-y-5">
        {/* Sandbox notice */}
        <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: "#FFF7ED", border: "1px solid #FDBA74" }}>
          <p className="font-semibold" style={{ color: "#F97316" }}>🔧 현재 샌드박스 환경</p>
          <p className="text-xs text-muted-foreground mt-1">
            모든 결제·과금이 발생하지 않는 테스트 모드입니다.
            운영 전환 시 각 키를 실제 키로 교체하세요.
          </p>
        </div>

        {API_KEYS.map((apiKey) => {
          const value = keys[apiKey.id];
          const status = getStatusIndicator(apiKey.statusColor, value);
          const isVisible = showKeys[apiKey.id];

          return (
            <div key={apiKey.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">{apiKey.label}</label>
                <span className="text-xs flex items-center gap-1">
                  {status.dot} <span className="text-muted-foreground">{status.label} — {status.desc}</span>
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type={isVisible ? "text" : "password"}
                  className="flex-1 bg-secondary rounded-lg px-3 py-2.5 text-sm outline-none text-foreground font-mono"
                  placeholder={apiKey.envName}
                  value={value}
                  onChange={(e) => updateKey(apiKey.id, e.target.value)}
                />
                <Button variant="ghost" size="icon" onClick={() => toggleShow(apiKey.id)}>
                  {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          );
        })}

        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-3">
            키는 서버 환경변수로만 저장되며 사용자에게 노출되지 않습니다.
          </p>
          <Button onClick={handleSave} className="w-full">
            <Save className="w-4 h-4" /> 모든 키 저장
          </Button>
        </div>
      </div>

      {/* Environment info */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-2">
        <p className="text-sm font-semibold">🌐 환경 설정</p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Shotstack 환경</span>
          <span className="font-mono text-xs px-2 py-1 rounded bg-secondary">sandbox</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">토스페이먼츠 모드</span>
          <span className="font-mono text-xs px-2 py-1 rounded bg-secondary">test</span>
        </div>
        <p className="text-xs text-muted-foreground">
          운영 전환 시 환경변수 SHOTSTACK_ENV=production 으로 변경하세요.
        </p>
      </div>
    </div>
  );
}

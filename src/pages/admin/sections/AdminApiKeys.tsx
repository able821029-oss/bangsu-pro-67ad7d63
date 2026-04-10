import { useState } from "react";
import { Key, Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface ApiStatus {
  name: string;
  desc: string;
  status: "unknown" | "ok" | "error" | "testing";
  message: string;
}

const initialApis: ApiStatus[] = [
  { name: "Supabase", desc: "데이터베이스 + 인증", status: "unknown", message: "테스트 필요" },
  { name: "Claude API", desc: "AI 글작성 + 쇼츠 스크립트", status: "unknown", message: "테스트 필요" },
  { name: "ElevenLabs", desc: "TTS 나레이션 음성", status: "unknown", message: "테스트 필요" },
  { name: "Railway (영상서버)", desc: "Remotion 영상 렌더링", status: "unknown", message: "테스트 필요" },
];

export function AdminApiKeys() {
  const [apis, setApis] = useState(initialApis);
  const [testing, setTesting] = useState(false);

  const updateApi = (name: string, update: Partial<ApiStatus>) => {
    setApis(prev => prev.map(a => a.name === name ? { ...a, ...update } : a));
  };

  const testAll = async () => {
    setTesting(true);
    setApis(prev => prev.map(a => ({ ...a, status: "testing" as const, message: "테스트 중..." })));

    // 1. Supabase
    try {
      const { count, error } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      if (error) throw error;
      updateApi("Supabase", { status: "ok", message: `연결 정상 (profiles: ${count ?? 0}행)` });
    } catch (e: any) {
      updateApi("Supabase", { status: "error", message: e.message?.slice(0, 60) || "연결 실패" });
    }

    // 2. Claude API (generate-blog Edge Function 경유)
    try {
      const { data, error } = await supabase.functions.invoke("generate-blog", {
        body: { photos: [{ dataUrl: "data:image/png;base64,iVBORw0KGgo=", index: 1 }], workType: "테스트", persona: "장인형", platforms: ["naver"], companyName: "테스트", phoneNumber: "010-0000-0000" },
      });
      if (error) throw error;
      if (data?.title) {
        updateApi("Claude API", { status: "ok", message: `응답 정상 — "${data.title.slice(0, 20)}..."` });
      } else if (data?.error) {
        updateApi("Claude API", { status: "error", message: data.error.slice(0, 60) });
      } else {
        updateApi("Claude API", { status: "error", message: "응답 형식 오류" });
      }
    } catch (e: any) {
      updateApi("Claude API", { status: "error", message: e.message?.slice(0, 60) || "호출 실패" });
    }

    // 3. ElevenLabs (generate-shorts 경유, 짧은 테스트)
    try {
      const { data, error } = await supabase.functions.invoke("generate-shorts", {
        body: { photos: [{ dataUrl: "data:image/png;base64,iVBORw0KGgo=", index: 1 }], workType: "테스트", videoStyle: "시공일지형", narrationType: "있음", voiceId: "male_calm", scriptMode: "auto", maxDurationSec: 15, companyName: "테스트", phoneNumber: "010-0000-0000" },
      });
      if (error) throw error;
      const narCount = data?.narrationAudios?.filter(Boolean).length || 0;
      if (narCount > 0) {
        updateApi("ElevenLabs", { status: "ok", message: `TTS 정상 — ${narCount}개 나레이션 생성` });
      } else {
        updateApi("ElevenLabs", { status: "error", message: "나레이션 생성 실패 (API 키 확인)" });
      }
    } catch (e: any) {
      updateApi("ElevenLabs", { status: "error", message: e.message?.slice(0, 60) || "호출 실패" });
    }

    // 4. Railway 영상 서버
    try {
      const videoServerUrl = import.meta.env.VITE_VIDEO_SERVER_URL || "https://bangsu-pro-67ad7d63-production-6e2e.up.railway.app";
      const res = await fetch(`${videoServerUrl}/health`, { signal: AbortSignal.timeout(10000) });
      const json = await res.json();
      if (json.ok) {
        updateApi("Railway (영상서버)", { status: "ok", message: `v${json.version} 정상 가동` });
      } else {
        updateApi("Railway (영상서버)", { status: "error", message: "서버 응답 이상" });
      }
    } catch {
      updateApi("Railway (영상서버)", { status: "error", message: "서버 응답 없음 (다운 또는 슬립)" });
    }

    setTesting(false);
  };

  const StatusIcon = ({ status }: { status: ApiStatus["status"] }) => {
    switch (status) {
      case "ok": return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "error": return <XCircle className="w-5 h-5 text-red-500" />;
      case "testing": return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
      default: return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" /> API 연결 상태
        </h2>
        <Button variant="outline" size="sm" onClick={testAll} disabled={testing}>
          <RefreshCw className={`w-4 h-4 mr-1 ${testing ? "animate-spin" : ""}`} />
          전체 테스트
        </Button>
      </div>

      <div className="space-y-3">
        {apis.map((api) => (
          <div key={api.name} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
            <StatusIcon status={api.status} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{api.name}</p>
              <p className="text-xs text-muted-foreground">{api.desc}</p>
            </div>
            <p className={`text-xs text-right max-w-[200px] truncate ${api.status === "ok" ? "text-green-400" : api.status === "error" ? "text-red-400" : "text-muted-foreground"}`}>
              {api.message}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-4 space-y-2">
        <p className="text-sm font-semibold">환경변수 안내</p>
        <p className="text-xs text-muted-foreground">
          API 키는 Supabase Edge Function 환경변수로 관리됩니다.<br />
          변경하려면 Supabase Dashboard → Settings → Edge Functions → Secrets에서 수정하세요.
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs mt-2">
          <span className="text-muted-foreground">ANTHROPIC_API_KEY</span><span className="font-mono bg-secondary px-2 py-0.5 rounded">Claude AI</span>
          <span className="text-muted-foreground">ELEVENLABS_API_KEY</span><span className="font-mono bg-secondary px-2 py-0.5 rounded">나레이션 TTS</span>
          <span className="text-muted-foreground">SUPABASE_SERVICE_ROLE_KEY</span><span className="font-mono bg-secondary px-2 py-0.5 rounded">서버 인증</span>
        </div>
      </div>
    </div>
  );
}

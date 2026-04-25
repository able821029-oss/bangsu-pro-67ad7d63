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
  { name: "Shotstack (영상렌더)", desc: "JSON 스펙 → MP4 클라우드 렌더", status: "unknown", message: "테스트 필요" },
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

    // 3. ElevenLabs (전용 테스트 Edge Function — 빠른 확인)
    try {
      const { data, error } = await supabase.functions.invoke("test-elevenlabs", { body: {} });
      if (error) throw error;
      if (data?.ok) {
        const kb = ((data.audioBytes || 0) / 1024).toFixed(1);
        updateApi("ElevenLabs", { status: "ok", message: `TTS 정상 — 오디오 ${kb}KB 생성` });
      } else {
        updateApi("ElevenLabs", { status: "error", message: data?.error?.slice(0, 60) || "키 확인 필요" });
      }
    } catch (e: any) {
      updateApi("ElevenLabs", { status: "error", message: e.message?.slice(0, 60) || "호출 실패" });
    }

    // 4. Shotstack 영상 렌더 — generate-shorts-status 로 더미 ID 조회 → 키 유효성 확인
    try {
      const { data, error } = await supabase.functions.invoke("generate-shorts-status", {
        body: { renderId: "healthcheck-not-a-real-id" },
      });
      // 정상이면 502 (Shotstack 404) 또는 400(형식 오류) 가 떨어진다.
      // 둘 다 SHOTSTACK_API_KEY 가 살아있다는 뜻이므로 ok 처리.
      const errStr = (error?.message || (data as { error?: string } | null)?.error || "").toLowerCase();
      if (errStr.includes("shotstack_api_key")) {
        updateApi("Shotstack (영상렌더)", { status: "error", message: "SHOTSTACK_API_KEY 미설정" });
      } else if (errStr.includes("shotstack")) {
        // Shotstack 측 응답을 받았다는 뜻 (404 등)
        updateApi("Shotstack (영상렌더)", { status: "ok", message: "API 키 유효 (테스트 ID 응답 정상)" });
      } else if (errStr.includes("renderid 형식")) {
        updateApi("Shotstack (영상렌더)", { status: "ok", message: "Edge Function 정상 동작" });
      } else {
        updateApi("Shotstack (영상렌더)", { status: "error", message: errStr.slice(0, 60) || "응답 형식 오류" });
      }
    } catch (e: any) {
      updateApi("Shotstack (영상렌더)", { status: "error", message: e.message?.slice(0, 60) || "호출 실패" });
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

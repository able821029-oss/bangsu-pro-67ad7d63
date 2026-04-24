// 쇼츠 완성 화면 — 플레이어 · 다운로드 · SNS 딥링크
// 2026-04-24 Phase 4 — ShortsCreator.tsx의 done step 분리.
// handleDownload / handleDeeplink는 내부화.

import { lazy, Suspense } from "react";
import { CheckCircle2, Download, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { SmsScene } from "@/remotion/types";
import type { BgmType } from "@/lib/bgmSynth";
import type { PhotoItem } from "@/stores/appStore";

// Remotion Player는 무겁고 인앱 WebView에서 모듈 평가 시 실패 가능 → lazy
const ShortsPlayer = lazy(() => import("@/components/ShortsPlayer"));

interface SettingsForDone {
  companyName: string;
  phoneNumber: string;
  logoUrl: string;
}

export interface ShortsDoneStepProps {
  videoUrl: string | null;
  remotionScenes: SmsScene[];
  photos: PhotoItem[];
  settings: SettingsForDone;
  bgm: BgmType;
  onReset: () => void;
  onClose: () => void;
  toast: (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
}

export function ShortsDoneStep({
  videoUrl,
  remotionScenes,
  photos,
  settings,
  bgm,
  onReset,
  onClose,
  toast,
}: ShortsDoneStepProps) {
  const handleDownload = async () => {
    if (!videoUrl) {
      toast({
        title: "영상이 아직 준비되지 않았어요",
        description: "서버 렌더링이 지연되거나 실패했습니다. '다시 만들기'로 재시도해 주세요.",
        variant: "destructive",
      });
      return;
    }
    try {
      // blob으로 다운로드 — 직접 a[download]는 크로스도메인에서 무시될 수 있음
      const res = await fetch(videoUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sms_shorts_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: "영상이 다운로드됩니다" });
    } catch {
      // 폴백: 새 창으로 열어 브라우저가 다운로드 처리
      window.open(videoUrl, "_blank");
      toast({ title: "새 창에서 영상을 저장해 주세요", description: "우클릭 → 다른 이름으로 저장" });
    }
  };

  const handleDeeplink = (platform: string) => {
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    const links: Record<string, { mobile: string; pc: string }> = {
      tiktok: { mobile: "snssdk1233://", pc: "https://www.tiktok.com/upload" },
      instagram: { mobile: "instagram://", pc: "https://www.instagram.com/" },
    };
    const target = links[platform];
    if (!target) return;
    window.open(isMobile ? target.mobile : target.pc, "_blank");
  };

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto flex flex-col items-center">
      <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-success" />
      </div>
      <h2 className="text-xl font-bold">영상이 완성되었습니다!</h2>

      {remotionScenes.length > 0 ? (
        <div className="w-full max-w-xs rounded-xl border border-border overflow-hidden">
          <ErrorBoundary fallbackTitle="미리보기를 표시할 수 없습니다">
            <Suspense
              fallback={
                <div className="aspect-[9/16] flex items-center justify-center bg-muted">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <ShortsPlayer
                scenes={remotionScenes}
                photos={photos.slice(0, 6).map(p => p.dataUrl)}
                companyName={settings.companyName || "SMS"}
                phoneNumber={settings.phoneNumber || ""}
                logoUrl={settings.logoUrl || undefined}
                bgmType={bgm}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      ) : videoUrl ? (
        <video src={videoUrl} controls autoPlay playsInline
          className="w-full max-w-xs rounded-xl border border-border aspect-[9/16]" />
      ) : (
        <div className="w-full max-w-xs rounded-xl border border-border aspect-[9/16] flex items-center justify-center bg-card">
          <p className="text-sm text-muted-foreground">미리보기를 불러오는 중...</p>
        </div>
      )}

      <div className="w-full max-w-xs space-y-3">
        {/* 저장 — videoUrl이 없으면(서버 렌더 실패) 비활성화 + 설명 */}
        {videoUrl ? (
          <Button
            className="w-full gap-2"
            style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)", color: "white" }}
            onClick={handleDownload}
          >
            <Download className="w-5 h-5" /> 갤러리에 저장
          </Button>
        ) : (
          <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <p className="text-xs text-amber-500 font-semibold">⚠️ 서버 렌더링이 실패했어요</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              잠시 서버가 바쁘거나 일시적 오류일 수 있습니다. 아래 <strong>다시 만들기</strong>를
              눌러 재시도해 주세요.
            </p>
          </div>
        )}
        {/* SNS 업로드 */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center font-medium">SNS 업로드</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => handleDeeplink("tiktok")}
              className="flex flex-col items-center gap-1 py-3 rounded-xl border border-border text-xs font-medium hover:bg-secondary transition-colors">
              <span className="text-lg">⬛</span> 틱톡
            </button>
            <button onClick={() => handleDeeplink("instagram")}
              className="flex flex-col items-center gap-1 py-3 rounded-xl border border-[#E1306C]/40 text-[#E1306C] text-xs font-medium hover:bg-[#E1306C]/5 transition-colors">
              <span className="text-lg">🟣</span> 릴스
            </button>
            <button onClick={() => window.open("https://m.youtube.com/upload", "_blank")}
              className="flex flex-col items-center gap-1 py-3 rounded-xl border border-[#FF0000]/40 text-[#FF0000] text-xs font-medium hover:bg-[#FF0000]/5 transition-colors">
              <span className="text-lg">🔴</span> 쇼츠
            </button>
          </div>
        </div>
        <div className="border-t border-border pt-2 space-y-2">
          <Button variant="secondary" className="w-full gap-2" onClick={onReset}>
            <RotateCcw className="w-4 h-4" /> 다시 만들기
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>홈으로 돌아가기</Button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Download, Trash2, Film, Clock } from "lucide-react";
import { useAppStore, ShortsVideo } from "@/stores/appStore";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { IconChip } from "@/components/IconChip";

/**
 * 완성된 쇼츠 영상 보관함 — 카드 리스트.
 * 썸네일 · 제목 · 생성일 · 다운로드 · 삭제 버튼.
 * Railway MP4 URL이 만료됐을 가능성을 고려해 다운로드 실패 시 안내.
 */
export function ShortsLibrary() {
  const shortsVideos = useAppStore((s) => s.shortsVideos);
  const removeShortsVideo = useAppStore((s) => s.removeShortsVideo);
  const { user } = useAuth();
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (shortsVideos.length === 0) {
    return (
      <div className="glass-card p-6 text-center space-y-2">
        <IconChip icon={Film} color="purple" size="lg" />
        <p className="text-sm font-semibold text-foreground mt-3">아직 보관된 쇼츠 영상이 없어요</p>
        <p className="text-xs text-muted-foreground">
          쇼츠 탭에서 영상을 만들면 여기에 자동으로 보관되어 언제든 다시 다운로드할 수 있어요
        </p>
      </div>
    );
  }

  const handleDownload = async (video: ShortsVideo) => {
    if (!video.videoUrl) {
      toast({ title: "다운로드 URL이 없습니다", variant: "destructive" });
      return;
    }
    setDownloadingId(video.id);
    try {
      // URL 유효성 확인 겸 바이너리로 받아 다운로드 (CORS 허용 필요)
      const res = await fetch(video.videoUrl, { method: "GET" });
      if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${(video.title || "shorts").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40)}_${video.id.slice(0, 6)}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      toast({ title: "영상이 다운로드됩니다" });
    } catch (e) {
      // 폴백: 직접 URL로 새 창 열기 (브라우저가 알아서 다운로드)
      window.open(video.videoUrl, "_blank");
      toast({
        title: "새 창에서 영상이 열렸어요",
        description: "우클릭 → '동영상을 다른 이름으로 저장'으로 내려받으세요.",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (video: ShortsVideo) => {
    if (!window.confirm(`"${video.title}" 영상을 보관함에서 삭제할까요?`)) return;
    removeShortsVideo(video.id);
    if (user) {
      const { error } = await supabase.from("shorts_videos").delete().eq("id", video.id);
      if (error) console.warn("[shorts_videos] DB 삭제 실패:", error.message);
    }
    toast({ title: "삭제되었습니다" });
  };

  return (
    <div className="space-y-2">
      {shortsVideos.map((v) => (
        <div key={v.id} className="glass-card p-3 flex items-center gap-3">
          {/* 썸네일 */}
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#161B2B] shrink-0 flex items-center justify-center">
            {v.thumbnailDataUrl ? (
              <img src={v.thumbnailDataUrl} alt={v.title} className="w-full h-full object-cover" />
            ) : (
              <Film className="w-6 h-6 text-muted-foreground" />
            )}
          </div>

          {/* 메타데이터 */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{v.title}</p>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
              <Clock className="w-3 h-3" />
              <span>{new Date(v.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}</span>
              {v.videoStyle && <span>· {v.videoStyle}</span>}
              {v.photoCount > 0 && <span>· 사진 {v.photoCount}장</span>}
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => handleDownload(v)}
              disabled={downloadingId === v.id}
              aria-label={`${v.title} 다운로드`}
              className="p-2 rounded-lg bg-[#4C8EFF]/15 hover:bg-[#4C8EFF]/25 text-primary disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(v)}
              aria-label={`${v.title} 삭제`}
              className="p-2 rounded-lg bg-white/5 hover:bg-red-500/15 text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

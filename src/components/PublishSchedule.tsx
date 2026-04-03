import { useMemo } from "react";
import { Check } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import type { TabId } from "@/components/BottomNav";

const dayLabels = ["월", "화", "수", "목", "금"];

export function PublishSchedule({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const posts = useAppStore((s) => s.posts);

  const weekStatus = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    return dayLabels.map((label, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateStr = date.toISOString().slice(0, 10);
      const hasPost = posts.some((p) => p.createdAt === dateStr && (p.status === "완료" || p.status === "게시완료"));
      const isPast = date <= now;
      return { label, published: hasPost, isPast, isFuture: !isPast };
    });
  }, [posts]);

  const publishedCount = weekStatus.filter((d) => d.published).length;
  const missedDays = weekStatus.filter((d) => d.isPast && !d.published);
  const latestMissed = missedDays.length > 0 ? missedDays[missedDays.length - 1].label : null;

  return (
    <div className="bg-card rounded-[--radius] border border-border p-4 space-y-3">
      <p className="text-sm font-semibold">이번 주 발행 현황</p>
      <div className="flex justify-between gap-2">
        {weekStatus.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-xs text-muted-foreground">{day.label}</span>
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                day.published
                  ? "bg-green-500/20 border border-green-500/40"
                  : day.isPast
                  ? "bg-secondary border border-border"
                  : "bg-secondary/50 border border-dashed border-border"
              }`}
            >
              {day.published ? <Check className="w-4 h-4 text-green-500" /> : null}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        "주 3회 발행 시 C-Rank 최적화"
      </p>
      {latestMissed && publishedCount < 3 && (
        <div className="space-y-2">
          <p className="text-xs text-primary text-center font-medium">
            → {latestMissed}요일 발행을 놓쳤어요!
          </p>
          <Button size="sm" className="w-full" onClick={() => onNavigate("camera")}>
            지금 글 작성하기
          </Button>
        </div>
      )}
    </div>
  );
}

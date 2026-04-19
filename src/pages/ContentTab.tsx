import { useState } from "react";
import { BlogWriterTab } from "@/pages/BlogWriterTab";
import { CameraTab } from "@/pages/CameraTab";
import { PublishTab } from "@/pages/PublishTab";
import { BlogPost } from "@/stores/appStore";
import { cn } from "@/lib/utils";
import { PenLine, Sparkles, Upload, type LucideIcon } from "lucide-react";
import type { TabId } from "@/components/BottomNav";

type SubTab = "ai" | "write" | "publish";

interface ContentTabProps {
  onNavigate: (tab: string) => void;
  onViewPost: (post: BlogPost) => void;
  initialSubTab?: string;
}

const TABS: Array<{ id: SubTab; icon: LucideIcon; label: string; badge?: string }> = [
  { id: "ai", icon: Sparkles, label: "AI 글쓰기", badge: "추천" },
  { id: "write", icon: PenLine, label: "직접 글쓰기" },
  { id: "publish", icon: Upload, label: "발행 현황" },
];

export function ContentTab({ onNavigate, onViewPost, initialSubTab }: ContentTabProps) {
  const [subTab, setSubTab] = useState<SubTab>(() => {
    if (initialSubTab === "publish") return "publish";
    if (initialSubTab === "write") return "write";
    return "ai"; // 기본값: AI 글쓰기를 최우선 노출
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Sub-tab bar — 더 크고 그라데이션 강조 */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md px-4 pt-3 pb-1">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(({ id, icon: Icon, label, badge }) => {
            const active = subTab === id;
            return (
              <button
                key={id}
                onClick={() => setSubTab(id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all",
                  active
                    ? "text-white shadow-lg"
                    : "text-muted-foreground bg-white/5 hover:bg-white/10",
                )}
                style={
                  active
                    ? { background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }
                    : undefined
                }
              >
                <Icon className="w-4 h-4" />
                {label}
                {badge && (
                  <span
                    className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-primary/15 text-primary",
                    )}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {subTab === "write" && (
        <BlogWriterTab onNavigate={onNavigate as (t: TabId) => void} onViewPost={onViewPost} />
      )}
      {subTab === "ai" && <CameraTab onNavigate={onNavigate} onViewPost={onViewPost} />}
      {subTab === "publish" && <PublishTab onNavigate={onNavigate} onViewPost={onViewPost} />}
    </div>
  );
}

import { useState } from "react";
import { BlogWriterTab } from "@/pages/BlogWriterTab";
import { CameraTab } from "@/pages/CameraTab";
import { PublishTab } from "@/pages/PublishTab";
import { BlogPost } from "@/stores/appStore";
import { cn } from "@/lib/utils";
import { PenLine, Sparkles, Upload, type LucideIcon } from "lucide-react";
import type { TabId } from "@/components/BottomNav";

type SubTab = "write" | "ai" | "publish";

interface ContentTabProps {
  onNavigate: (tab: string) => void;
  onViewPost: (post: BlogPost) => void;
  initialSubTab?: string;
}

const TABS: Array<{ id: SubTab; icon: LucideIcon; label: string }> = [
  { id: "write", icon: PenLine, label: "직접 글쓰기" },
  { id: "ai", icon: Sparkles, label: "AI 글쓰기" },
  { id: "publish", icon: Upload, label: "발행 현황" },
];

export function ContentTab({ onNavigate, onViewPost, initialSubTab }: ContentTabProps) {
  const [subTab, setSubTab] = useState<SubTab>(() => {
    if (initialSubTab === "publish") return "publish";
    if (initialSubTab === "ai") return "ai";
    return "write";
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Sub-tab bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md px-4 pt-3">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors font-[Inter]",
                subTab === id
                  ? "bg-[#4C8EFF] text-[#00285C]"
                  : "text-muted-foreground hover:bg-white/5",
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
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

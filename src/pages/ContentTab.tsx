import { useState } from "react";
import { CameraTab } from "@/pages/CameraTab";
import { ShortsTab } from "@/pages/ShortsTab";
import { PublishTab } from "@/pages/PublishTab";
import { BlogPost } from "@/stores/appStore";
import { cn } from "@/lib/utils";
import { PenLine, Film, Upload } from "lucide-react";

type SubTab = "write" | "shorts" | "publish";

interface ContentTabProps {
  onNavigate: (tab: string) => void;
  onViewPost: (post: BlogPost) => void;
  initialSubTab?: SubTab;
}

export function ContentTab({ onNavigate, onViewPost, initialSubTab }: ContentTabProps) {
  const [subTab, setSubTab] = useState<SubTab>(initialSubTab || "write");

  return (
    <div className="min-h-screen bg-[#0E1322]">
      {/* Sub-tab bar — Stitch */}
      <div className="sticky top-0 z-10 bg-[#0E1322]/95 backdrop-blur-md px-4 pt-3">
        <div className="flex gap-1">
          {([
            { id: "write" as SubTab, icon: PenLine, label: "글작성" },
            { id: "shorts" as SubTab, icon: Film, label: "영상" },
            { id: "publish" as SubTab, icon: Upload, label: "발행" },
          ]).map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setSubTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors font-[Inter]",
                subTab === id
                  ? "bg-[#4C8EFF] text-[#00285C]"
                  : "text-[#8B90A0] hover:bg-white/5"
              )}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      {subTab === "write" && <CameraTab onNavigate={onNavigate} onViewPost={onViewPost} />}
      {subTab === "shorts" && <ShortsTab onNavigate={onNavigate} />}
      {subTab === "publish" && <PublishTab onNavigate={onNavigate} onViewPost={onViewPost} />}
    </div>
  );
}

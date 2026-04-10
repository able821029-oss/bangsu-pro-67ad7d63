import { useState } from "react";
import { CameraTab } from "@/pages/CameraTab";
import { PublishTab } from "@/pages/PublishTab";
import { BlogPost } from "@/stores/appStore";
import { cn } from "@/lib/utils";
import { PenLine, Upload } from "lucide-react";

type SubTab = "write" | "publish";

interface ContentTabProps {
  onNavigate: (tab: string) => void;
  onViewPost: (post: BlogPost) => void;
  initialSubTab?: string;
}

export function ContentTab({ onNavigate, onViewPost, initialSubTab }: ContentTabProps) {
  const [subTab, setSubTab] = useState<SubTab>(
    initialSubTab === "publish" ? "publish" : "write"
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Sub-tab bar — 글작성 + 발행 */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md px-4 pt-3">
        <div className="flex gap-1">
          {([
            { id: "write" as SubTab, icon: PenLine, label: "AI 글작성" },
            { id: "publish" as SubTab, icon: Upload, label: "발행 현황" },
          ]).map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setSubTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors font-[Inter]",
                subTab === id
                  ? "bg-[#4C8EFF] text-[#00285C]"
                  : "text-muted-foreground hover:bg-white/5"
              )}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      {subTab === "write" && <CameraTab onNavigate={onNavigate} onViewPost={onViewPost} />}
      {subTab === "publish" && <PublishTab onNavigate={onNavigate} onViewPost={onViewPost} />}
    </div>
  );
}

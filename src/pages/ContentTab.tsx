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
}

export function ContentTab({ onNavigate, onViewPost }: ContentTabProps) {
  const [subTab, setSubTab] = useState<SubTab>("write");

  return (
    <div className="min-h-screen bg-background">
      {/* Sub-tab bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-3">
        <div className="flex gap-1">
          {([
            { id: "write" as SubTab, icon: PenLine, label: "글작성" },
            { id: "shorts" as SubTab, icon: Film, label: "영상" },
            { id: "publish" as SubTab, icon: Upload, label: "발행" },
          ]).map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setSubTab(id)}
              className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                subTab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
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

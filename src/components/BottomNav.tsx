import { Home, PenLine, Film, Upload, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "home" | "camera" | "shorts" | "publish" | "settings";

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div
        className="h-4 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--nav-background)))" }}
      />
      <div className="bg-[hsl(var(--nav-background))] border-t border-border">
        <div className="grid grid-cols-5 items-end h-16 max-w-lg mx-auto px-1">

          {/* 홈 */}
          <button onClick={() => onTabChange("home")}
            className={cn("flex flex-col items-center justify-end gap-1 pb-2 h-full transition-colors",
              activeTab === "home" ? "text-[#237FFF]" : "text-[#6B7E99]")}>
            <Home className={cn("w-5 h-5", activeTab === "home" && "drop-shadow-[0_0_8px_#237FFF]")} />
            <span className="text-[10px] font-medium">홈</span>
          </button>

          {/* 글작성 */}
          <button onClick={() => onTabChange("camera")}
            className={cn("flex flex-col items-center justify-end gap-1 pb-2 h-full transition-colors",
              activeTab === "camera" ? "text-[#237FFF]" : "text-[#6B7E99]")}>
            <PenLine className={cn("w-5 h-5", activeTab === "camera" && "drop-shadow-[0_0_8px_#237FFF]")} />
            <span className="text-[10px] font-medium">글작성</span>
          </button>

          {/* 발행현황 — 가운데 원형 */}
          <button onClick={() => onTabChange("publish")}
            className="flex flex-col items-center justify-end pb-1 h-full">
            <div className={cn(
              "w-[52px] h-[52px] -mt-4 rounded-full flex items-center justify-center shadow-lg transition-all bg-brand-gradient",
              activeTab === "publish" ? "shadow-primary/40 scale-105" : "shadow-primary/20")}>
              <Upload className="w-6 h-6 text-white" />
            </div>
            <span className={cn("text-[10px] font-medium mt-1",
              activeTab === "publish" ? "text-[#237FFF]" : "text-[#6B7E99]")}>발행</span>
          </button>

          {/* 쇼츠 */}
          <button onClick={() => onTabChange("shorts")}
            className={cn("flex flex-col items-center justify-end gap-1 pb-2 h-full transition-colors",
              activeTab === "shorts" ? "text-amber-500" : "text-[#6B7E99]")}>
            <Film className={cn("w-5 h-5", activeTab === "shorts" && "drop-shadow-[0_0_8px_#EF9F27]")} />
            <span className="text-[10px] font-medium">영상</span>
          </button>

          {/* 설정 */}
          <button onClick={() => onTabChange("settings")}
            className={cn("flex flex-col items-center justify-end gap-1 pb-2 h-full transition-colors",
              activeTab === "settings" ? "text-[#237FFF]" : "text-[#6B7E99]")}>
            <Settings className={cn("w-5 h-5", activeTab === "settings" && "drop-shadow-[0_0_8px_#237FFF]")} />
            <span className="text-[10px] font-medium">설정</span>
          </button>

        </div>
      </div>
    </nav>
  );
}

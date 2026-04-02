import { Home, Camera, FileText, Upload, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "home" | "camera" | "writer" | "upload" | "settings";

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "home", label: "홈", icon: Home },
  { id: "camera", label: "촬영", icon: Camera },
  { id: "writer", label: "AI글쓰기", icon: FileText },
  { id: "upload", label: "업로드", icon: Upload },
  { id: "settings", label: "설정", icon: Settings },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-6 h-6", isActive && "drop-shadow-[0_0_8px_hsl(25,95%,55%)]")} />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

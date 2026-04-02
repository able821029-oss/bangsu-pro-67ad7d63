import { Home, Camera, Upload, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "home" | "camera" | "publish" | "settings";

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: React.ElementType; isCenter?: boolean }[] = [
  { id: "home", label: "홈", icon: Home },
  { id: "camera", label: "촬영", icon: Camera },
  { id: "publish", label: "발행현황", icon: Upload, isCenter: true },
  { id: "settings", label: "설정", icon: Settings },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div
        className="h-4 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(238,242,248,0), #001130)" }}
      />
      <div style={{ backgroundColor: '#001130' }}>
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            if (tab.isCenter) {
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className="relative -mt-6 flex flex-col items-center"
                >
                  <div
                    className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all bg-brand-gradient",
                      isActive ? "shadow-primary/40" : "shadow-primary/20 opacity-90"
                    )}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium mt-1",
                    isActive ? "text-[#237FFF]" : "text-[#6B7E99]"
                    )}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                  isActive ? "text-[#237FFF]" : "text-[#6B7E99]"
                )}
              >
                <Icon className={cn("w-6 h-6", isActive && "drop-shadow-[0_0_8px_#237FFF]")} />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

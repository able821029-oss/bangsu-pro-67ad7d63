import { Home, Calendar, PenLine, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "home" | "calendar" | "content" | "mypage" | "camera" | "shorts" | "publish" | "settings";

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: "home" as TabId, icon: Home, label: "홈" },
    { id: "calendar" as TabId, icon: Calendar, label: "일정" },
    { id: "content" as TabId, icon: PenLine, label: "콘텐츠" },
    { id: "mypage" as TabId, icon: User, label: "마이" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div
        className="h-4 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--nav-background)))" }}
      />
      <div className="bg-[hsl(var(--nav-background))] border-t border-border">
        <div className="grid grid-cols-4 items-end h-16 max-w-lg mx-auto px-1">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => onTabChange(id)}
              className={cn("flex flex-col items-center justify-end gap-1 pb-2 h-full transition-colors",
                activeTab === id ? "text-primary" : "text-muted-foreground")}>
              <Icon className={cn("w-5 h-5", activeTab === id && "drop-shadow-[0_0_8px_hsl(var(--primary))]")} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

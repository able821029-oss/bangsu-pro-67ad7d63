import { Home, Calendar, Sparkles, User } from "lucide-react";
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
    { id: "content" as TabId, icon: Sparkles, label: "콘텐츠" },
    { id: "mypage" as TabId, icon: User, label: "마이" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div
        className="h-[84px] bg-[#0E1322]/80 backdrop-blur-xl border-t border-white/10 rounded-t-[40px] shadow-[0_-12px_32px_rgba(0,0,0,0.4)] flex justify-around items-center px-6 pb-6"
      >
        {tabs.map(({ id, icon: Icon, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-full p-2 transition-colors duration-300",
                isActive
                  ? "text-[#237FFF] bg-white/5"
                  : "text-[#414754] hover:text-[#4C8EFF]",
              )}
            >
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className="font-bold text-[10px] tracking-wide">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

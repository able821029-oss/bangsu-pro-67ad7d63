import { Home, Calendar, Film, Sparkles, User } from "lucide-react";
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
    { id: "shorts" as TabId, icon: Film, label: "쇼츠", center: true },
    { id: "content" as TabId, icon: Sparkles, label: "글작성" },
    { id: "mypage" as TabId, icon: User, label: "마이" },
  ];

  return (
    <nav aria-label="주요 메뉴" className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div
        className="h-[84px] bg-background/80 backdrop-blur-xl border-t border-white/10 rounded-t-[40px] shadow-[0_-12px_32px_rgba(0,0,0,0.4)] flex justify-around items-center px-4 pb-6"
      >
        {tabs.map(({ id, icon: Icon, label, center }) => {
          const isActive = activeTab === id || (id === "shorts" && activeTab === "shorts");
          if (center) {
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className="relative -mt-6 flex flex-col items-center"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(35,127,255,0.4)] active:scale-90 transition-transform"
                  style={{ background: "linear-gradient(135deg, #237FFF, #AB5EBE)" }}
                >
                  <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-bold mt-1 text-primary">{label}</span>
              </button>
            );
          }
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
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

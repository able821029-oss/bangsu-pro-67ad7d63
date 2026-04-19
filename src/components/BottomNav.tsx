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
        className="h-[84px] backdrop-blur-2xl border-t border-white/10 rounded-t-[32px] flex justify-around items-center px-4 pb-6"
        style={{
          background: "linear-gradient(180deg, rgba(14,19,34,0.92), rgba(14,19,34,0.98))",
          boxShadow: "0 -12px 32px rgba(0,0,0,0.4), 0 -1px 0 rgba(76,142,255,0.18) inset",
        }}
      >
        {tabs.map(({ id, icon: Icon, label, center }) => {
          const isActive = activeTab === id;
          if (center) {
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className="relative -mt-7 flex flex-col items-center"
              >
                <div
                  className="w-[58px] h-[58px] rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
                  style={{
                    background: "linear-gradient(135deg, #237FFF, #AB5EBE)",
                    boxShadow:
                      "0 8px 24px rgba(35,127,255,0.5), 0 0 20px rgba(76,142,255,0.4), 0 1px 0 rgba(255,255,255,0.2) inset",
                  }}
                >
                  <Icon className="w-7 h-7 text-white" strokeWidth={2.2} />
                </div>
                <span className="text-[10px] font-bold mt-1.5 text-primary tracking-wide">{label}</span>
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
                "flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-2xl transition-all duration-300",
                isActive ? "nav-active-bg text-[#4C8EFF]" : "text-[#6B7180] hover:text-[#4C8EFF]",
              )}
            >
              <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.4 : 1.8} />
              <span className={cn("font-semibold text-[10px] tracking-wide", isActive && "text-glow")}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

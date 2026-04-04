import { ShortsCreator } from "@/components/ShortsCreator";
import type { TabId } from "@/components/BottomNav";

export function ShortsTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  return <ShortsCreator onClose={() => onNavigate("home")} />;
}

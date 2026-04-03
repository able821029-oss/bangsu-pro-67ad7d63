import { useState, useEffect } from "react";
import { BottomNav, TabId } from "@/components/BottomNav";
import { InstallBanner } from "@/components/InstallBanner";
import { HomeTab } from "@/pages/HomeTab";
import { CameraTab } from "@/pages/CameraTab";
import { PublishTab } from "@/pages/PublishTab";
import { SeoTab } from "@/pages/SeoTab";
import { SettingsTab } from "@/pages/SettingsTab";
import { PostDetailPage } from "@/pages/PostDetailPage";
import { BlogPost } from "@/stores/appStore";

function SplashScreen({ onDone }: { onDone: () => void }) {
  const [opacity, setOpacity] = useState(0);
  useEffect(() => {
    requestAnimationFrame(() => setOpacity(1));
    const timer = setTimeout(onDone, 1600);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
      style={{ opacity, transition: "opacity 0.8s ease-in" }}
    >
      {/* ✅ FIX: 그라데이션 배경 + 흰색 S */}
      <svg width="80" height="80" viewBox="0 0 64 64" fill="none" className="mb-4">
        <defs>
          <linearGradient id="splashSg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#237FFF" />
            <stop offset="100%" stopColor="#AB5EBE" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#splashSg)" />
        <text
          x="8"
          y="52"
          fontFamily="Arial Black, Helvetica Neue, sans-serif"
          fontWeight="900"
          fontSize="52"
          fill="#FFFFFF"
        >
          S
        </text>
      </svg>
      <p className="text-foreground font-bold text-[28px]">SMS</p>
      {/* ✅ FIX: 셀프마케팅서비스 텍스트 선명하게 */}
      <p className="text-[11px] mt-1 font-semibold tracking-widest" style={{ color: "rgba(180,180,200,0.9)" }}>
        셀프마케팅서비스
      </p>
    </div>
  );
}

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [viewingPost, setViewingPost] = useState<BlogPost | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const handleViewPost = (post: BlogPost) => {
    setViewingPost(post);
  };
  const handleBackFromPost = () => {
    setViewingPost(null);
  };
  if (showSplash) {
    return <SplashScreen onDone={() => setShowSplash(false)} />;
  }
  if (viewingPost) {
    return (
      <div className="min-h-screen bg-background">
        <PostDetailPage post={viewingPost} onBack={handleBackFromPost} onNavigate={setActiveTab} />
      </div>
    );
  }
  const renderTab = () => {
    switch (activeTab) {
      case "home":
        return <HomeTab onNavigate={setActiveTab} onViewPost={handleViewPost} />;
      case "camera":
        return <CameraTab onNavigate={setActiveTab} onViewPost={handleViewPost} />;
      case "publish":
        return <PublishTab onNavigate={setActiveTab} onViewPost={handleViewPost} />;
      case "seo":
        return <SeoTab onNavigate={setActiveTab} />;
      case "settings":
        return <SettingsTab />;
    }
  };
  return (
    <div className="min-h-screen bg-background">
      {renderTab()}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      <InstallBanner />
    </div>
  );
};
export default Index;

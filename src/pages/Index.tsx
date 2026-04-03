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
      style={{ opacity, transition: 'opacity 0.8s ease-in' }}
    >
      <svg width="80" height="80" viewBox="0 0 64 64" fill="none" className="mb-4">
        <rect width="64" height="64" rx="16" fill="hsl(215 100% 50%)"/>
        <defs>
          <linearGradient id="splashSg" x1="14" y1="10" x2="50" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#237FFF"/>
            <stop offset="52%" stopColor="#6C5CE7"/>
            <stop offset="100%" stopColor="#AB5EBE"/>
          </linearGradient>
        </defs>
        <text x="8" y="52" fontFamily="Arial Black, Helvetica Neue, sans-serif" fontWeight="900" fontSize="52" fill="url(#splashSg)">S</text>
      </svg>
      <p className="text-foreground font-bold text-[28px]">SMS</p>
      <p className="text-[12px] mt-1 text-muted-foreground">SELF MARKETING SERVICE</p>
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

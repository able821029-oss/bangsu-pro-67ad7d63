import { useState, useEffect } from "react";
import { BottomNav, TabId } from "@/components/BottomNav";
import { InstallBanner } from "@/components/InstallBanner";
import { HomeTab } from "@/pages/HomeTab";
import { CameraTab } from "@/pages/CameraTab";
import { PublishTab } from "@/pages/PublishTab";
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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ backgroundColor: '#001130', opacity, transition: 'opacity 0.8s ease-in' }}
    >
      <svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" className="w-16 h-12 mb-4">
        <defs>
          <linearGradient id="splashGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: '#237FFF' }} />
            <stop offset="100%" style={{ stopColor: '#AB5EBE' }} />
          </linearGradient>
        </defs>
        <path d="M20,20 C20,13 13,8 8,12 C3,16 3,24 8,28 C13,32 20,27 20,20 C20,13 27,8 32,8 C40,8 45,14 45,20 C45,26 40,32 32,32 C27,32 20,27 20,20 Z" fill="none" stroke="url(#splashGrad)" strokeWidth="4" strokeLinecap="round"/>
        <path d="M42,14 L46,18 L42,22" fill="none" stroke="url(#splashGrad)" strokeWidth="3" strokeLinecap="round"/>
      </svg>
      <p className="text-white font-bold text-[28px]">SMS</p>
      <p className="text-[12px] mt-1" style={{ color: '#AB5EBE' }}>Self Marketing Service</p>
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

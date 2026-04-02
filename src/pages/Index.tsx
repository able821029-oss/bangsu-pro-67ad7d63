import { useState } from "react";
import { BottomNav, TabId } from "@/components/BottomNav";
import { InstallBanner } from "@/components/InstallBanner";
import { HomeTab } from "@/pages/HomeTab";
import { CameraTab } from "@/pages/CameraTab";
import { PublishTab } from "@/pages/PublishTab";
import { SettingsTab } from "@/pages/SettingsTab";
import { PostDetailPage } from "@/pages/PostDetailPage";
import { BlogPost } from "@/stores/appStore";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [viewingPost, setViewingPost] = useState<BlogPost | null>(null);

  const handleViewPost = (post: BlogPost) => {
    setViewingPost(post);
  };

  const handleBackFromPost = () => {
    setViewingPost(null);
  };

  if (viewingPost) {
    return (
      <div className="min-h-screen bg-background">
        <PostDetailPage post={viewingPost} onBack={handleBackFromPost} />
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

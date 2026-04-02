import { useState } from "react";
import { BottomNav, TabId } from "@/components/BottomNav";
import { HomeTab } from "@/pages/HomeTab";
import { CameraTab } from "@/pages/CameraTab";
import { PublishTab } from "@/pages/PublishTab";
import { SettingsTab } from "@/pages/SettingsTab";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("home");

  const renderTab = () => {
    switch (activeTab) {
      case "home":
        return <HomeTab onNavigate={setActiveTab} />;
      case "camera":
        return <CameraTab onNavigate={setActiveTab} />;
      case "publish":
        return <PublishTab onNavigate={setActiveTab} />;
      case "settings":
        return <SettingsTab />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {renderTab()}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;

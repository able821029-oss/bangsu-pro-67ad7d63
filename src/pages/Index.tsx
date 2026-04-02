import { useState } from "react";
import { BottomNav, TabId } from "@/components/BottomNav";
import { HomeTab } from "@/pages/HomeTab";
import { CameraTab } from "@/pages/CameraTab";
import { WriterTab } from "@/pages/WriterTab";
import { UploadTab } from "@/pages/UploadTab";
import { SettingsTab } from "@/pages/SettingsTab";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("home");

  const renderTab = () => {
    switch (activeTab) {
      case "home":
        return <HomeTab onNavigate={setActiveTab} />;
      case "camera":
        return <CameraTab onNavigate={setActiveTab} />;
      case "writer":
        return <WriterTab onNavigate={setActiveTab} />;
      case "upload":
        return <UploadTab />;
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

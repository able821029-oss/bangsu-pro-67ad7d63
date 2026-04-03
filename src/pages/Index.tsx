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
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // 로고 등장
    const t1 = setTimeout(() => setPhase(1), 50);
    // SMS 텍스트 등장
    const t2 = setTimeout(() => setPhase(2), 400);
    // 서브텍스트 등장
    const t3 = setTimeout(() => setPhase(3), 700);
    // 화면 전환
    const t4 = setTimeout(onDone, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">

      {/* 배경 원형 글로우 */}
      <div style={{
        position: "absolute",
        width: 320,
        height: 320,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(35,127,255,0.12) 0%, transparent 70%)",
        transform: `scale(${phase >= 1 ? 1 : 0.3})`,
        transition: "transform 0.8s cubic-bezier(0.34,1.56,0.64,1)",
        pointerEvents: "none",
      }} />

      {/* 로고 아이콘 */}
      <svg
        width="88" height="88" viewBox="0 0 64 64" fill="none"
        style={{
          transform: `scale(${phase >= 1 ? 1 : 0}) rotate(${phase >= 1 ? 0 : -15}deg)`,
          transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
          filter: phase >= 1 ? "drop-shadow(0 8px 24px rgba(35,127,255,0.4))" : "none",
          marginBottom: 20,
        }}
      >
        <defs>
          <linearGradient id="splashSg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#237FFF" />
            <stop offset="100%" stopColor="#AB5EBE" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#splashSg)" />
        <text
          x="8" y="52"
          fontFamily="Arial Black, Helvetica Neue, sans-serif"
          fontWeight="900"
          fontSize="52"
          fill="#FFFFFF"
        >S</text>
      </svg>

      {/* SMS 텍스트 */}
      <p style={{
        fontSize: 32,
        fontWeight: 900,
        letterSpacing: 6,
        background: "linear-gradient(90deg, #237FFF, #AB5EBE)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        opacity: phase >= 2 ? 1 : 0,
        transform: `translateY(${phase >= 2 ? 0 : 12}px)`,
        transition: "opacity 0.4s ease, transform 0.4s ease",
        margin: 0,
      }}>SMS</p>

      {/* 서브 텍스트 */}
      <p style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 4,
        color: "rgba(180,180,200,0.85)",
        textTransform: "uppercase",
        marginTop: 8,
        opacity: phase >= 3 ? 1 : 0,
        transform: `translateY(${phase >= 3 ? 0 : 8}px)`,
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}>셀프마케팅서비스</p>

    </div>
  );
}

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [viewingPost, setViewingPost] = useState<BlogPost | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const handleViewPost = (post: BlogPost) => { setViewingPost(post); };
  const handleBackFromPost = () => { setViewingPost(null); };
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
      case "home": return <HomeTab onNavigate={setActiveTab} onViewPost={handleViewPost} />;
      case "camera": return <CameraTab onNavigate={setActiveTab} onViewPost={handleViewPost} />;
      case "publish": return <PublishTab onNavigate={setActiveTab} onViewPost={handleViewPost} />;
      case "seo": return <SeoTab onNavigate={setActiveTab} />;
      case "settings": return <SettingsTab />;
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

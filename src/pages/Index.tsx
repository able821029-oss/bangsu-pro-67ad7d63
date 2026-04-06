import { useState, useEffect, useCallback } from "react";
import { BottomNav, TabId } from "@/components/BottomNav";
import { InstallBanner } from "@/components/InstallBanner";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import AuthPage from "@/pages/AuthPage";
import { HomeTab } from "@/pages/HomeTab";
import { CalendarTab } from "@/pages/CalendarTab";
import { ContentTab } from "@/pages/ContentTab";
import { MyPage } from "@/pages/MyPage";
import { PostDetailPage } from "@/pages/PostDetailPage";
import { BlogPost } from "@/stores/appStore";

function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    const outTimer = setTimeout(() => setPhase("out"), 1100);
    const doneTimer = setTimeout(onDone, 1500);
    return () => { clearTimeout(outTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "linear-gradient(145deg, #060D1F 0%, #0E0720 60%, #150822 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        opacity: phase === "out" ? 0 : 1, transition: "opacity 0.4s ease-out",
      }}
    >
      <style>{`
        @keyframes logoIn { 0%{transform:scale(0.3) rotate(-10deg);opacity:0} 65%{transform:scale(1.15) rotate(2deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
        @keyframes fadeUp { from{transform:translateY(14px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes glowPulse { 0%,100%{opacity:.35;transform:scale(1)} 50%{opacity:.55;transform:scale(1.08)} }
        .splash-logo { animation: logoIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both }
        .splash-text { animation: fadeUp 0.45s ease-out 0.55s both }
        .splash-sub  { animation: fadeUp 0.45s ease-out 0.72s both }
        .splash-glow { animation: glowPulse 2s ease-in-out infinite }
      `}</style>
      <div className="splash-glow" style={{ position:"absolute", width:260, height:260, borderRadius:"50%", background:"radial-gradient(circle,rgba(35,127,255,.18) 0%,rgba(171,94,190,.10) 50%,transparent 70%)", pointerEvents:"none" }} />
      <div className="splash-logo" style={{ marginBottom:20, position:"relative", zIndex:1 }}>
        <svg width="100" height="100" viewBox="0 0 64 64" fill="none">
          <defs><linearGradient id="splashSg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#237FFF"/><stop offset="100%" stopColor="#AB5EBE"/></linearGradient></defs>
          <rect width="64" height="64" rx="18" fill="url(#splashSg)"/>
          <text x="8" y="52" fontFamily="Arial Black, Helvetica Neue, sans-serif" fontWeight="900" fontSize="52" fill="#FFFFFF">S</text>
        </svg>
      </div>
      <p className="splash-text" style={{ fontWeight:900, fontSize:38, letterSpacing:"-0.5px", lineHeight:1, background:"linear-gradient(90deg,#237FFF,#AB5EBE)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", position:"relative", zIndex:1 }}>SMS</p>
      <p className="splash-sub" style={{ marginTop:8, fontSize:11, fontWeight:600, letterSpacing:"4px", textTransform:"uppercase", color:"rgba(180,185,210,.65)", position:"relative", zIndex:1 }}>셀프마케팅서비스</p>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [viewingPost, setViewingPost] = useState<BlogPost | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  const handleViewPost = (post: BlogPost) => setViewingPost(post);
  const handleBackFromPost = () => setViewingPost(null);
  const handleSplashDone = useCallback(() => setShowSplash(false), []);

  if (showSplash) return <SplashScreen onDone={handleSplashDone} />;
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <AuthPage />;

  if (viewingPost) {
    return (
      <div className="min-h-screen bg-background">
        <PostDetailPage post={viewingPost} onBack={handleBackFromPost} onNavigate={(t) => setActiveTab(t as TabId)} />
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case "home":     return <HomeTab onNavigate={(t) => setActiveTab(t as TabId)} onViewPost={handleViewPost} />;
      case "calendar": return <CalendarTab />;
      case "content":  return <ContentTab onNavigate={(t) => setActiveTab(t as TabId)} onViewPost={handleViewPost} />;
      case "mypage":   return <MyPage />;
      default:         return <HomeTab onNavigate={(t) => setActiveTab(t as TabId)} onViewPost={handleViewPost} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {renderTab()}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      <InstallBanner />
    </div>
  );
}

const Index = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default Index;

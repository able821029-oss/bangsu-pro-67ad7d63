import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { BottomNav, TabId } from "@/components/BottomNav";
import { InstallBanner } from "@/components/InstallBanner";
import { OnboardingSlides } from "@/components/OnboardingSlides";
import { AdminFab } from "@/components/AdminFab";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { HomeTab } from "@/pages/HomeTab";
import { BlogPost } from "@/stores/appStore";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// 초기 로딩엔 HomeTab만 필요 — 나머지 탭/페이지는 lazy
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const CalendarTab = lazy(() => import("@/pages/CalendarTab").then(m => ({ default: m.CalendarTab })));
const ContentTab = lazy(() => import("@/pages/ContentTab").then(m => ({ default: m.ContentTab })));
const ShortsTab = lazy(() => import("@/pages/ShortsTab").then(m => ({ default: m.ShortsTab })));
const MyPage = lazy(() => import("@/pages/MyPage").then(m => ({ default: m.MyPage })));
const PostDetailPage = lazy(() => import("@/pages/PostDetailPage").then(m => ({ default: m.PostDetailPage })));
const ReviewsPage = lazy(() => import("@/pages/ReviewsPage").then(m => ({ default: m.ReviewsPage })));

const LoadingFallback = () => (
  <div
    className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4"
    style={{ minHeight: "100dvh" }}
  >
    <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
    <p className="text-sm text-muted-foreground">불러오는 중…</p>
  </div>
);

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
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("sms_onboarded"));
  const [showReviews, setShowReviews] = useState(false);

  const handleViewPost = (post: BlogPost) => setViewingPost(post);
  const handleBackFromPost = () => setViewingPost(null);
  const handleSplashDone = useCallback(() => setShowSplash(false), []);

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem("sms_onboarded", "true");
    setShowOnboarding(false);
  }, []);

  if (showSplash) return <SplashScreen onDone={handleSplashDone} />;
  if (showOnboarding) return <OnboardingSlides onComplete={handleOnboardingComplete} />;
  if (loading) return <LoadingFallback />;
  if (!user) return (
    <>
      <Suspense fallback={<LoadingFallback />}><AuthPage /></Suspense>
      <AdminFab />
    </>
  );

  if (showReviews) {
    return (
      <>
        <Suspense fallback={<LoadingFallback />}><ReviewsPage onBack={() => setShowReviews(false)} /></Suspense>
        <AdminFab />
      </>
    );
  }

  if (viewingPost) {
    return (
      <div className="min-h-screen bg-background">
        <Suspense fallback={<LoadingFallback />}>
          <PostDetailPage post={viewingPost} onBack={handleBackFromPost} onNavigate={(t) => setActiveTab(t as TabId)} />
        </Suspense>
        <AdminFab />
      </div>
    );
  }

  const renderTab = () => {
    const nav = (t: string) => setActiveTab(t as TabId);
    switch (activeTab) {
      case "home":     return <HomeTab onNavigate={nav} onViewPost={handleViewPost} />;
      case "calendar": return <CalendarTab />;
      case "content":  return <ContentTab onNavigate={nav} onViewPost={handleViewPost} />;
      case "publish":  return <ContentTab onNavigate={nav} onViewPost={handleViewPost} initialSubTab="publish" />;
      case "shorts":   return <ShortsTab onNavigate={nav} />;
      case "camera":   return <ContentTab onNavigate={nav} onViewPost={handleViewPost} initialSubTab="write" />;
      case "mypage":   return <MyPage />;
      default:         return <HomeTab onNavigate={nav} onViewPost={handleViewPost} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-[#4C8EFF] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        본문 바로가기
      </a>
      <main id="main-content">
        <ErrorBoundary
          key={activeTab}
          onReset={() => setActiveTab("home")}
        >
          <Suspense fallback={<LoadingFallback />}>
            {renderTab()}
          </Suspense>
        </ErrorBoundary>
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      <InstallBanner />
      <AdminFab />
    </div>
  );
}

const Index = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default Index;

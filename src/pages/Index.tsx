import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { BottomNav, TabId } from "@/components/BottomNav";
import { InstallBanner } from "@/components/InstallBanner";
import { OnboardingSlides } from "@/components/OnboardingSlides";
import { AdminFab } from "@/components/AdminFab";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { KakaoInAppBanner } from "@/components/KakaoInAppBanner";
import { HomeTab } from "@/pages/HomeTab";
import { BlogPost, useAppStore } from "@/stores/appStore";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { trackEvent } from "@/lib/analytics";

// 초기 로딩엔 HomeTab만 필요 — 나머지 탭/페이지는 lazy
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const NaverCallbackPage = lazy(() => import("@/pages/NaverCallbackPage"));
const CalendarTab = lazy(() => import("@/pages/CalendarTab").then(m => ({ default: m.CalendarTab })));
const ContentTab = lazy(() => import("@/pages/ContentTab").then(m => ({ default: m.ContentTab })));
const ShortsTab = lazy(() => import("@/pages/ShortsTab").then(m => ({ default: m.ShortsTab })));
const MyPage = lazy(() => import("@/pages/MyPage").then(m => ({ default: m.MyPage })));
const PostDetailPage = lazy(() => import("@/pages/PostDetailPage").then(m => ({ default: m.PostDetailPage })));
const ReviewsPage = lazy(() => import("@/pages/ReviewsPage").then(m => ({ default: m.ReviewsPage })));

// 전체화면 로더 — 최초 진입/인증 게이트용
const FullLoadingFallback = () => (
  <div
    className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4"
    style={{ minHeight: "100dvh" }}
  >
    <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
    <p className="text-sm text-muted-foreground">불러오는 중…</p>
  </div>
);

// 탭 전환 로더 — 하단 바는 유지되도록 컨텐츠 영역만 차지
const TabLoadingFallback = () => (
  <div
    className="flex items-center justify-center gap-2 text-muted-foreground"
    style={{ minHeight: "calc(100dvh - 120px)" }}
  >
    <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
    <span className="text-xs">불러오는 중…</span>
  </div>
);

function AppContent() {
  const { user, loading } = useAuth();
  const settings = useAppStore((s) => s.settings);
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [viewingPost, setViewingPost] = useState<BlogPost | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("sms_onboarded"));
  const [showReviews, setShowReviews] = useState(false);

  // 현재 경로 감지 (간단한 path 기반 라우팅)
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const handler = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const handleViewPost = (post: BlogPost) => setViewingPost(post);
  const handleBackFromPost = () => setViewingPost(null);

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem("sms_onboarded", "true");
    setShowOnboarding(false);
    trackEvent("onboarding_completed");
  }, []);

  // 업체 정보 미입력 상태에서 mypage로 강제 이동 (온보딩 리다이렉트)
  useEffect(() => {
    if (user && !settings.companyName && activeTab !== "mypage") {
      // 최초 로그인 후 업체정보 입력 유도
      sessionStorage.setItem("sms-open-settings-page", "profile");
    }
  }, [user, settings.companyName, activeTab]);

  // 로그인 직후 탭 청크 프리로드 — 네트워크 idle 타이밍에 백그라운드로 로드
  useEffect(() => {
    if (!user) return;
    const preload = () => {
      import("@/pages/CalendarTab");
      import("@/pages/ContentTab");
      import("@/pages/ShortsTab");
      import("@/pages/MyPage");
    };
    type WinIdle = Window & { requestIdleCallback?: (cb: () => void) => number };
    const w = window as WinIdle;
    if (w.requestIdleCallback) {
      w.requestIdleCallback(preload);
    } else {
      setTimeout(preload, 1500);
    }
  }, [user]);

  // ── 경로별 조건부 렌더링 ──
  // /auth/naver/callback — 네이버 OAuth 콜백 처리
  if (currentPath.startsWith("/auth/naver/callback")) {
    return (
      <Suspense fallback={<FullLoadingFallback />}>
        <NaverCallbackPage />
      </Suspense>
    );
  }

  if (showOnboarding) return <OnboardingSlides onComplete={handleOnboardingComplete} />;
  if (loading) return <FullLoadingFallback />;
  if (!user) return (
    <>
      <KakaoInAppBanner />
      <Suspense fallback={<FullLoadingFallback />}><LoginPage /></Suspense>
      <AdminFab />
    </>
  );

  if (showReviews) {
    return (
      <>
        <Suspense fallback={<FullLoadingFallback />}><ReviewsPage onBack={() => setShowReviews(false)} /></Suspense>
        <AdminFab />
      </>
    );
  }

  if (viewingPost) {
    return (
      <div className="min-h-screen bg-background">
        <Suspense fallback={<FullLoadingFallback />}>
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
    <div
      className="min-h-screen bg-background flex flex-col"
      style={{ minHeight: "100dvh" }}
    >
      <KakaoInAppBanner />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-[#4C8EFF] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        본문 바로가기
      </a>
      <main
        id="main-content"
        className="flex-1 w-full"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <ErrorBoundary
          key={activeTab}
          onReset={() => setActiveTab("home")}
        >
          <Suspense fallback={<TabLoadingFallback />}>
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

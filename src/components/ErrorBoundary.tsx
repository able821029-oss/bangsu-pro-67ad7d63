import { Component, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[ErrorBoundary]", error, info);
    // 동적 임포트 실패(배포로 청크 해시 바뀜)는 SW 언레지스터 + 강제 새로고침으로 자동 복구
    const msg = error?.message || "";
    if (/Failed to fetch dynamically imported module|Loading chunk .* failed|ChunkLoadError/i.test(msg)) {
      try {
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.getRegistrations().then((regs) => {
            regs.forEach((r) => r.unregister());
            // caches API도 비워서 옛 index.html 제거
            if (typeof caches !== "undefined") {
              caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(() => {
                window.location.reload();
              });
            } else {
              window.location.reload();
            }
          });
        } else {
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message || "알 수 없는 오류가 발생했습니다.";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-lg font-bold">
            {this.props.fallbackTitle || "화면을 불러오지 못했습니다"}
          </h2>
          <p className="text-sm text-muted-foreground break-words">{message}</p>
          <p className="text-xs text-muted-foreground">
            카카오톡 내부 브라우저에서는 일부 기능이 제한될 수 있습니다.
            Chrome 또는 Safari에서 열어 주세요.
          </p>
          <Button onClick={this.handleReset} className="w-full">
            <RotateCcw className="w-4 h-4 mr-1" /> 다시 시도
          </Button>
        </div>
      </div>
    );
  }
}

import { useState } from "react";
import { CheckCircle2, Circle, Copy, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores/appStore";
import { useToast } from "@/hooks/use-toast";

const steps = [
  { label: "AI 글 완성", tag: "앱 자동", auto: true },
  { label: "클립보드 복사", tag: "앱 자동", auto: true },
  { label: "네이버 앱 실행", tag: "앱 자동", auto: true },
  { label: "붙여넣기 + 사진첨부 + 발행", tag: "사장님 직접", auto: false },
];

export function UploadTab() {
  const { currentPost } = useAppStore();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const getClipboardText = () => {
    if (!currentPost) return "글이 아직 작성되지 않았습니다.";
    let text = currentPost.title + "\n\n";
    currentPost.blocks.forEach((block) => {
      if (block.type === "text") {
        text += block.content + "\n\n";
      } else {
        text += `[📸 ${block.caption || "사진 업로드"}]\n\n`;
      }
    });
    text += currentPost.hashtags.map((t) => `#${t}`).join(" ");
    return text;
  };

  const handleCopyAndOpen = async () => {
    setIsProcessing(true);

    // Step 1: Already done
    setCurrentStep(1);
    await new Promise((r) => setTimeout(r, 600));

    // Step 2: Copy
    try {
      await navigator.clipboard.writeText(getClipboardText());
      toast({ title: "✅ 글이 클립보드에 복사되었습니다!" });
    } catch {
      toast({ title: "클립보드 복사에 실패했습니다. 직접 복사해주세요.", variant: "destructive" });
    }
    setCurrentStep(2);
    await new Promise((r) => setTimeout(r, 600));

    // Step 3: Open Naver
    setCurrentStep(3);
    window.location.href = "naver://blog/write";

    // Fallback after delay
    setTimeout(() => {
      window.open("https://blog.naver.com/", "_blank");
    }, 2000);

    setIsProcessing(false);
  };

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold">📤 업로드</h1>
        <Badge variant="warning" className="text-xs">반자동</Badge>
      </div>

      {/* Notice */}
      <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-warning">안내</p>
          <p className="text-xs text-muted-foreground mt-1">
            네이버 블로그 API는 2020년 5월 공식 종료되었습니다.
            아래 반자동 방식으로 진행합니다.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <p className="text-sm font-semibold">업로드 4단계</p>
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            {currentStep > i ? (
              <CheckCircle2 className="w-6 h-6 text-success shrink-0" />
            ) : currentStep === i && isProcessing ? (
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
            ) : (
              <Circle className="w-6 h-6 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-medium ${currentStep > i ? "text-success" : currentStep === i ? "text-foreground" : "text-muted-foreground"}`}>
                {i + 1}단계. {step.label}
              </p>
            </div>
            <Badge variant={step.auto ? "info" : "warning"} className="text-xs shrink-0">
              {step.tag}
            </Badge>
          </div>
        ))}
      </div>

      {/* Current Post Preview */}
      {currentPost && (
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">복사될 글</p>
          <p className="font-semibold text-sm">{currentPost.title}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {currentPost.blocks.filter((b) => b.type === "text").length}개 텍스트 블록 · {currentPost.blocks.filter((b) => b.type === "photo").length}개 사진 슬롯
          </p>
        </div>
      )}

      {/* Action Button */}
      <Button
        variant="hero"
        size="xl"
        className="w-full"
        onClick={handleCopyAndOpen}
        disabled={isProcessing}
      >
        <Copy className="w-6 h-6" />
        내용 복사 후 네이버 앱 열기
      </Button>

      {currentStep >= 3 && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-4 text-center space-y-2">
          <p className="text-sm font-semibold text-success">✅ 복사 완료!</p>
          <p className="text-xs text-muted-foreground">
            네이버 앱에서 <strong>붙여넣기</strong> → <strong>사진 첨부</strong> → <strong>발행</strong> 해주세요
          </p>
          <Button variant="outline" size="sm" onClick={() => { window.location.href = "naver://blog/write"; }}>
            <ExternalLink className="w-4 h-4" />
            네이버 앱 다시 열기
          </Button>
        </div>
      )}
    </div>
  );
}

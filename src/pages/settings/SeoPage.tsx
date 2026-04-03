import { useState } from "react";
import { ArrowLeft, BarChart3, Loader2, Lightbulb, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/stores/appStore";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const statusEmoji: Record<string, string> = { good: "🟢", warning: "🟡", bad: "🔴" };
const statusLabel: Record<string, string> = { good: "좋음", warning: "보통", bad: "개선 필요" };

const seoTips = [
  "💡 제목은 키워드를 앞에 — '강남구 옥상방수'로 시작",
  "💡 글 길이 1,500자 이상 유지",
  "💡 현장 사진 최소 6장 포함",
  "💡 주 2~3회 꾸준히 발행",
  "💡 비슷한 공사 글을 모아 카테고리 통일",
  "💡 AI 글 그대로 복붙 금지 — 반드시 약간 수정",
  "💡 발행 직후 수정 최소화 (하루 2~3회 이내)",
];

interface DiagnosisResult {
  totalScore: number;
  categories: { name: string; score: number; status: string; advice: string }[];
  tips: string[];
  overallAdvice: string;
}

export function SeoPage({ onBack }: { onBack: () => void }) {
  const posts = useAppStore((s) => s.posts);
  const settings = useAppStore((s) => s.settings);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [showAdvice, setShowAdvice] = useState(false);

  const handleDiagnose = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seo-analyze", {
        body: {
          mode: "blog_diagnosis",
          posts: posts.map(p => ({
            title: p.title,
            blocks: p.blocks,
            hashtags: p.hashtags,
            createdAt: p.createdAt,
          })),
          companyName: settings.companyName,
        },
      });
      if (error || data?.error) {
        toast({ title: "분석 실패", description: data?.error || "다시 시도해주세요", variant: "destructive" });
      } else {
        setDiagnosis(data);
      }
    } catch {
      toast({ title: "네트워크 오류", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const scoreLabel = (score: number) => {
    if (score >= 80) return "상위 예상 가능";
    if (score >= 60) return "개선 시 가능";
    return "개선 필요";
  };

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-[--radius] hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">📈 블로그 상위노출 관리</h1>
      </div>

      {/* Score Card */}
      {diagnosis ? (
        <div className="bg-card rounded-[--radius] border border-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">내 블로그 점수</p>
            <button onClick={handleDiagnose} className="text-xs text-primary flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> 재분석
            </button>
          </div>
          <div className="flex items-end gap-3">
            <span className={`text-4xl font-extrabold ${scoreColor(diagnosis.totalScore)}`}>
              {diagnosis.totalScore}점
            </span>
            <span className="text-sm text-muted-foreground mb-1">/ 100점</span>
          </div>
          <Progress value={diagnosis.totalScore} className="h-3" />
          <p className="text-sm text-muted-foreground">{scoreLabel(diagnosis.totalScore)}</p>
        </div>
      ) : (
        <div className="bg-card rounded-[--radius] border border-border p-5 text-center space-y-3">
          <BarChart3 className="w-12 h-12 text-primary mx-auto" />
          <p className="text-sm font-semibold">블로그 SEO 진단</p>
          <p className="text-xs text-muted-foreground">작성한 글들을 AI가 분석하여<br />상위노출 가능성을 점검합니다</p>
          <Button onClick={handleDiagnose} disabled={isLoading} className="w-full">
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> 분석 중...</> : "블로그 진단하기"}
          </Button>
        </div>
      )}

      {/* Category Scores */}
      {diagnosis && (
        <div className="bg-card rounded-[--radius] border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">항목별 점수</p>
          </div>
          {diagnosis.categories.map((cat, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < diagnosis.categories.length - 1 ? "border-b border-border" : ""}`}>
              <span className="flex-1 text-sm font-medium">{cat.name}</span>
              <span className={`text-sm font-bold ${scoreColor(cat.score)}`}>{cat.score}</span>
              <span className="text-sm">{statusEmoji[cat.status]} {statusLabel[cat.status]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Advice */}
      {diagnosis && (
        <div className="space-y-3">
          <Button variant="outline" className="w-full" onClick={() => setShowAdvice(!showAdvice)}>
            <Lightbulb className="w-4 h-4" />
            {showAdvice ? "개선 조언 닫기" : "개선 조언 보기"}
          </Button>
          {showAdvice && (
            <div className="bg-card rounded-[--radius] border border-border p-4 space-y-3">
              <p className="text-sm font-semibold">💡 AI 개선 조언</p>
              <p className="text-sm text-muted-foreground">{diagnosis.overallAdvice}</p>
              {diagnosis.categories.map((cat, i) => (
                <div key={i} className="border-t border-border pt-2">
                  <p className="text-xs font-semibold text-primary">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">{cat.advice}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEO Tips */}
      <div className="bg-card rounded-[--radius] border border-border p-4 space-y-3">
        <p className="text-sm font-semibold">📌 네이버 SEO 핵심 팁</p>
        <div className="space-y-2">
          {seoTips.map((tip, i) => (
            <p key={i} className="text-xs text-muted-foreground">{tip}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

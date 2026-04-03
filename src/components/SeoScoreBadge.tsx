import { useState } from "react";
import { Loader2, Sparkles, Check, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { BlogPost, ContentBlock } from "@/stores/appStore";

interface SeoResult {
  totalScore: number;
  items: { name: string; score: number; status: string; detail: string; suggestion: string }[];
  checklist: { label: string; passed: boolean; current: string; recommend: string }[];
  overallAdvice: string;
}

export function SeoScoreBadge({
  post,
  onImprove,
}: {
  post: BlogPost;
  onImprove?: (improved: { title: string; blocks: ContentBlock[]; hashtags: string[] }) => void;
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [result, setResult] = useState<SeoResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seo-analyze", {
        body: {
          mode: "seo_score",
          title: post.title,
          blocks: post.blocks,
          hashtags: post.hashtags,
          location: "",
          workType: post.workType,
        },
      });
      if (error || data?.error) {
        toast({ title: "SEO 분석 실패", variant: "destructive" });
      } else {
        setResult(data);
        setShowDetail(true);
      }
    } catch {
      toast({ title: "네트워크 오류", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImprove = async () => {
    setIsImproving(true);
    try {
      const { data, error } = await supabase.functions.invoke("seo-analyze", {
        body: {
          mode: "improve",
          title: post.title,
          blocks: post.blocks,
          hashtags: post.hashtags,
          location: "",
          workType: post.workType,
        },
      });
      if (error || data?.error) {
        toast({ title: "개선 실패", description: data?.error || "다시 시도해주세요", variant: "destructive" });
      } else if (data && onImprove) {
        onImprove({ title: data.title, blocks: data.blocks, hashtags: data.hashtags });
        toast({ title: "✅ SEO 최적화 완료", description: (data.changes || []).join(", ") });
        setShowDetail(false);
      }
    } catch {
      toast({ title: "네트워크 오류", variant: "destructive" });
    } finally {
      setIsImproving(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500/10 text-green-600 border-green-500/30";
    if (score >= 60) return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
    return "bg-red-500/10 text-red-600 border-red-500/30";
  };

  const scoreEmoji = (score: number) => (score >= 80 ? "●" : score >= 60 ? "●" : "●");

  return (
    <>
      {/* Badge */}
      {result ? (
        <button onClick={() => setShowDetail(true)}>
          <Badge className={`text-xs font-bold border ${scoreColor(result.totalScore)}`}>
            SEO {result.totalScore}점 {scoreEmoji(result.totalScore)}
          </Badge>
        </button>
      ) : (
        <button onClick={handleAnalyze} disabled={isLoading}>
          <Badge variant="outline" className="text-xs gap-1">
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "SEO"} 점수 확인
          </Badge>
        </button>
      )}

      {/* Detail Popup */}
      {showDetail && result && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => setShowDetail(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-lg bg-card rounded-t-2xl p-5 pb-8 space-y-4 animate-in slide-in-from-bottom max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto" />
              <button onClick={() => setShowDetail(false)} className="absolute top-4 right-4">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <h3 className="text-lg font-bold text-center">SEO 점수 상세</h3>

            <div className="text-center">
              <span className={`text-3xl font-extrabold ${result.totalScore >= 80 ? "text-green-500" : result.totalScore >= 60 ? "text-yellow-500" : "text-red-500"}`}>
                {result.totalScore}점
              </span>
              <span className="text-sm text-muted-foreground"> / 100점</span>
            </div>

            {/* Checklist */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">체크리스트</p>
              {result.checklist.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  {item.passed ? (
                    <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <span>{item.label}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      (현재 {item.current} → {item.recommend})
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Items */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">항목별 분석</p>
              {result.items.map((item, i) => (
                <div key={i} className="bg-secondary/50 rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className={`text-sm font-bold ${item.score >= 80 ? "text-green-500" : item.score >= 60 ? "text-yellow-500" : "text-red-500"}`}>
                      {item.score}점
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                  {item.status !== "good" && (
                    <p className="text-xs text-primary">💡 {item.suggestion}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Improve Button */}
            {onImprove && (
              <Button className="w-full gap-2" onClick={handleImprove} disabled={isImproving}>
                {isImproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                AI로 개선하기
              </Button>
            )}

            <Button variant="outline" className="w-full" onClick={() => setShowDetail(false)}>
              닫기
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

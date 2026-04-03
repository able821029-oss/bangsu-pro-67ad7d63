import { useState, useEffect } from "react";
import { BarChart3, Loader2, Lightbulb, RefreshCw, ChevronDown, ChevronUp, FileText, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { KeywordRecommender } from "@/components/KeywordRecommender";
import { PublishSchedule } from "@/components/PublishSchedule";
import { useAppStore } from "@/stores/appStore";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { TabId } from "@/components/BottomNav";

interface DiagnosisResult {
  totalScore: number;
  categories: { name: string; score: number; status: string; advice: string }[];
  tips: string[];
  overallAdvice: string;
}

const categoryEmoji: Record<string, string> = {
  "주제 전문성": "📌",
  "발행 꾸준함": "📅",
  "글 길이·구조": "📝",
  "키워드 최적화": "🔑",
  "이미지 활용": "🖼️",
  "해시태그": "#️⃣",
};

const seoTips = [
  { title: "제목은 키워드를 앞에 배치", detail: '"강남구 옥상방수" 로 시작하세요' },
  { title: "글 길이 1,500자 이상 유지", detail: "검색엔진은 충분한 정보가 담긴 글을 선호합니다" },
  { title: "현장 사진 최소 6장 포함", detail: "실제 시공 사진이 신뢰도를 높입니다" },
  { title: "주 2~3회 꾸준히 발행", detail: "C-Rank 알고리즘이 꾸준한 발행을 높이 평가합니다" },
  { title: "AI 글 그대로 복붙 금지", detail: "약간의 수정으로 자연스러운 글이 됩니다" },
  { title: "지역명+업종+공사종류 조합 필수", detail: '"강남구 방수공사 전문업체" 같은 조합이 효과적' },
];

export function SeoTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const posts = useAppStore((s) => s.posts);
  const settings = useAppStore((s) => s.settings);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [showAdvice, setShowAdvice] = useState(false);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);

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

  const scoreEmoji = (score: number) => (score >= 80 ? "🟢" : score >= 60 ? "🟡" : "🔴");

  const scoreLabel = (score: number) => {
    if (score >= 80) return "상위 노출 가능";
    if (score >= 60) return "개선 시 가능";
    return "개선 필요";
  };

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <h1 className="text-xl font-bold">📈 블로그 상위노출</h1>

      {/* Score Card */}
      {diagnosis ? (
        <div className="bg-card rounded-[--radius] border border-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">내 블로그 SEO 점수</p>
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

      {/* Category Scores - 2 column grid */}
      {diagnosis && (
        <div className="grid grid-cols-2 gap-3">
          {diagnosis.categories.map((cat, i) => (
            <div key={i} className="bg-card rounded-[--radius] border border-border p-3 space-y-1">
              <p className="text-xs text-muted-foreground">{categoryEmoji[cat.name] || "📊"} {cat.name}</p>
              <div className="flex items-center gap-2">
                <span className={`text-xl font-bold ${scoreColor(cat.score)}`}>{cat.score}점</span>
                <span className="text-sm">{scoreEmoji(cat.score)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Advice */}
      {diagnosis && (
        <Button variant="outline" className="w-full gap-2" onClick={() => setShowAdvice(!showAdvice)}>
          <Lightbulb className="w-4 h-4" />
          {showAdvice ? "개선 조언 닫기" : "AI 개선 조언 받기"}
        </Button>
      )}
      {showAdvice && diagnosis && (
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

      {/* Keyword Recommender */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">🔍 키워드 추천</p>
        <KeywordRecommender
          location={settings.serviceArea}
          onSelectKeyword={(kw) => {
            toast({ title: `✅ "${kw}" 키워드가 다음 글쓰기에 반영됩니다` });
          }}
        />
      </div>

      {/* Publish Schedule */}
      <PublishSchedule onNavigate={onNavigate} />

      {/* SEO Tips Accordion */}
      <div className="bg-card rounded-[--radius] border border-border overflow-hidden">
        <p className="text-sm font-semibold px-4 py-3 border-b border-border">📌 네이버 SEO 핵심 팁</p>
        {seoTips.map((tip, i) => (
          <div key={i} className={`${i < seoTips.length - 1 ? "border-b border-border" : ""}`}>
            <button
              onClick={() => setExpandedTip(expandedTip === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
            >
              <span className="text-sm font-medium">① {tip.title}</span>
              {expandedTip === i ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {expandedTip === i && (
              <p className="px-4 pb-3 text-xs text-muted-foreground">{tip.detail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

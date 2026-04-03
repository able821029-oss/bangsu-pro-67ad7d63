import { useState } from "react";
import { BarChart3, Loader2, Lightbulb, RefreshCw, ChevronDown, ChevronUp, FileText, Check, AlertTriangle, Search, TrendingUp } from "lucide-react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
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

const categoryIcons: Record<string, React.ElementType> = {
  "주제 전문성": BarChart3,
  "발행 꾸준함": RefreshCw,
  "글 길이·구조": FileText,
  "키워드 최적화": Search,
  "이미지 활용": FileText,
  "해시태그": TrendingUp,
};

const seoTips = [
  { title: "제목은 키워드를 앞에 배치", detail: '"강남구 옥상방수" 로 시작하세요' },
  { title: "글 길이 1,500자 이상 유지", detail: "검색엔진은 충분한 정보가 담긴 글을 선호합니다" },
  { title: "현장 사진 최소 6장 포함", detail: "실제 시공 사진이 신뢰도를 높입니다" },
  { title: "주 2~3회 꾸준히 발행", detail: "C-Rank 알고리즘이 꾸준한 발행을 높이 평가합니다" },
  { title: "AI 글 그대로 복붙 금지", detail: "약간의 수정으로 자연스러운 글이 됩니다" },
  { title: "지역명+업종+공사종류 조합 필수", detail: '"강남구 방수공사 전문업체" 같은 조합이 효과적' },
];

interface PostSeoScore {
  postId: string;
  totalScore: number;
  checklist: { label: string; passed: boolean; current: string; recommend: string }[];
  loading: boolean;
}

export function SeoTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const posts = useAppStore((s) => s.posts);
  const settings = useAppStore((s) => s.settings);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [showAdvice, setShowAdvice] = useState(false);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const [postScores, setPostScores] = useState<PostSeoScore[]>([]);
  const [isAnalyzingPosts, setIsAnalyzingPosts] = useState(false);

  const handleAnalyzeAllPosts = async () => {
    const postsWithContent = posts.filter(p => p.blocks.length > 0 && p.blocks.some(b => b.type === "text" && b.content));
    if (postsWithContent.length === 0) {
      toast({ title: "분석할 글이 없습니다", variant: "destructive" });
      return;
    }
    setIsAnalyzingPosts(true);
    const scores: PostSeoScore[] = [];

    for (const post of postsWithContent.slice(0, 5)) {
      try {
        const { data } = await supabase.functions.invoke("seo-analyze", {
          body: { mode: "seo_score", title: post.title, blocks: post.blocks, hashtags: post.hashtags, location: "", workType: post.workType },
        });
        if (data && !data.error) {
          scores.push({ postId: post.id, totalScore: data.totalScore, checklist: data.checklist || [], loading: false });
        }
      } catch {}
    }
    setPostScores(scores);
    setIsAnalyzingPosts(false);
  };

  const handleDiagnose = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seo-analyze", {
        body: {
          mode: "blog_diagnosis",
          posts: posts.map(p => ({ title: p.title, blocks: p.blocks, hashtags: p.hashtags, createdAt: p.createdAt })),
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
    if (score >= 80) return "상위 노출 가능";
    if (score >= 60) return "개선 시 가능";
    return "개선 필요";
  };

  // Radar chart data from diagnosis or defaults
  const radarData = diagnosis
    ? diagnosis.categories.map(c => ({ subject: c.name.replace("글 길이·구조", "글길이"), score: c.score }))
    : [
        { subject: "전문성", score: 85 },
        { subject: "꾸준함", score: 60 },
        { subject: "키워드", score: 80 },
        { subject: "글길이", score: 65 },
        { subject: "이미지", score: 70 },
        { subject: "해시태그", score: 55 },
      ];

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">블로그 상위노출</h1>
      </div>

      {/* Score Card */}
      {diagnosis ? (
        <div className="glass-card p-5 space-y-3">
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
        <div className="glass-card p-5 text-center space-y-3">
          <BarChart3 className="w-12 h-12 text-primary mx-auto" />
          <p className="text-sm font-semibold">블로그 SEO 진단</p>
          <p className="text-xs text-muted-foreground">작성한 글들을 AI가 분석하여<br />상위노출 가능성을 점검합니다</p>
          <Button onClick={handleDiagnose} disabled={isLoading} className="w-full">
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> 분석 중...</> : "블로그 진단하기"}
          </Button>
        </div>
      )}

      {/* Radar Chart */}
      <div className="chart-card p-4 space-y-2">
        <p className="text-sm font-semibold text-foreground">항목별 SEO 분석</p>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#888" }} />
            <Radar dataKey="score" stroke="#237FFF" fill="#237FFF" fillOpacity={0.15} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Scores - 2 column grid */}
      {diagnosis && (
        <div className="grid grid-cols-2 gap-3">
          {diagnosis.categories.map((cat, i) => {
            const Icon = categoryIcons[cat.name] || BarChart3;
            return (
              <div key={i} className="glass-card p-3 space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Icon className="w-3 h-3" /> {cat.name}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`text-xl font-bold ${scoreColor(cat.score)}`}>{cat.score}점</span>
                </div>
              </div>
            );
          })}
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
        <div className="glass-card p-4 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2"><Lightbulb className="w-4 h-4 text-primary" /> AI 개선 조언</p>
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
        <p className="text-sm font-semibold flex items-center gap-1">
          <Search className="w-4 h-4 text-primary" /> 키워드 추천
        </p>
        <KeywordRecommender
          location={settings.serviceArea}
          onSelectKeyword={(kw) => {
            toast({ title: `"${kw}" 키워드가 다음 글쓰기에 반영됩니다` });
          }}
        />
      </div>

      {/* Per-Post SEO Scores */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> 글별 SEO 품질 체크
          </p>
          <Button size="sm" variant="ghost" onClick={handleAnalyzeAllPosts} disabled={isAnalyzingPosts} className="text-xs gap-1 h-7">
            {isAnalyzingPosts ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {postScores.length > 0 ? "재분석" : "자동 분석"}
          </Button>
        </div>
        {isAnalyzingPosts && postScores.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">글별 SEO 분석 중...</span>
          </div>
        )}
        {postScores.length > 0 && (
          <div className="divide-y divide-border">
            {postScores.map((ps) => {
              const post = posts.find(p => p.id === ps.postId);
              if (!post) return null;
              return (
                <div key={ps.postId} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate flex-1 mr-2">{post.title}</p>
                    <Badge className={`text-xs font-bold border shrink-0 ${
                      ps.totalScore >= 80 ? "bg-green-500/10 text-green-600 border-green-500/30" :
                      ps.totalScore >= 60 ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" :
                      "bg-red-500/10 text-red-600 border-red-500/30"
                    }`}>
                      {ps.totalScore}점
                    </Badge>
                  </div>
                  {ps.checklist.length > 0 && (
                    <div className="space-y-1">
                      {ps.checklist.filter(c => !c.passed).slice(0, 2).map((c, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />
                          <span>{c.label} ({c.current} → {c.recommend})</span>
                        </div>
                      ))}
                      {ps.checklist.every(c => c.passed) && (
                        <div className="flex items-center gap-1.5 text-xs text-green-600">
                          <Check className="w-3 h-3" /> 모든 항목 통과!
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!isAnalyzingPosts && postScores.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            [자동 분석] 버튼을 눌러 각 글의 SEO 품질을 확인하세요
          </p>
        )}
      </div>

      {/* Publish Schedule */}
      <PublishSchedule onNavigate={onNavigate} />

      {/* SEO Tips Accordion */}
      <div className="glass-card overflow-hidden">
        <p className="text-sm font-semibold px-4 py-3 border-b border-border flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-primary" /> 네이버 SEO 핵심 팁
        </p>
        {seoTips.map((tip, i) => (
          <div key={i} className={`${i < seoTips.length - 1 ? "border-b border-border" : ""}`}>
            <button
              onClick={() => setExpandedTip(expandedTip === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
            >
              <span className="text-sm font-medium">{i + 1}. {tip.title}</span>
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

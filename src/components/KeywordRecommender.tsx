import { useState } from "react";
import { Loader2, Search, Target, Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface KeywordResult {
  main: { keyword: string; competition: string }[];
  target: { keyword: string; competition: string; reason: string }[];
  longtail: { keyword: string; competition: string }[];
}

export function KeywordRecommender({
  location,
  workType,
  onSelectKeyword,
}: {
  location: string;
  workType?: string;
  onSelectKeyword: (keyword: string) => void;
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<KeywordResult | null>(null);
  const [show, setShow] = useState(false);

  const handleSearch = async () => {
    if (!location) {
      toast({ title: "지역을 먼저 입력해주세요", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setShow(true);
    try {
      const { data, error } = await supabase.functions.invoke("seo-analyze", {
        body: {
          mode: "keywords",
          location,
          workType: workType || "방수공사",
        },
      });
      if (error || data?.error) {
        toast({ title: "키워드 추천 실패", variant: "destructive" });
        setShow(false);
      } else {
        setResult(data);
      }
    } catch {
      toast({ title: "네트워크 오류", variant: "destructive" });
      setShow(false);
    } finally {
      setIsLoading(false);
    }
  };

  const competitionColor: Record<string, string> = {
    high: "bg-red-500/10 text-red-600",
    medium: "bg-yellow-500/10 text-yellow-600",
    low: "bg-green-500/10 text-green-600",
  };

  if (!show) {
    return (
      <Button variant="outline" size="sm" className="gap-1" onClick={handleSearch}>
        <Search className="w-4 h-4" /> 키워드 추천
      </Button>
    );
  }

  return (
    <div className="bg-card rounded-[--radius] border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-1"><Search className="w-4 h-4 text-primary" /> 키워드 추천</p>
        <button onClick={() => setShow(false)}>
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">AI가 키워드를 분석 중...</span>
        </div>
      ) : result ? (
        <div className="space-y-4">
          {/* Main keywords */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              📌 메인 키워드 <span className="text-red-500">(경쟁 높음)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {result.main.map((kw, i) => (
                <button key={i} onClick={() => onSelectKeyword(kw.keyword)}>
                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-primary/10">
                    {kw.keyword}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Target keywords */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Target className="w-3 h-3" /> 공략 키워드 <span className="text-green-500">(추천!)</span>
            </p>
            <div className="space-y-2">
              {result.target.map((kw, i) => (
                <button key={i} onClick={() => onSelectKeyword(kw.keyword)} className="w-full text-left bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2 hover:bg-green-500/10 transition-colors">
                  <p className="text-sm font-medium">{kw.keyword}</p>
                  <p className="text-xs text-muted-foreground">{kw.reason}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Longtail keywords */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Zap className="w-3 h-3" /> 롱테일 키워드 <span className="text-blue-500">(즉시 효과)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {result.longtail.map((kw, i) => (
                <button key={i} onClick={() => onSelectKeyword(kw.keyword)}>
                  <Badge className={`text-xs cursor-pointer ${competitionColor[kw.competition] || ""}`}>
                    {kw.keyword}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">키워드를 탭하면 글쓰기에 반영됩니다</p>
        </div>
      ) : null}
    </div>
  );
}

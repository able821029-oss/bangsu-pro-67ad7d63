import { useState } from "react";
import { ArrowLeft, Star, ThumbsUp, MessageCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ReviewsPageProps {
  onBack: () => void;
}

interface Review {
  id: string;
  name: string;
  rating: number;
  date: string;
  category: string;
  text: string;
  helpful: number;
  avatar: string;
}

const MOCK_REVIEWS: Review[] = [
  {
    id: "1",
    name: "김**",
    rating: 5,
    date: "2026.03.28",
    category: "방수공사",
    text: "블로그 글을 AI로 작성해주니까 정말 편합니다. 사진만 올리면 자동으로 글이 완성되니 시간이 많이 절약됩니다. 고객 문의도 늘었어요!",
    helpful: 24,
    avatar: "김",
  },
  {
    id: "2",
    name: "박**",
    rating: 5,
    date: "2026.03.22",
    category: "도장공사",
    text: "일정 관리가 특히 좋습니다. 구글 캘린더에 자동으로 연동되니까 따로 기록할 필요가 없어요. 현장에서 바로 등록하고 갑니다.",
    helpful: 18,
    avatar: "박",
  },
  {
    id: "3",
    name: "이**",
    rating: 4,
    date: "2026.03.15",
    category: "타일공사",
    text: "SNS 마케팅을 혼자 해야 하는데, 이 앱 덕분에 네이버 블로그 관리가 훨씬 수월해졌습니다. 해시태그 추천도 유용해요.",
    helpful: 15,
    avatar: "이",
  },
  {
    id: "4",
    name: "최**",
    rating: 5,
    date: "2026.03.10",
    category: "옥상방수",
    text: "50대 사장님들도 쉽게 사용할 수 있게 만들어져 있어서 좋습니다. 글씨도 크고 버튼도 눌리기 쉽게 되어 있어요.",
    helpful: 31,
    avatar: "최",
  },
  {
    id: "5",
    name: "정**",
    rating: 5,
    date: "2026.03.05",
    category: "외벽방수",
    text: "전에는 블로그 글 하나 쓰는데 1시간 넘게 걸렸는데, 지금은 10분이면 끝납니다. 사진 찍고 올리기만 하면 되니까요.",
    helpful: 27,
    avatar: "정",
  },
  {
    id: "6",
    name: "한**",
    rating: 4,
    date: "2026.02.28",
    category: "실내방수",
    text: "캘린더 기능이 깔끔하고, 월/주/일 보기가 다 돼서 일정 파악하기 편합니다. 다만 알림 기능이 추가되면 더 좋겠어요.",
    helpful: 12,
    avatar: "한",
  },
];

type SortType = "latest" | "highest" | "helpful";

export function ReviewsPage({ onBack }: ReviewsPageProps) {
  const [sort, setSort] = useState<SortType>("latest");
  const [showAll, setShowAll] = useState(false);

  const averageRating = (
    MOCK_REVIEWS.reduce((acc, r) => acc + r.rating, 0) / MOCK_REVIEWS.length
  ).toFixed(1);

  const sortedReviews = [...MOCK_REVIEWS].sort((a, b) => {
    if (sort === "highest") return b.rating - a.rating;
    if (sort === "helpful") return b.helpful - a.helpful;
    return 0; // latest = default order
  });

  const displayedReviews = showAll ? sortedReviews : sortedReviews.slice(0, 4);

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center h-14 px-4">
          <button onClick={onBack} className="mr-3 p-1">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">고객 리뷰</h1>
        </div>
      </div>

      {/* Summary Card */}
      <div className="px-4 mt-6 mb-6">
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10">
          <CardContent className="p-6 flex items-center gap-6">
            <div className="text-center">
              <p className="text-5xl font-black text-foreground">{averageRating}</p>
              <div className="flex gap-0.5 mt-2 justify-center">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      s <= Math.round(Number(averageRating))
                        ? "text-warning fill-warning"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {MOCK_REVIEWS.length}개 리뷰
              </p>
            </div>

            <div className="flex-1 space-y-1.5">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = MOCK_REVIEWS.filter((r) => r.rating === rating).length;
                const pct = (count / MOCK_REVIEWS.length) * 100;
                return (
                  <div key={rating} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-3">{rating}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-warning rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground w-5 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sort tabs */}
      <div className="px-4 mb-4 flex gap-2">
        {([
          { key: "latest" as SortType, label: "최신순" },
          { key: "highest" as SortType, label: "별점순" },
          { key: "helpful" as SortType, label: "도움순" },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              sort === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Review list */}
      <div className="px-4 space-y-3">
        {displayedReviews.map((review) => (
          <Card key={review.id} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
                    {review.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{review.name}</p>
                    <p className="text-xs text-muted-foreground">{review.category} · {review.date}</p>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= review.rating
                          ? "text-warning fill-warning"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <p className="text-sm text-foreground/85 leading-relaxed mb-3">
                {review.text}
              </p>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <button className="flex items-center gap-1 hover:text-primary transition-colors">
                  <ThumbsUp className="w-3.5 h-3.5" />
                  도움됨 {review.helpful}
                </button>
                <button className="flex items-center gap-1 hover:text-primary transition-colors">
                  <MessageCircle className="w-3.5 h-3.5" />
                  답글
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Load more */}
      {!showAll && sortedReviews.length > 4 && (
        <div className="px-4 mt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowAll(true)}
          >
            리뷰 더보기
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

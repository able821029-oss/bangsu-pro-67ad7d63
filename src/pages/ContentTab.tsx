import { useMemo, useState } from "react";
import { BlogWriterTab } from "@/pages/BlogWriterTab";
import { CameraTab } from "@/pages/CameraTab";
import { PublishTab } from "@/pages/PublishTab";
import { BlogPost, Platform, PostStatus, useAppStore } from "@/stores/appStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PenLine,
  Sparkles,
  Upload,
  Search,
  FileText,
  X,
  type LucideIcon,
} from "lucide-react";
import type { TabId } from "@/components/BottomNav";

type SubTab = "ai" | "write" | "publish" | "list";

interface ContentTabProps {
  onNavigate: (tab: string) => void;
  onViewPost: (post: BlogPost) => void;
  initialSubTab?: string;
}

const TABS: Array<{ id: SubTab; icon: LucideIcon; label: string; badge?: string }> = [
  { id: "ai", icon: Sparkles, label: "AI 글쓰기", badge: "추천" },
  { id: "write", icon: PenLine, label: "직접 글쓰기" },
  { id: "list", icon: FileText, label: "내 글" },
  { id: "publish", icon: Upload, label: "발행 현황" },
];

type StatusFilter = "all" | PostStatus;
type PlatformFilter = "all" | Platform;
type DateFilter = "all" | "7d" | "30d";

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "전체" },
  { id: "작성중", label: "작성중" },
  { id: "완료", label: "완료" },
  { id: "게시완료", label: "게시완료" },
];

const PLATFORM_FILTERS: Array<{ id: PlatformFilter; label: string }> = [
  { id: "all", label: "전체" },
  { id: "naver", label: "네이버" },
  { id: "instagram", label: "인스타" },
  { id: "tiktok", label: "틱톡" },
];

const DATE_FILTERS: Array<{ id: DateFilter; label: string }> = [
  { id: "7d", label: "최근 7일" },
  { id: "30d", label: "최근 30일" },
  { id: "all", label: "전체" },
];

const statusBadgeVariant: Record<PostStatus, "default" | "info" | "success"> = {
  작성중: "default",
  AI생성중: "default",
  완료: "info",
  게시완료: "success",
};

const platformLabel: Record<Platform, string> = {
  naver: "네이버",
  instagram: "인스타",
  tiktok: "틱톡",
};

function matchesDate(createdAt: string, filter: DateFilter): boolean {
  if (filter === "all") return true;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return false;
  const cutoffDays = filter === "7d" ? 7 : 30;
  const cutoff = Date.now() - cutoffDays * 24 * 60 * 60 * 1000;
  return d.getTime() >= cutoff;
}

export function ContentTab({ onNavigate, onViewPost, initialSubTab }: ContentTabProps) {
  const [subTab, setSubTab] = useState<SubTab>(() => {
    if (initialSubTab === "publish") return "publish";
    if (initialSubTab === "ai") return "ai";
    if (initialSubTab === "list") return "list";
    return "write"; // 기본값: 직접 글쓰기(=TypePicker가 첫 화면) 우선 노출
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Sub-tab bar — 더 크고 그라데이션 강조 */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md px-4 pt-3 pb-1">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(({ id, icon: Icon, label, badge }) => {
            const active = subTab === id;
            return (
              <button
                key={id}
                onClick={() => setSubTab(id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all",
                  active
                    ? "text-white shadow-lg"
                    : "text-muted-foreground bg-white/5 hover:bg-white/10",
                )}
                style={
                  active
                    ? { background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }
                    : undefined
                }
              >
                <Icon className="w-4 h-4" />
                {label}
                {badge && (
                  <span
                    className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-primary/15 text-primary",
                    )}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {subTab === "write" && (
        <BlogWriterTab onNavigate={onNavigate as (t: TabId) => void} onViewPost={onViewPost} />
      )}
      {subTab === "ai" && <CameraTab onNavigate={onNavigate} onViewPost={onViewPost} />}
      {subTab === "publish" && <PublishTab onNavigate={onNavigate} onViewPost={onViewPost} />}
      {subTab === "list" && <PostsListPane onViewPost={onViewPost} />}
    </div>
  );
}

// ── "내 글" 패널 — 검색·상태·플랫폼·기간 필터 ─────────────────────────────
function PostsListPane({ onViewPost }: { onViewPost: (post: BlogPost) => void }) {
  const posts = useAppStore((s) => s.posts);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (platform !== "all" && !p.platforms.includes(platform)) return false;
      if (!matchesDate(p.createdAt, dateFilter)) return false;
      if (!q) return true;
      const inTitle = p.title?.toLowerCase().includes(q);
      if (inTitle) return true;
      const bodyText = p.blocks
        .filter((b) => b.type === "text" || b.type === "subtitle")
        .map((b) => b.content)
        .join("\n")
        .toLowerCase();
      return bodyText.includes(q);
    });
  }, [posts, query, status, platform, dateFilter]);

  const hasFilter =
    query.trim().length > 0 ||
    status !== "all" ||
    platform !== "all" ||
    dateFilter !== "all";

  const resetFilters = () => {
    setQuery("");
    setStatus("all");
    setPlatform("all");
    setDateFilter("all");
  };

  return (
    <div className="px-4 pt-3 pb-24 max-w-lg mx-auto space-y-3">
      {/* 검색 입력 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목·본문 검색"
          className="w-full bg-card border border-border rounded-xl pl-9 pr-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="글 검색"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="검색어 지우기"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 필터 칩 — 상태 / 플랫폼 / 기간 */}
      <FilterRow label="상태">
        {STATUS_FILTERS.map((f) => (
          <Chip
            key={f.id}
            active={status === f.id}
            onClick={() => setStatus(f.id)}
          >
            {f.label}
          </Chip>
        ))}
      </FilterRow>

      <FilterRow label="플랫폼">
        {PLATFORM_FILTERS.map((f) => (
          <Chip
            key={f.id}
            active={platform === f.id}
            onClick={() => setPlatform(f.id)}
          >
            {f.label}
          </Chip>
        ))}
      </FilterRow>

      <FilterRow label="기간">
        {DATE_FILTERS.map((f) => (
          <Chip
            key={f.id}
            active={dateFilter === f.id}
            onClick={() => setDateFilter(f.id)}
          >
            {f.label}
          </Chip>
        ))}
      </FilterRow>

      <div className="flex items-baseline justify-between text-xs pt-1">
        <span className="text-muted-foreground">
          {filtered.length}건 / 전체 {posts.length}건
        </span>
        {hasFilter && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-primary font-medium hover:underline"
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* 글 리스트 */}
      <ScrollArea className="h-[calc(100dvh-320px)] min-h-[240px] rounded-xl border border-border bg-card/40">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-1">
            <p className="text-sm text-muted-foreground">
              {posts.length === 0
                ? "아직 작성한 글이 없습니다"
                : "조건에 맞는 글이 없어요"}
            </p>
            {hasFilter && posts.length > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-primary mt-1 hover:underline"
              >
                필터를 초기화해 보세요
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.map((post) => (
              <li key={post.id}>
                <button
                  type="button"
                  onClick={() => onViewPost(post)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-secondary/40 transition-colors"
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        post.status === "게시완료"
                          ? "#22C55E"
                          : post.status === "완료"
                            ? "#237FFF"
                            : "#888",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate text-foreground">
                      {post.title || "(제목 없음)"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {post.createdAt}
                      {post.platforms.length > 0 && (
                        <>
                          {" · "}
                          {post.platforms.map((p) => platformLabel[p]).join(", ")}
                        </>
                      )}
                    </p>
                  </div>
                  <Badge variant={statusBadgeVariant[post.status]}>
                    {post.status}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0 w-12">
        {label}
      </span>
      <div className="flex gap-1.5 shrink-0">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all border",
        active
          ? "bg-primary/15 text-primary border-primary/40"
          : "bg-white/[0.03] text-muted-foreground border-white/10 hover:bg-white/[0.08]",
      )}
    >
      {children}
    </button>
  );
}

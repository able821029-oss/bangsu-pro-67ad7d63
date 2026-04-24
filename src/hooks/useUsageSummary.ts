import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/stores/appStore";

/**
 * usage_current_month 뷰를 조회해 이번 달 사용량을 반환한다.
 *
 * 뷰 스키마 (supabase/migrations/20260424_usage_logs.sql):
 *   user_id | fn_name | ok_count | error_count | rate_limited_count | cost_usd_sum | ...
 *
 * 서버 집계 결과를 우선 사용하고, 뷰가 없거나 RLS로 빈 결과가 나오면
 * posts 기반 파생 계산으로 폴백. HomeTab은 blogCount/shortsCount만 필요.
 */

interface UsageRow {
  user_id: string;
  fn_name: string;
  ok_count: number | null;
  error_count: number | null;
  rate_limited_count: number | null;
  cost_usd_sum: number | null;
}

export interface UsageSummary {
  blogCount: number;
  shortsCount: number;
  totalCost: number;
  /** 서버 뷰에서 성공적으로 가져왔으면 true. 폴백 모드면 false. */
  fromServer: boolean;
  loading: boolean;
  error: string | null;
}

export function useUsageSummary(): UsageSummary {
  const { user } = useAuth();
  const posts = useAppStore((s) => s.posts);
  const subscription = useAppStore((s) => s.subscription);

  const [serverData, setServerData] = useState<UsageRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setServerData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // usage_current_month 뷰는 최근 마이그레이션에서 추가 — types.ts에 아직 반영되지
    // 않아 임시로 any 캐스팅. 뷰가 DB에 없으면 error를 받고 폴백으로 전환한다.
    const anyClient = supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => Promise<{
            data: UsageRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };

    try {
      const { data, error: err } = await anyClient
        .from("usage_current_month")
        .select("user_id, fn_name, ok_count, error_count, rate_limited_count, cost_usd_sum")
        .eq("user_id", user.id);

      if (err) {
        setError(err.message);
        setServerData(null);
      } else {
        setServerData(data ?? []);
      }
    } catch (e: any) {
      setError(e?.message || "usage_current_month 조회 실패");
      setServerData(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // ── posts 기반 폴백 (기존 HomeTab 파생 로직과 동일) ──
  const currentMonth = new Date().toISOString().slice(0, 7);
  const fallbackBlog = posts.filter(
    (p) =>
      (p.status === "완료" || p.status === "게시완료") &&
      typeof p.createdAt === "string" &&
      p.createdAt.startsWith(currentMonth),
  ).length;
  const fallbackShorts = subscription.videoUsed ?? 0;

  // 서버 뷰 결과가 "유효하고 비어있지 않은" 경우에만 서버 값을 신뢰한다.
  // 빈 배열은 아직 한 번도 호출하지 않은 신규 사용자일 수 있어 폴백으로 둠.
  const serverUsable = Array.isArray(serverData) && serverData.length > 0;

  if (serverUsable) {
    const blogRow = serverData!.find((r) => r.fn_name === "generate-blog");
    const shortsRow = serverData!.find((r) => r.fn_name === "generate-shorts");
    const totalCost = serverData!.reduce((sum, r) => sum + Number(r.cost_usd_sum ?? 0), 0);
    return {
      blogCount: Number(blogRow?.ok_count ?? 0),
      shortsCount: Number(shortsRow?.ok_count ?? 0),
      totalCost,
      fromServer: true,
      loading,
      error,
    };
  }

  return {
    blogCount: fallbackBlog,
    shortsCount: fallbackShorts,
    totalCost: 0,
    fromServer: false,
    loading,
    error,
  };
}

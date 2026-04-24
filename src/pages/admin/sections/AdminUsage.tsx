import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart3,
  Loader2,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  DollarSign,
  Users,
  Activity,
  CalendarDays,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/IconChip";
import { supabase } from "@/integrations/supabase/client";

type UsageLogRow = {
  created_at: string;
  fn_name: string;
  status: string;
  cost_usd: number | null;
  user_id: string | null;
};

type ProfileRow = { user_id: string; name: string | null };

const FN_COLORS: Record<string, string> = {
  "generate-blog": "#237FFF",
  "generate-shorts": "#AB5EBE",
  "seo-analyze": "#22C55E",
  "tts-preview": "#F59E0B",
  "render-video": "#06B6D4",
  "reset-password": "#6366F1",
  other: "#64748B",
};

const fnColor = (name: string) => FN_COLORS[name] ?? "#64748B";

const toYmd = (iso: string): string => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const shortLabel = (ymd: string): string => {
  const [, m, d] = ymd.split("-");
  return `${m}/${d}`;
};

export function AdminUsage() {
  const [rows, setRows] = useState<UsageLogRow[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // usage_logs는 최근 마이그레이션에서 추가됨 (types.ts 미반영) → 런타임 조회.
    // RLS: 관리자(is_admin)만 전체 읽기 가능. AdminPage에서 이미 가드됨.
    const anyClient = supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          gte: (
            col: string,
            val: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{
                data: UsageLogRow[] | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    };

    const { data, error } = await anyClient
      .from("usage_logs")
      .select("created_at, fn_name, status, cost_usd, user_id")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      setErrorMsg(error.message || "사용량 조회 실패");
      setLoading(false);
      return;
    }

    const usageRows = data ?? [];
    setRows(usageRows);

    // Top 10 이름 매핑용 profiles 조회
    const userIds = Array.from(
      new Set(
        usageRows
          .map((r) => r.user_id)
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      ),
    );

    if (userIds.length > 0) {
      const { data: profData } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);

      const map: Record<string, string> = {};
      ((profData as ProfileRow[] | null) ?? []).forEach((p) => {
        map[p.user_id] = p.name || "(이름없음)";
      });
      setNameMap(map);
    } else {
      setNameMap({});
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 이번 달 기준점
  const monthStartIso = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  }, []);

  const monthRows = useMemo(
    () => rows.filter((r) => r.created_at >= monthStartIso),
    [rows, monthStartIso],
  );

  // KPI 4종
  const kpis = useMemo(() => {
    const total = monthRows.length;
    const errors = monthRows.filter(
      (r) => r.status === "error" || r.status === "rate_limited",
    ).length;
    const errorRate = total > 0 ? (errors / total) * 100 : 0;
    const cost = monthRows.reduce(
      (sum, r) => sum + Number(r.cost_usd ?? 0),
      0,
    );
    const uniqueUsers = new Set(
      monthRows.map((r) => r.user_id).filter(Boolean),
    ).size;
    return { total, errorRate, cost, uniqueUsers };
  }, [monthRows]);

  // 일별 호출 수 — 최근 30일 빈 날짜도 0으로 채움
  const dailySeries = useMemo(() => {
    const bucket: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      bucket[toYmd(d.toISOString())] = 0;
    }
    rows.forEach((r) => {
      const k = toYmd(r.created_at);
      if (k in bucket) bucket[k] += 1;
    });
    return Object.entries(bucket).map(([date, count]) => ({
      date,
      label: shortLabel(date),
      count,
    }));
  }, [rows]);

  // 함수별 분포 (이번 달)
  const fnSeries = useMemo(() => {
    const map: Record<string, number> = {};
    monthRows.forEach((r) => {
      map[r.fn_name] = (map[r.fn_name] ?? 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthRows]);

  // DAU(24h) / MAU(30d) — distinct user_id (로그인 사용자 기준, anon 호출은 user_id=NULL로 제외)
  const activity = useMemo(() => {
    const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dau = new Set<string>();
    const mau = new Set<string>();
    rows.forEach((r) => {
      if (!r.user_id) return;
      mau.add(r.user_id); // rows는 이미 최근 30일로 제한됨
      if (r.created_at >= dayAgoIso) dau.add(r.user_id);
    });
    const ratio = mau.size > 0 ? (dau.size / mau.size) * 100 : 0;
    return { dau: dau.size, mau: mau.size, ratio };
  }, [rows]);

  // 함수별 비용 합계 (최근 30일) — 바 차트용
  const fnCostSeries = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((r) => {
      const cost = Number(r.cost_usd ?? 0);
      if (cost <= 0) return;
      map[r.fn_name] = (map[r.fn_name] ?? 0) + cost;
    });
    return Object.entries(map)
      .map(([name, cost]) => ({ name, cost: Number(cost.toFixed(4)) }))
      .sort((a, b) => b.cost - a.cost);
  }, [rows]);

  // 일별 실패율 — status='error' 또는 'rate_limited' 비율 (%). 호출이 0건인 날은 0%
  const dailyErrorRate = useMemo(() => {
    const bucket: Record<string, { total: number; fail: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      bucket[toYmd(d.toISOString())] = { total: 0, fail: 0 };
    }
    rows.forEach((r) => {
      const k = toYmd(r.created_at);
      if (!(k in bucket)) return;
      bucket[k].total += 1;
      if (r.status === "error" || r.status === "rate_limited") bucket[k].fail += 1;
    });
    return Object.entries(bucket).map(([date, v]) => ({
      date,
      label: shortLabel(date),
      rate: v.total > 0 ? Number(((v.fail / v.total) * 100).toFixed(2)) : 0,
      fail: v.fail,
      total: v.total,
    }));
  }, [rows]);

  // 사용자 Top 10 (이번 달, 비용 내림차순)
  const topUsers = useMemo(() => {
    const agg: Record<string, { calls: number; cost: number }> = {};
    monthRows.forEach((r) => {
      if (!r.user_id) return;
      const cur = agg[r.user_id] ?? { calls: 0, cost: 0 };
      cur.calls += 1;
      cur.cost += Number(r.cost_usd ?? 0);
      agg[r.user_id] = cur;
    });
    return Object.entries(agg)
      .map(([uid, v]) => ({
        userId: uid,
        name: nameMap[uid] || uid.slice(0, 8) + "…",
        calls: v.calls,
        cost: v.cost,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);
  }, [monthRows, nameMap]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="glass-card p-6 text-center space-y-3">
        <AlertCircle className="w-6 h-6 text-destructive mx-auto" />
        <p className="text-sm font-semibold">사용량 조회 실패</p>
        <p className="text-xs text-muted-foreground break-words">{errorMsg}</p>
        <Button size="sm" variant="outline" onClick={load}>
          다시 시도
        </Button>
      </div>
    );
  }

  const empty = monthRows.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" /> 사용량
        </h2>
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {empty ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          이번 달 기록된 사용량이 없습니다
        </div>
      ) : (
        <>
          {/* 상단 KPI 4개 */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              chip={<IconChip icon={TrendingUp} color="blue" size="sm" />}
              label="이번 달 총 호출"
              value={kpis.total.toLocaleString("ko-KR")}
              unit="건"
            />
            <KpiCard
              chip={<IconChip icon={AlertCircle} color="rose" size="sm" />}
              label="오류율"
              value={kpis.errorRate.toFixed(1)}
              unit="%"
            />
            <KpiCard
              chip={<IconChip icon={DollarSign} color="green" size="sm" />}
              label="총 비용"
              value={`$${kpis.cost.toFixed(2)}`}
              unit="USD"
            />
            <KpiCard
              chip={<IconChip icon={Users} color="purple" size="sm" />}
              label="고유 사용자"
              value={kpis.uniqueUsers.toLocaleString("ko-KR")}
              unit="명"
            />
          </div>

          {/* DAU / MAU 카드 */}
          <div className="grid grid-cols-3 gap-3">
            <KpiCard
              chip={<IconChip icon={Activity} color="cyan" size="sm" />}
              label="DAU (24시간)"
              value={activity.dau.toLocaleString("ko-KR")}
              unit="명"
            />
            <KpiCard
              chip={<IconChip icon={CalendarDays} color="indigo" size="sm" />}
              label="MAU (30일)"
              value={activity.mau.toLocaleString("ko-KR")}
              unit="명"
            />
            <KpiCard
              chip={<IconChip icon={TrendingUp} color="amber" size="sm" />}
              label="DAU / MAU"
              value={activity.ratio.toFixed(1)}
              unit="%"
            />
          </div>

          {/* 일별 호출 라인차트 */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                일별 호출 수 (최근 30일)
              </h3>
              <span className="text-xs text-muted-foreground">
                총 {rows.length.toLocaleString("ko-KR")}건
              </span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <LineChart
                  data={dailySeries}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0E1322",
                      border: "1px solid #1f2937",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#cbd5e1" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#237FFF"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 함수별 비용 합계 바차트 (최근 30일) */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">함수별 비용 합계 (최근 30일)</h3>
              <span className="text-xs text-muted-foreground">
                총 ${fnCostSeries.reduce((s, r) => s + r.cost, 0).toFixed(4)}
              </span>
            </div>
            {fnCostSeries.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">
                비용이 기록된 호출이 없습니다
              </p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer>
                  <BarChart
                    data={fnCostSeries}
                    margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={48}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickFormatter={(v: number) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0E1322",
                        border: "1px solid #1f2937",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#cbd5e1" }}
                      formatter={(v: number) => [`$${Number(v).toFixed(4)}`, "비용"]}
                    />
                    <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                      {fnCostSeries.map((d) => (
                        <Cell key={d.name} fill={fnColor(d.name)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 일별 실패율 라인차트 (error + rate_limited) */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">일별 실패율 (최근 30일)</h3>
              <span className="text-xs text-muted-foreground">
                error + rate_limited / 전체
              </span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <LineChart
                  data={dailyErrorRate}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={(v: number) => `${v}%`}
                    domain={[0, (dataMax: number) => Math.max(5, Math.ceil(dataMax))]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0E1322",
                      border: "1px solid #1f2937",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#cbd5e1" }}
                    formatter={(_v: number, _n: string, item: { payload: { rate: number; fail: number; total: number } }) => {
                      const { rate, fail, total } = item.payload;
                      return [`${rate}% (${fail}/${total})`, "실패율"];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#EF4444"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 함수별 파이 + Top10 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="glass-card p-4 space-y-3">
              <h3 className="text-sm font-semibold">함수별 호출 분포</h3>
              <div className="h-56 w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={fnSeries}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={36}
                      paddingAngle={2}
                    >
                      {fnSeries.map((d) => (
                        <Cell key={d.name} fill={fnColor(d.name)} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#0E1322",
                        border: "1px solid #1f2937",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#cbd5e1" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card p-4 space-y-3">
              <h3 className="text-sm font-semibold">
                사용자 Top 10 (비용 기준)
              </h3>
              {topUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  로그인한 사용자 사용량이 없습니다
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-2 font-medium">#</th>
                        <th className="py-2 font-medium">사용자</th>
                        <th className="py-2 font-medium text-right">호출</th>
                        <th className="py-2 font-medium text-right">비용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topUsers.map((u, i) => (
                        <tr key={u.userId} className="border-t border-border">
                          <td className="py-2 text-muted-foreground">
                            {i + 1}
                          </td>
                          <td className="py-2 font-medium truncate max-w-[120px]">
                            {u.name}
                          </td>
                          <td className="py-2 text-right">
                            {u.calls.toLocaleString("ko-KR")}
                          </td>
                          <td className="py-2 text-right font-mono">
                            ${u.cost.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  chip,
  label,
  value,
  unit,
}: {
  chip: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-2">
        {chip}
        <span className="text-xs text-muted-foreground font-medium">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="stat-number">{value}</span>
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
    </div>
  );
}
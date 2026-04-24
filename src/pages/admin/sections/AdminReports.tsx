// AdminReports — 관리자 신고 처리 트레이
// 2026-04-26 — post_reports 테이블 기반 (20260426_post_reports.sql 의존)
//
// 기능:
//  - 상태 필터(open/reviewing/resolved/dismissed, 기본 open)로 신고 리스트
//  - 글 미리보기 (title + 본문 앞부분 + moderation_status 배지)
//  - 액션:
//      resolve : status='resolved' (유효한 신고로 인정, 글은 건드리지 않음)
//      dismiss : status='dismissed' (무효 신고)
//      hide    : status='resolved' + posts.moderation_status='hidden'
//  - admin_note 입력 → 저장 시 함께 기록

import { useCallback, useEffect, useState } from "react";
import {
  Flag, Loader2, RefreshCw, CheckCircle2, XCircle, EyeOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
type ReportReason = "ad" | "fraud" | "inappropriate" | "other";

interface ReportRow {
  id: string;
  post_id: string;
  reporter_user_id: string | null;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  admin_note: string | null;
  created_at: string;
}

interface PostPreview {
  id: string;
  title: string;
  moderation_status: string;
  blocksText: string;
}

const reasonLabels: Record<ReportReason, string> = {
  ad: "광고/스팸",
  fraud: "사기",
  inappropriate: "부적절",
  other: "기타",
};

const statusLabels: Record<ReportStatus, string> = {
  open: "대기",
  reviewing: "검토 중",
  resolved: "처리 완료",
  dismissed: "반려",
};

const statusVariant: Record<ReportStatus, "default" | "info" | "success" | "warning"> = {
  open: "warning",
  reviewing: "info",
  resolved: "success",
  dismissed: "default",
};

export function AdminReports() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<ReportStatus>("open");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [posts, setPosts] = useState<Map<string, PostPreview>>(new Map());
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map()); // report_id → admin_note draft
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data: reportRows, error } = await supabase
      .from("post_reports")
      .select("id, post_id, reporter_user_id, reason, details, status, admin_note, created_at")
      .eq("status", filter)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast({ title: "신고 조회 실패", description: error.message, variant: "destructive" });
      setReports([]);
      setLoading(false);
      return;
    }

    const rows = (reportRows || []) as ReportRow[];
    setReports(rows);

    // 글 미리보기 일괄 조회
    const postIds = [...new Set(rows.map((r) => r.post_id))];
    if (postIds.length > 0) {
      const { data: postRows } = await supabase
        .from("posts")
        .select("id, title, moderation_status, blocks")
        .in("id", postIds);

      const previewMap = new Map<string, PostPreview>();
      (postRows || []).forEach((p: { id: string; title: string; moderation_status: string | null; blocks: unknown }) => {
        const blocks = Array.isArray(p.blocks) ? p.blocks : [];
        const blocksText = blocks
          .filter((b: unknown): b is { type: string; content?: string } =>
            typeof b === "object" && b !== null && "type" in b,
          )
          .filter((b) => b.type === "text")
          .map((b) => b.content || "")
          .join(" ")
          .slice(0, 160);
        previewMap.set(p.id, {
          id: p.id,
          title: p.title,
          moderation_status: p.moderation_status || "ok",
          blocksText,
        });
      });
      setPosts(previewMap);
    } else {
      setPosts(new Map());
    }

    setLoading(false);
  }, [filter, toast]);

  useEffect(() => { void fetchReports(); }, [fetchReports]);

  const applyAction = async (
    report: ReportRow,
    action: "resolve" | "dismiss" | "hide",
  ) => {
    if (busyId) return;
    setBusyId(report.id);
    try {
      const note = drafts.get(report.id) ?? report.admin_note ?? "";

      // 1) hide이면 먼저 posts.moderation_status='hidden'
      if (action === "hide") {
        const { error: postErr } = await supabase
          .from("posts")
          .update({ moderation_status: "hidden" })
          .eq("id", report.post_id);
        if (postErr) {
          toast({ title: "글 차단 실패", description: postErr.message, variant: "destructive" });
          return;
        }
      }

      // 2) 신고 상태 업데이트
      const newStatus: ReportStatus = action === "dismiss" ? "dismissed" : "resolved";
      const { error: reportErr } = await supabase
        .from("post_reports")
        .update({
          status: newStatus,
          admin_note: note.trim() || null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", report.id);

      if (reportErr) {
        toast({ title: "신고 업데이트 실패", description: reportErr.message, variant: "destructive" });
        return;
      }

      toast({
        title:
          action === "hide" ? "글이 숨김 처리되었습니다"
          : action === "dismiss" ? "신고가 반려되었습니다"
          : "신고가 처리되었습니다",
      });
      await fetchReports();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Flag className="w-5 h-5 text-destructive" /> 신고 처리
        </h2>
        <Button variant="outline" size="sm" onClick={() => void fetchReports()}>
          <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
        </Button>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 overflow-x-auto">
        {(Object.keys(statusLabels) as ReportStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
              filter === s
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {statusLabels[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          {statusLabels[filter]} 상태의 신고가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const preview = posts.get(r.post_id);
            const noteDraft = drafts.get(r.id) ?? r.admin_note ?? "";
            const isBusy = busyId === r.id;
            const isTerminal = r.status === "resolved" || r.status === "dismissed";

            return (
              <div key={r.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">{reasonLabels[r.reason]}</Badge>
                    <Badge variant={statusVariant[r.status]}>{statusLabels[r.status]}</Badge>
                    {preview && preview.moderation_status !== "ok" && (
                      <Badge variant="warning">글: {preview.moderation_status}</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </span>
                </div>

                <div className="bg-secondary rounded-lg p-3 space-y-1">
                  <p className="text-sm font-semibold">
                    {preview?.title || <span className="text-muted-foreground">(글 삭제됨)</span>}
                  </p>
                  {preview?.blocksText && (
                    <p className="text-xs text-muted-foreground line-clamp-3">{preview.blocksText}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 font-mono">
                    post_id: {r.post_id.slice(0, 8)}...
                  </p>
                </div>

                {r.details && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">신고자 상세</p>
                    <p className="text-sm bg-background border border-border rounded-lg p-2">{r.details}</p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">관리자 메모</label>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => {
                      const next = new Map(drafts);
                      next.set(r.id, e.target.value.slice(0, 500));
                      setDrafts(next);
                    }}
                    rows={2}
                    placeholder="처리 내역을 기록하세요"
                    className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none resize-none"
                    disabled={isTerminal}
                  />
                </div>

                {!isTerminal && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void applyAction(r, "resolve")}
                      disabled={isBusy}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" /> 처리 완료
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void applyAction(r, "dismiss")}
                      disabled={isBusy}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> 반려
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void applyAction(r, "hide")}
                      disabled={isBusy}
                    >
                      {isBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <EyeOff className="w-4 h-4 mr-1" />}
                      글 숨김
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

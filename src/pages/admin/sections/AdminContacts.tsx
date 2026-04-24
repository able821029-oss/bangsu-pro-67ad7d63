// AdminContacts — 관리자 문의 트레이
// 2026-04-26 — contact_messages 테이블 기반 (20260419_tighten_rls_and_contact_messages.sql 의존)
//
// 기능:
//  - 상태 필터(pending/in_progress/resolved/spam, 기본 pending)
//  - 드롭다운으로 상태 변경
//  - admin_note 입력/저장
//
// TODO(다음 세션): 상태 변경 시 이메일 알림. 현재는 미구현 — Resend 연동 필요.

import { useCallback, useEffect, useState } from "react";
import { Mail, Loader2, RefreshCw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ContactStatus = "pending" | "in_progress" | "resolved" | "spam";

interface ContactRow {
  id: string;
  user_id: string | null;
  email: string | null;
  category: string;
  message: string;
  status: ContactStatus;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

const statusLabels: Record<ContactStatus, string> = {
  pending: "대기",
  in_progress: "처리 중",
  resolved: "완료",
  spam: "스팸",
};

const statusVariant: Record<ContactStatus, "default" | "info" | "success" | "warning"> = {
  pending: "warning",
  in_progress: "info",
  resolved: "success",
  spam: "default",
};

export function AdminContacts() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<ContactStatus>("pending");
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map()); // id → admin_note draft
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_messages")
      .select("id, user_id, email, category, message, status, admin_note, created_at, resolved_at")
      .eq("status", filter)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast({ title: "문의 조회 실패", description: error.message, variant: "destructive" });
      setRows([]);
    } else {
      setRows((data || []) as ContactRow[]);
    }
    setLoading(false);
  }, [filter, toast]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  const saveRow = async (row: ContactRow, nextStatus: ContactStatus) => {
    if (busyId) return;
    setBusyId(row.id);
    try {
      const note = drafts.get(row.id) ?? row.admin_note ?? "";
      const resolvedAt =
        nextStatus === "resolved" || nextStatus === "spam"
          ? new Date().toISOString()
          : null;

      const { error } = await supabase
        .from("contact_messages")
        .update({
          status: nextStatus,
          admin_note: note.trim() || null,
          resolved_at: resolvedAt,
        })
        .eq("id", row.id);

      if (error) {
        toast({ title: "문의 업데이트 실패", description: error.message, variant: "destructive" });
        return;
      }

      // TODO: 이메일 알림 (row.email로 Resend 전송)

      toast({
        title:
          nextStatus === "resolved" ? "문의가 완료 처리되었습니다"
          : nextStatus === "spam" ? "스팸으로 표시되었습니다"
          : nextStatus === "in_progress" ? "처리 중으로 변경되었습니다"
          : "상태가 변경되었습니다",
      });
      await fetchRows();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" /> 문의 트레이
        </h2>
        <Button variant="outline" size="sm" onClick={() => void fetchRows()}>
          <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
        </Button>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 overflow-x-auto">
        {(Object.keys(statusLabels) as ContactStatus[]).map((s) => (
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
      ) : rows.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          {statusLabels[filter]} 상태의 문의가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const noteDraft = drafts.get(r.id) ?? r.admin_note ?? "";
            const isBusy = busyId === r.id;

            return (
              <div key={r.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{r.category}</Badge>
                    <Badge variant={statusVariant[r.status]}>{statusLabels[r.status]}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </span>
                </div>

                <div className="bg-secondary rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{r.email || "(이메일 미입력)"}</span>
                    {r.user_id && <span className="font-mono">· {r.user_id.slice(0, 8)}...</span>}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{r.message}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">관리자 메모</label>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => {
                      const next = new Map(drafts);
                      next.set(r.id, e.target.value.slice(0, 1000));
                      setDrafts(next);
                    }}
                    rows={2}
                    placeholder="처리 내역·회신 내용을 기록하세요"
                    className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <label className="text-xs font-medium text-muted-foreground">상태 변경:</label>
                  <select
                    defaultValue={r.status}
                    onChange={(e) => {
                      const next = e.target.value as ContactStatus;
                      if (next !== r.status) void saveRow(r, next);
                    }}
                    disabled={isBusy}
                    className="bg-secondary border border-border rounded-lg px-2 py-1 text-sm outline-none"
                  >
                    {(Object.keys(statusLabels) as ContactStatus[]).map((s) => (
                      <option key={s} value={s}>{statusLabels[s]}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void saveRow(r, r.status)}
                    disabled={isBusy}
                  >
                    {isBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    메모 저장
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

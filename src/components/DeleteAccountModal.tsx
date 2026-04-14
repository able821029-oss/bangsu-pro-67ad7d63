import { useState, useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DeleteAccountModalProps {
  onClose: () => void;
}

const REASONS = [
  "앱을 더 이상 사용하지 않아요",
  "원하는 기능이 없어요",
  "다른 서비스를 사용 중이에요",
  "개인정보가 걱정돼요",
  "사용법이 어려워요",
  "기타",
];

export function DeleteAccountModal({ onClose }: DeleteAccountModalProps) {
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // ESC 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, loading]);

  const finalReason = reason === "기타" ? customReason.trim() : reason;
  const canProceed = reason !== "" && (reason !== "기타" || customReason.trim().length > 0);
  const canDelete = confirmText === "탈퇴하겠습니다";

  const handleDelete = async () => {
    if (!canDelete) return;
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { reason: finalReason },
      });

      if (error || !data?.ok) {
        toast.error(data?.error || error?.message || "탈퇴 처리 실패");
        setLoading(false);
        return;
      }

      // 탈퇴 성공 — 로컬 데이터 모두 정리 후 로그인 페이지로
      try {
        localStorage.removeItem("sms-app-store");
        localStorage.removeItem("sms_onboarded");
      } catch { /* ignore */ }

      await supabase.auth.signOut();
      toast.success("탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.");
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (e) {
      console.error("[DeleteAccount]", e);
      toast.error("탈퇴 중 오류가 발생했습니다");
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-title"
    >
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !loading && onClose()}
        aria-hidden="true"
      />

      {/* 모달 */}
      <div
        className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h2 id="delete-title" className="text-lg font-bold text-foreground">
              정말 탈퇴하시겠어요?
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              탈퇴 시 모든 데이터(업체정보·게시물·영상·구독)가 즉시 삭제되며,
              복구할 수 없습니다.
            </p>
          </div>
        </div>

        {/* 본문 — 2단계 */}
        {step === 1 && (
          <div className="px-6 pb-6 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">
                탈퇴 사유를 선택해 주세요
              </p>
              <div className="space-y-2">
                {REASONS.map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                      reason === r
                        ? "bg-primary/10 border-primary"
                        : "bg-card border-border hover:bg-white/5"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r}
                      checked={reason === r}
                      onChange={(e) => setReason(e.target.value)}
                      className="accent-primary"
                    />
                    <span className="text-sm text-foreground">{r}</span>
                  </label>
                ))}
              </div>
              {reason === "기타" && (
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="자유롭게 알려주세요 (서비스 개선에 참고됩니다)"
                  className="w-full mt-3 bg-[#161B2B] border border-white/5 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus-visible:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                />
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 h-11 rounded-xl text-sm font-semibold bg-muted text-foreground hover:bg-muted/70 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!canProceed}
                className="flex-1 h-11 rounded-xl text-sm font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                다음
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="px-6 pb-6 space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-red-300">
                정말 탈퇴를 진행하시겠어요?
              </p>
              <p className="text-xs text-red-200/80 leading-relaxed">
                이 작업은 <b>되돌릴 수 없습니다</b>. 모든 데이터가 즉시 삭제되며,
                같은 이메일로 재가입하시더라도 기존 데이터는 복구할 수 없습니다.
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">
                확인을 위해 <b className="text-foreground">탈퇴하겠습니다</b>를 입력해 주세요
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="탈퇴하겠습니다"
                disabled={loading}
                className="w-full h-11 bg-[#161B2B] border border-white/5 rounded-xl px-3 text-sm text-foreground placeholder-muted-foreground focus-visible:outline-none focus:ring-1 focus:ring-red-500/40"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(1)}
                disabled={loading}
                className="flex-1 h-11 rounded-xl text-sm font-semibold bg-muted text-foreground hover:bg-muted/70 disabled:opacity-50 transition-colors"
              >
                이전
              </button>
              <button
                onClick={handleDelete}
                disabled={!canDelete || loading}
                className="flex-1 h-11 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 disabled:bg-red-500/30 disabled:text-red-200/50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> 처리 중…
                  </>
                ) : (
                  "탈퇴하기"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

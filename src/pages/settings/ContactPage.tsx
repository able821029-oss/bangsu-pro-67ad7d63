import { useState } from "react";
import { ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

export function ContactPage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [category, setCategory] = useState("일반 문의");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const categories = ["일반 문의", "버그 신고", "기능 요청", "결제 문의", "계정 문제"];

  const handleSend = async () => {
    if (!message.trim()) { toast.error("내용을 입력해주세요"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from("admin_config").upsert({
        key: `inquiry_${Date.now()}`,
        value: {
          user_id: user?.id,
          email: user?.email,
          category,
          message: message.trim(),
          created_at: new Date().toISOString(),
          status: "pending",
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      if (error) throw error;
      setSent(true);
      toast.success("문의가 접수되었습니다");
    } catch (e: any) {
      toast.error("전송 실패: " + (e.message || "다시 시도해주세요"));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="pb-24 max-w-lg mx-auto">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} aria-label="뒤로가기" className="p-2 -ml-2 rounded-lg hover:bg-secondary"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold">문의하기</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center"><CheckCircle2 className="w-8 h-8 text-success" /></div>
          <h2 className="text-lg font-bold text-foreground">문의가 접수되었습니다</h2>
          <p className="text-sm text-muted-foreground">빠른 시일 내 확인 후 답변드리겠습니다.</p>
          <button onClick={onBack} className="h-11 px-8 rounded-xl text-white font-semibold active:scale-[0.98]" style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>돌아가기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} aria-label="뒤로가기" className="p-2 -ml-2 rounded-lg hover:bg-secondary"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-lg font-bold">문의하기</h1>
      </div>
      <div className="px-4 pt-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">문의 유형</label>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${category === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{cat}</button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">내용</label>
          <textarea placeholder="문의 내용을 입력해주세요..." value={message} onChange={(e) => setMessage(e.target.value.slice(0, 500))}
            className="w-full min-h-[200px] bg-card border border-border rounded-xl p-4 text-sm text-foreground placeholder-muted-foreground resize-none focus-visible:outline-none focus:ring-1 focus:ring-primary/40" />
          <p className="text-xs text-muted-foreground text-right">{message.length}/500자</p>
        </div>
        <button onClick={handleSend} disabled={loading || !message.trim()}
          className="w-full h-12 rounded-xl text-white font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
          <Send className="w-4 h-4" /> {loading ? "전송 중..." : "문의 보내기"}
        </button>
      </div>
    </div>
  );
}

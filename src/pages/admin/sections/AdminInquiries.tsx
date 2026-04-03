import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface AdminInquiry {
  id: string;
  user: string;
  type: string;
  title: string;
  content: string;
  status: "접수완료" | "처리중" | "답변완료";
  createdAt: string;
  reply?: string;
}

const mockInquiries: AdminInquiry[] = [
  { id: "1", user: "김방수", type: "이용 방법", title: "사진 업로드가 안 됩니다", content: "갤러리에서 사진 선택 후 앱이 멈춥니다", status: "접수완료", createdAt: "2026-04-01" },
  { id: "2", user: "이시공", type: "결제·환불", title: "프로 플랜 결제 문의", content: "연간 결제로 변경하고 싶습니다", status: "처리중", createdAt: "2026-03-28" },
  { id: "3", user: "박누수", type: "기능 제안", title: "카카오톡 공유 기능", content: "카카오톡으로 직접 공유하는 기능 추가 부탁드립니다", status: "답변완료", createdAt: "2026-03-25", reply: "좋은 제안 감사합니다. 다음 업데이트에 반영하겠습니다!" },
];

const statusColor: Record<string, "info" | "warning" | "success"> = {
  "접수완료": "info",
  "처리중": "warning",
  "답변완료": "success",
};

export function AdminInquiries() {
  const { toast } = useToast();
  const [inquiries, setInquiries] = useState(mockInquiries);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const selected = inquiries.find((i) => i.id === selectedId);

  const handleReply = () => {
    if (!selectedId || !reply.trim()) return;
    setInquiries((prev) =>
      prev.map((i) => (i.id === selectedId ? { ...i, status: "답변완료" as const, reply: reply.trim() } : i))
    );
    toast({ title: "답변이 전송되었습니다." });
    setReply("");
    setSelectedId(null);
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-primary" /> 문의 관리
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* List */}
        <div className="space-y-3">
          {inquiries.map((inq) => (
            <button
              key={inq.id}
              onClick={() => { setSelectedId(inq.id); setReply(inq.reply || ""); }}
              className={`w-full text-left bg-card rounded-xl border p-3 transition-colors ${
                selectedId === inq.id ? "border-primary" : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm truncate">{inq.title}</span>
                <Badge variant={statusColor[inq.status]} className="text-xs shrink-0 ml-2">{inq.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{inq.user} · {inq.type} · {inq.createdAt}</p>
            </button>
          ))}
        </div>

        {/* Detail */}
        {selected && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-4">
            <div>
              <p className="font-bold">{selected.title}</p>
              <p className="text-xs text-muted-foreground">{selected.user} · {selected.type} · {selected.createdAt}</p>
            </div>
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-sm">{selected.content}</p>
            </div>
            {selected.reply && (
              <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                <p className="text-xs text-primary font-semibold mb-1">답변</p>
                <p className="text-sm">{selected.reply}</p>
              </div>
            )}
            <div className="space-y-2">
              <textarea
                className="w-full bg-secondary rounded-lg p-3 text-sm outline-none text-foreground resize-none min-h-[80px]"
                placeholder="답변을 작성하세요..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <Button size="sm" onClick={handleReply}>
                <Send className="w-4 h-4" /> 답변 전송
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

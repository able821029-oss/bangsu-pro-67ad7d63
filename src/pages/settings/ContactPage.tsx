import { useState } from "react";
import { ArrowLeft, Send, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores/appStore";
import { useToast } from "@/hooks/use-toast";

const inquiryTypes = ["이용 방법", "결제·환불", "오류 신고", "기능 제안", "기타"];

const statusColor: Record<string, "info" | "warning" | "success"> = {
  "접수완료": "info",
  "처리중": "warning",
  "답변완료": "success",
};

export function ContactPage({ onBack }: { onBack: () => void }) {
  const { inquiries, addInquiry } = useAppStore();
  const { toast } = useToast();
  const [type, setType] = useState(inquiryTypes[0]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "제목과 내용을 입력해주세요.", variant: "destructive" });
      return;
    }
    addInquiry({
      id: crypto.randomUUID(),
      type,
      title: title.trim(),
      content: content.trim(),
      status: "접수완료",
      createdAt: new Date().toISOString().slice(0, 10),
    });
    toast({ title: "✅ 문의가 접수되었습니다. 영업일 1일 이내 답변드립니다." });
    setTitle("");
    setContent("");
  };

  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">💬 문의하기</h1>
      </div>

      {/* Form */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">문의 유형</label>
          <div className="flex flex-wrap gap-2">
            {inquiryTypes.map((t) => (
              <Badge
                key={t}
                variant={type === t ? "chipActive" : "chip"}
                className="text-sm px-3 py-1.5 cursor-pointer"
                onClick={() => setType(t)}
              >
                {t}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">제목</label>
          <input
            className="w-full bg-secondary rounded-lg px-3 py-3 text-sm outline-none text-foreground"
            placeholder="문의 제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">내용 (최대 500자)</label>
          <textarea
            className="w-full bg-secondary rounded-lg px-3 py-3 text-sm outline-none text-foreground resize-none min-h-[120px]"
            placeholder="문의 내용을 입력하세요"
            maxLength={500}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <p className="text-xs text-muted-foreground text-right">{content.length}/500</p>
        </div>

        <Button variant="secondary" size="sm" className="w-full">
          <Paperclip className="w-4 h-4" /> 스크린샷 첨부 (선택)
        </Button>

        <Button size="lg" className="w-full" onClick={handleSubmit}>
          <Send className="w-5 h-5" /> 문의 접수
        </Button>
      </div>

      {/* History */}
      {inquiries.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-3">문의 내역</p>
          <div className="space-y-3">
            {inquiries.map((inq) => (
              <div key={inq.id} className="bg-card rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm truncate flex-1">{inq.title}</p>
                  <Badge variant={statusColor[inq.status]} className="text-xs shrink-0 ml-2">{inq.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{inq.type} · {inq.createdAt}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

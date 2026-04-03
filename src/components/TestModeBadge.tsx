import { useState } from "react";
import { Wrench } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TestModeBadgeProps {
  label?: string;
  inline?: boolean;
}

export function TestModeBadge({ label = "테스트 모드", inline = false }: TestModeBadgeProps) {
  const [open, setOpen] = useState(false);

  if (inline) {
    return (
      <>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: "#FFF7ED", color: "#F97316", border: "1px solid #FDBA74" }}
        >
          <Wrench className="w-3 h-3" />
          {label}
        </button>
        <TestModeDialog open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
        style={{ backgroundColor: "#FFF7ED", color: "#F97316", border: "1px solid #FDBA74" }}
      >
        <Wrench className="w-3.5 h-3.5" />
        {label}
      </button>
      <TestModeDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function TestModeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-warning" />
            테스트 모드
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>현재 테스트 모드입니다.</p>
          <p>실제 결제·과금이 발생하지 않습니다.</p>
          <p className="text-xs">관리자 페이지에서 운영 키로 전환할 수 있습니다.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

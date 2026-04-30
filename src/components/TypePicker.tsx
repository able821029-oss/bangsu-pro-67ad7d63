import { Briefcase, Video } from "lucide-react";
import { IconChip } from "@/components/IconChip";
import type { BlogMode } from "@/stores/appStore";

interface Props {
  /** 헤더 위에 추가로 표시할 부제(선택) */
  hint?: string;
  onPick: (m: BlogMode) => void;
}

/**
 * 글 작성 진입 시 첫 화면 — 작성 모드 2지선다.
 * BlogWriterTab(직접 글쓰기), CameraTab(AI 글쓰기) 모두 진입 첫 화면에서 사용.
 */
export function TypePicker({ hint, onPick }: Props) {
  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="glass-card p-5 text-center space-y-1.5">
        <h2 className="text-base font-bold text-foreground">어떤 글을 쓰시나요?</h2>
        <p className="text-xs text-muted-foreground">
          {hint ?? "유형에 따라 작성 흐름이 달라져요. 작성 중에도 변경할 수 있어요."}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={() => onPick("expert")}
          className="glass-card-glow p-5 text-left flex items-start gap-4 hover:bg-white/5 transition-colors"
        >
          <IconChip icon={Briefcase} color="blue" size="lg" />
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-foreground">전문가형</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              현장 정보(지역·면적·공법·특가)를 입력하고, 소제목+사진+본문 구조로 시공 블로그를 씁니다. SEO에 유리해요.
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onPick("vlog")}
          className="glass-card p-5 text-left flex items-start gap-4 hover:bg-white/5 transition-colors"
        >
          <IconChip icon={Video} color="purple" size="lg" />
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-foreground">브이로그형</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              현장 정보 없이 자유 형식으로 텍스트+사진+본문을 자유롭게 이어갑니다. 일상 기록에 좋아요.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

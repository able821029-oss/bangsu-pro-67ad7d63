import { useRef, useState } from "react";
import {
  Plus, X, Camera, ImagePlus, ArrowLeft, ArrowRight, Sparkles, Trash2,
  MapPin, Ruler, Wrench, FileText as NoteIcon, Type, Loader2,
} from "lucide-react";
import {
  useAppStore,
  MAX_DRAFTS,
  BlogPost,
  ContentBlock,
} from "@/stores/appStore";
import { IconChip } from "@/components/IconChip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import type { TabId } from "@/components/BottomNav";
import { cn } from "@/lib/utils";

type WizardStep = 1 | 2;

interface Props {
  onNavigate: (tab: TabId) => void;
  onViewPost: (post: BlogPost) => void;
}

export function BlogWriterTab({ onNavigate, onViewPost }: Props) {
  void onNavigate;
  const { toast } = useToast();
  const { user } = useAuth();
  const drafts = useAppStore((s) => s.drafts);
  const activeIdx = useAppStore((s) => s.activeDraftIdx);
  const addDraft = useAppStore((s) => s.addDraft);
  const removeDraft = useAppStore((s) => s.removeDraft);
  const setActiveDraft = useAppStore((s) => s.setActiveDraft);
  const updateDraft = useAppStore((s) => s.updateDraft);
  const addSection = useAppStore((s) => s.addSection);
  const updateSection = useAppStore((s) => s.updateSection);
  const removeSection = useAppStore((s) => s.removeSection);
  const resetDraft = useAppStore((s) => s.resetDraft);
  const addPost = useAppStore((s) => s.addPost);
  const settings = useAppStore((s) => s.settings);
  const selectedPersona = useAppStore((s) => s.selectedPersona);
  const selectedPlatforms = useAppStore((s) => s.selectedPlatforms);

  const [step, setStep] = useState<WizardStep>(1);
  const [saving, setSaving] = useState(false);

  const draft = drafts[activeIdx] ?? drafts[0];

  const handleAddDraft = () => {
    if (drafts.length >= MAX_DRAFTS) {
      toast({
        title: `글은 최대 ${MAX_DRAFTS}개까지 동시 작성 가능합니다`,
        variant: "destructive",
      });
      return;
    }
    addDraft();
    setStep(1);
  };

  const handleSwitchDraft = (idx: number) => {
    setActiveDraft(idx);
    setStep(1);
  };

  const handleRemoveDraft = (idx: number) => {
    const target = drafts[idx];
    const hasContent =
      target.title ||
      target.location ||
      target.siteArea ||
      target.siteMethod ||
      target.siteEtc ||
      target.sections.length > 0;
    if (hasContent && !window.confirm("작성 중인 내용이 삭제됩니다. 계속할까요?")) return;
    removeDraft(idx);
  };

  const handleNext = () => {
    if (!draft.title.trim()) {
      toast({ title: "제목을 입력해주세요", variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const canSave = (() => {
    // 섹션 중 최소 하나 이상에 소제목 OR 글이 있어야 저장 가능
    const hasFilledSection = draft.sections.some(
      (s) => s.subtitle.trim() || s.text.trim() || s.photo,
    );
    return !!(draft.title.trim() && hasFilledSection);
  })();

  const handleSave = async () => {
    if (!canSave) {
      toast({
        title: "저장할 내용이 부족합니다",
        description: "제목과 섹션 최소 1개(소제목/사진/글 중 하나)가 필요합니다.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      // 빈 섹션 필터링 후 blocks 변환
      const filledSections = draft.sections.filter(
        (s) => s.subtitle.trim() || s.text.trim() || s.photo,
      );
      const blocks: ContentBlock[] = [];
      const photos = filledSections
        .map((s) => s.photo)
        .filter((p): p is NonNullable<typeof p> => p !== null);

      // 현장 정보를 첫 블록에 자동 삽입 (지역/면적/공법/기타)
      const siteBits: string[] = [];
      if (draft.location) siteBits.push(`지역: ${draft.location}`);
      if (draft.siteArea) siteBits.push(`시공면적: ${draft.siteArea}`);
      if (draft.siteMethod) siteBits.push(`공법: ${draft.siteMethod}`);
      if (draft.siteEtc) siteBits.push(`기타: ${draft.siteEtc}`);
      if (siteBits.length > 0) {
        blocks.push({ type: "subtitle", content: "현장 정보" });
        blocks.push({ type: "text", content: siteBits.join(" · ") });
      }

      filledSections.forEach((s, i) => {
        if (s.subtitle.trim()) {
          blocks.push({ type: "subtitle", content: s.subtitle.trim() });
        }
        if (s.photo) {
          blocks.push({
            type: "photo",
            content: `photo-${i + 1}`,
            caption: s.subtitle || "",
          });
        }
        if (s.text.trim()) {
          blocks.push({ type: "text", content: s.text.trim() });
        }
      });

      const newPost: BlogPost = {
        id: crypto.randomUUID(),
        title: draft.title.trim(),
        photos,
        workType: "기타",
        style: "시공일지형",
        blocks,
        hashtags: [],
        status: "완료",
        createdAt: new Date().toISOString().slice(0, 10),
        platforms: [...selectedPlatforms],
        persona: selectedPersona,
        location: draft.location || undefined,
        siteInfo: {
          area: draft.siteArea,
          method: draft.siteMethod,
          etc: draft.siteEtc,
        },
      };

      // DB 저장 시도 (실패해도 로컬 저장은 유지)
      try {
        if (user) {
          const { error } = await supabase.from("posts").insert({
            id: newPost.id,
            title: newPost.title,
            blocks: newPost.blocks as unknown as Record<string, unknown>[],
            hashtags: newPost.hashtags,
            photos: newPost.photos.map((p) => ({ id: p.id, dataUrl: p.dataUrl })) as unknown as Record<string, unknown>[],
            work_type: "기타",
            style: "시공일지형",
            persona: newPost.persona,
            platforms: newPost.platforms,
            status: "완료",
            location: newPost.location || null,
            building_type: null,
            work_date: null,
            user_id: user.id,
          });
          if (error) {
            console.warn("[BlogWriter] DB insert failed:", error.message);
          }
        }
      } catch (e) {
        console.warn("[BlogWriter] DB insert exception:", e);
      }

      addPost(newPost);
      resetDraft(activeIdx);
      setStep(1);
      toast({ title: "글이 저장되었습니다 ✨" });
      onViewPost(newPost);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 pt-4 pb-28 max-w-lg mx-auto space-y-4">
      {/* 상단 글 탭 (최대 4개) */}
      <div className="glass-card p-2 flex items-center gap-1 overflow-x-auto">
        {drafts.map((d, i) => {
          const label = d.title.trim() ? d.title.slice(0, 8) : `글 ${i + 1}`;
          const isActive = i === activeIdx;
          return (
            <div key={d.id} className="flex items-center shrink-0">
              <button
                onClick={() => handleSwitchDraft(i)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-semibold transition-all",
                  isActive
                    ? "nav-active-bg text-[#4C8EFF]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
              {drafts.length > 1 && isActive && (
                <button
                  onClick={() => handleRemoveDraft(i)}
                  aria-label={`글 ${i + 1} 삭제`}
                  className="ml-0.5 p-1 rounded-md hover:bg-white/5"
                >
                  <X size={12} className="text-muted-foreground" />
                </button>
              )}
            </div>
          );
        })}
        {drafts.length < MAX_DRAFTS && (
          <button
            onClick={handleAddDraft}
            aria-label="새 글 추가"
            className="ml-auto shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold text-primary border border-dashed border-primary/30 hover:bg-primary/5"
          >
            <Plus size={14} /> 새 글
          </button>
        )}
      </div>

      {/* 위저드 단계 표시 */}
      <div className="flex items-center gap-2 px-1">
        <StepPill active={step === 1} label="1 · 현장 정보" />
        <div className="h-px flex-1 bg-white/10" />
        <StepPill active={step === 2} label="2 · 섹션 작성" />
      </div>

      {step === 1 ? (
        <Step1Form
          draft={draft}
          onChange={(patch) => updateDraft(activeIdx, patch)}
          onNext={handleNext}
        />
      ) : (
        <Step2Sections
          draftIdx={activeIdx}
          sections={draft.sections}
          onAddSection={() => addSection(activeIdx)}
          onUpdateSection={(id, patch) => updateSection(activeIdx, id, patch)}
          onRemoveSection={(id) => removeSection(activeIdx, id)}
          onBack={() => setStep(1)}
          onSave={handleSave}
          canSave={canSave}
          saving={saving}
        />
      )}
    </div>
  );
}

function StepPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={cn(
        "text-[11px] px-2.5 py-1 rounded-full font-semibold transition-colors",
        active
          ? "bg-[#4C8EFF]/20 text-[#4C8EFF] border border-[#4C8EFF]/40"
          : "text-muted-foreground border border-white/10",
      )}
    >
      {label}
    </span>
  );
}

// ── Step 1: 현장 정보 폼 ──
function Step1Form({
  draft,
  onChange,
  onNext,
}: {
  draft: ReturnType<typeof useAppStore.getState>["drafts"][number];
  onChange: (patch: Partial<ReturnType<typeof useAppStore.getState>["drafts"][number]>) => void;
  onNext: () => void;
}) {
  return (
    <div className="glass-card p-5 space-y-4">
      <FormField
        icon={Type}
        iconColor="blue"
        label="제목"
        required
        placeholder="예) 강남구 옥상 방수 시공 완료"
        value={draft.title}
        onChange={(v) => onChange({ title: v })}
      />
      <FormField
        icon={MapPin}
        iconColor="cyan"
        label="지역"
        placeholder="예) 서울 강남구 역삼동"
        value={draft.location}
        onChange={(v) => onChange({ location: v })}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          icon={Ruler}
          iconColor="indigo"
          label="시공 면적"
          placeholder="예) 120㎡"
          value={draft.siteArea}
          onChange={(v) => onChange({ siteArea: v })}
          compact
        />
        <FormField
          icon={Wrench}
          iconColor="purple"
          label="공법"
          placeholder="예) 우레탄 도막"
          value={draft.siteMethod}
          onChange={(v) => onChange({ siteMethod: v })}
          compact
        />
      </div>
      <FormField
        icon={NoteIcon}
        iconColor="slate"
        label="기타"
        placeholder="예) 누수 보수 병행, 옥상 난간 포함"
        value={draft.siteEtc}
        onChange={(v) => onChange({ siteEtc: v })}
      />

      <button onClick={onNext} className="btn-power w-full mt-2">
        다음 <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}

function FormField({
  icon,
  iconColor,
  label,
  placeholder,
  value,
  onChange,
  required,
  compact,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; color?: string; strokeWidth?: number }>;
  iconColor: "blue" | "purple" | "cyan" | "green" | "amber" | "rose" | "indigo" | "orange" | "slate";
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <IconChip icon={icon} color={iconColor} size="sm" />
        {label}
        {required && <span className="text-[#EF4444]">*</span>}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full rounded-xl bg-background/60 border border-white/10 px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus:ring-1 focus:ring-primary/40",
          compact ? "h-11" : "h-12",
        )}
      />
    </div>
  );
}

// ── Step 2: 섹션 (소제목 + 사진 + 글) 동적 추가 ──
function Step2Sections({
  draftIdx: _draftIdx,
  sections,
  onAddSection,
  onUpdateSection,
  onRemoveSection,
  onBack,
  onSave,
  canSave,
  saving,
}: {
  draftIdx: number;
  sections: ReturnType<typeof useAppStore.getState>["drafts"][number]["sections"];
  onAddSection: () => void;
  onUpdateSection: (
    id: string,
    patch: Partial<ReturnType<typeof useAppStore.getState>["drafts"][number]["sections"][number]>,
  ) => void;
  onRemoveSection: (id: string) => void;
  onBack: () => void;
  onSave: () => void;
  canSave: boolean;
  saving: boolean;
}) {
  return (
    <div className="space-y-3">
      {sections.length === 0 && (
        <div className="glass-card p-6 text-center space-y-2">
          <div className="icon-chip icon-chip-lg mx-auto">
            <Sparkles color="#AB5EBE" size={22} />
          </div>
          <p className="text-sm font-semibold text-foreground">아직 섹션이 없어요</p>
          <p className="text-xs text-muted-foreground">
            <strong>+ 섹션 추가</strong> 버튼으로 소제목, 사진, 글을 자유롭게 배치해 주세요
          </p>
        </div>
      )}

      {sections.map((s, i) => (
        <SectionCard
          key={s.id}
          section={s}
          index={i}
          onUpdate={(patch) => onUpdateSection(s.id, patch)}
          onRemove={() => onRemoveSection(s.id)}
        />
      ))}

      <button
        onClick={onAddSection}
        className="w-full flex items-center justify-center gap-2 glass-card py-4 font-semibold text-primary border border-dashed border-primary/40 hover:bg-primary/5 transition-colors"
      >
        <Plus className="w-4 h-4" /> 섹션 추가
      </button>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onBack}
          className="flex-1 h-12 rounded-full border border-white/10 text-sm font-semibold text-foreground flex items-center justify-center gap-1 hover:bg-white/5"
        >
          <ArrowLeft className="w-4 h-4" /> 이전
        </button>
        <button
          onClick={onSave}
          disabled={!canSave || saving}
          className="flex-[2] btn-power disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {saving ? "저장 중..." : "저장하기"}
        </button>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  index,
  onUpdate,
  onRemove,
}: {
  section: ReturnType<typeof useAppStore.getState>["drafts"][number]["sections"][number];
  index: number;
  onUpdate: (patch: Partial<ReturnType<typeof useAppStore.getState>["drafts"][number]["sections"][number]>) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onUpdate({
        photo: {
          id: crypto.randomUUID(),
          dataUrl: (ev.target?.result as string) || "",
        },
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
            섹션 {index + 1}
          </span>
        </div>
        <button
          onClick={onRemove}
          aria-label={`섹션 ${index + 1} 삭제`}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* 소제목 */}
      <div className="space-y-1">
        <label className="text-[11px] text-muted-foreground">소제목</label>
        <input
          type="text"
          placeholder="예) 시공 전 상태"
          value={section.subtitle}
          onChange={(e) => onUpdate({ subtitle: e.target.value })}
          className="w-full h-11 rounded-xl bg-background/60 border border-white/10 px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      {/* 사진 */}
      <div className="space-y-1">
        <label className="text-[11px] text-muted-foreground">사진</label>
        {section.photo ? (
          <div className="relative">
            <img
              src={section.photo.dataUrl}
              alt=""
              className="w-full h-40 object-cover rounded-xl"
            />
            <button
              onClick={() => onUpdate({ photo: null })}
              aria-label="사진 삭제"
              className="absolute top-2 right-2 bg-black/70 rounded-full p-1.5"
            >
              <X size={14} className="text-white" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => cameraRef.current?.click()}
              className="h-20 rounded-xl border border-dashed border-white/15 flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:bg-white/5"
            >
              <Camera size={18} />
              사진 촬영
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="h-20 rounded-xl border border-dashed border-white/15 flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:bg-white/5"
            >
              <ImagePlus size={18} />
              갤러리
            </button>
          </div>
        )}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {/* 글 */}
      <div className="space-y-1">
        <label className="text-[11px] text-muted-foreground">글</label>
        <textarea
          placeholder="이 섹션의 본문을 입력해주세요"
          value={section.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={4}
          className="w-full rounded-xl bg-background/60 border border-white/10 p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
        />
      </div>
    </div>
  );
}

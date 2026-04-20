import { useRef, useState } from "react";
import {
  Plus, X, Camera, ImagePlus, Sparkles, Trash2,
  MapPin, Ruler, Wrench, FileText as NoteIcon, Type, Loader2,
} from "lucide-react";
import {
  useAppStore,
  MAX_DRAFTS,
  BlogPost,
  ContentBlock,
  Platform,
} from "@/stores/appStore";
import { IconChip } from "@/components/IconChip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import type { TabId } from "@/components/BottomNav";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/imageCompress";

// 한국 17개 시·도 + 전국
const REGIONS = [
  "전국",
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
] as const;

// 시/도별 시·군·구 제안 (특·광역시는 전체 목록, 도 단위는 대표 시/군만)
const SIDO_TO_SIGUNGU: Record<string, string[]> = {
  서울: [
    "강남구","강동구","강북구","강서구","관악구","광진구","구로구","금천구",
    "노원구","도봉구","동대문구","동작구","마포구","서대문구","서초구","성동구",
    "성북구","송파구","양천구","영등포구","용산구","은평구","종로구","중구","중랑구",
  ],
  부산: [
    "강서구","금정구","기장군","남구","동구","동래구","부산진구","북구",
    "사상구","사하구","서구","수영구","연제구","영도구","중구","해운대구",
  ],
  대구: ["남구","달서구","달성군","동구","북구","서구","수성구","중구","군위군"],
  인천: ["강화군","계양구","남동구","동구","미추홀구","부평구","서구","연수구","옹진군","중구"],
  광주: ["광산구","남구","동구","북구","서구"],
  대전: ["대덕구","동구","서구","유성구","중구"],
  울산: ["남구","동구","북구","울주군","중구"],
  세종: ["세종특별자치시"],
  경기: [
    "수원시","용인시","고양시","성남시","부천시","화성시","안산시","남양주시",
    "안양시","평택시","의정부시","시흥시","파주시","김포시","광명시","광주시",
    "군포시","오산시","이천시","양주시","안성시","구리시","포천시","의왕시",
    "하남시","여주시","동두천시","과천시","가평군","양평군","연천군",
  ],
  강원: [
    "춘천시","원주시","강릉시","동해시","태백시","속초시","삼척시",
    "홍천군","횡성군","영월군","평창군","정선군","철원군","화천군","양구군","인제군","고성군","양양군",
  ],
  충북: ["청주시","충주시","제천시","보은군","옥천군","영동군","증평군","진천군","괴산군","음성군","단양군"],
  충남: [
    "천안시","공주시","보령시","아산시","서산시","논산시","계룡시","당진시",
    "금산군","부여군","서천군","청양군","홍성군","예산군","태안군",
  ],
  전북: ["전주시","군산시","익산시","정읍시","남원시","김제시","완주군","진안군","무주군","장수군","임실군","순창군","고창군","부안군"],
  전남: [
    "목포시","여수시","순천시","나주시","광양시",
    "담양군","곡성군","구례군","고흥군","보성군","화순군","장흥군","강진군",
    "해남군","영암군","무안군","함평군","영광군","장성군","완도군","진도군","신안군",
  ],
  경북: [
    "포항시","경주시","김천시","안동시","구미시","영주시","영천시","상주시","문경시","경산시",
    "의성군","청송군","영양군","영덕군","청도군","고령군","성주군","칠곡군","예천군","봉화군","울진군","울릉군",
  ],
  경남: [
    "창원시","진주시","통영시","사천시","김해시","밀양시","거제시","양산시",
    "의령군","함안군","창녕군","고성군","남해군","하동군","산청군","함양군","거창군","합천군",
  ],
  제주: ["제주시","서귀포시"],
  전국: [],
};

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
  const addPhotosAsSections = useAppStore((s) => s.addPhotosAsSections);
  const updateSection = useAppStore((s) => s.updateSection);
  const removeSection = useAppStore((s) => s.removeSection);
  const resetDraft = useAppStore((s) => s.resetDraft);
  const addPost = useAppStore((s) => s.addPost);
  const settings = useAppStore((s) => s.settings);
  const selectedPersona = useAppStore((s) => s.selectedPersona);
  const selectedPlatforms = useAppStore((s) => s.selectedPlatforms);
  const togglePlatform = useAppStore((s) => s.togglePlatform);

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
  };

  const handleSwitchDraft = (idx: number) => {
    setActiveDraft(idx);
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

      // 풀 주소 조합: "서울 강남구 역삼동" 형태
      const fullLocation = [draft.location, draft.locationSigu, draft.locationDong]
        .map((v) => v.trim())
        .filter(Boolean)
        .join(" ");

      // 현장 정보를 첫 블록에 자동 삽입 (지역/면적/공법/기타)
      const siteBits: string[] = [];
      if (fullLocation) siteBits.push(`지역: ${fullLocation}`);
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
        location: fullLocation || undefined,
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

      {/* 1) 현장 정보 — 항시 고정 */}
      <FieldsBlock
        draft={draft}
        onChange={(patch) => updateDraft(activeIdx, patch)}
        selectedPlatforms={selectedPlatforms}
        onTogglePlatform={togglePlatform}
      />

      {/* 2) 섹션 영역 + 3) + 글쓰기 추가 — 항시 고정 */}
      <SectionsBlock
        sections={draft.sections}
        onAddSection={() => addSection(activeIdx)}
        onAddPhotosAsSections={(photos) => addPhotosAsSections(activeIdx, photos)}
        onUpdateSection={(id, patch) => updateSection(activeIdx, id, patch)}
        onRemoveSection={(id) => removeSection(activeIdx, id)}
        onSave={handleSave}
        canSave={canSave}
        saving={saving}
      />
    </div>
  );
}

// ── 1) 현장 정보 블록 (항시 고정) ──
function FieldsBlock({
  draft,
  onChange,
  selectedPlatforms,
  onTogglePlatform,
}: {
  draft: ReturnType<typeof useAppStore.getState>["drafts"][number];
  onChange: (patch: Partial<ReturnType<typeof useAppStore.getState>["drafts"][number]>) => void;
  selectedPlatforms: Platform[];
  onTogglePlatform: (p: Platform) => void;
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
      <RegionSelect
        sido={draft.location}
        sigu={draft.locationSigu}
        dong={draft.locationDong}
        onChange={(patch) => onChange(patch)}
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

      {/* 발행 채널 선택 */}
      <PlatformPicker selected={selectedPlatforms} onToggle={onTogglePlatform} />
    </div>
  );
}

function PlatformPicker({
  selected,
  onToggle,
}: {
  selected: Platform[];
  onToggle: (p: Platform) => void;
}) {
  const options: { id: Platform; label: string; sub: string }[] = [
    { id: "naver", label: "네이버 블로그", sub: "긴 글 · SEO" },
    { id: "instagram", label: "인스타그램", sub: "정사각 · 해시태그" },
    { id: "tiktok", label: "틱톡", sub: "숏폼 스크립트" },
  ];
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">발행 채널</label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onToggle(o.id)}
              aria-pressed={on}
              className={cn(
                "rounded-xl px-2 py-2.5 text-left transition-all border",
                on
                  ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30"
                  : "bg-background/40 border-white/10 hover:border-white/20",
              )}
            >
              <p className={cn("text-[12px] font-semibold", on ? "text-primary" : "text-foreground")}>
                {o.label}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{o.sub}</p>
            </button>
          );
        })}
      </div>
      {selected.length === 0 && (
        <p className="text-[11px] text-destructive">최소 1개 이상 선택해 주세요</p>
      )}
    </div>
  );
}

function RegionSelect({
  sido,
  sigu,
  dong,
  onChange,
}: {
  sido: string;
  sigu: string;
  dong: string;
  onChange: (patch: { location?: string; locationSigu?: string; locationDong?: string }) => void;
}) {
  const siguOptions = sido ? SIDO_TO_SIGUNGU[sido] ?? [] : [];
  const datalistId = `sigu-options-${sido || "none"}`;

  const handleSidoChange = (v: string) => {
    // 시/도가 바뀌면 하위 값은 초기화
    onChange({ location: v, locationSigu: "", locationDong: "" });
  };

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <IconChip icon={MapPin} color="cyan" size="sm" />
        지역
      </label>

      {/* 시/도 */}
      <div className="relative">
        <select
          value={sido}
          onChange={(e) => handleSidoChange(e.target.value)}
          className="w-full h-12 rounded-xl bg-background/60 border border-white/10 px-4 pr-10 text-sm text-foreground appearance-none focus-visible:outline-none focus:ring-1 focus:ring-primary/40"
          aria-label="시/도 선택"
        >
          <option value="">시/도를 선택해주세요</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xs"
        >
          ▾
        </span>
      </div>

      {/* 시·군·구 + 동 */}
      <div className="grid grid-cols-2 gap-2">
        {siguOptions.length > 0 ? (
          <div className="relative">
            <input
              list={datalistId}
              value={sigu}
              onChange={(e) => onChange({ locationSigu: e.target.value })}
              placeholder="시·군·구"
              className="w-full h-11 rounded-xl bg-background/60 border border-white/10 px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus:ring-1 focus:ring-primary/40"
              aria-label="시/군/구 선택 또는 입력"
              disabled={!sido}
            />
            <datalist id={datalistId}>
              {siguOptions.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
        ) : (
          <input
            value={sigu}
            onChange={(e) => onChange({ locationSigu: e.target.value })}
            placeholder="시·군·구"
            className="w-full h-11 rounded-xl bg-background/60 border border-white/10 px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
            aria-label="시/군/구 입력"
            disabled={!sido}
          />
        )}
        <input
          value={dong}
          onChange={(e) => onChange({ locationDong: e.target.value })}
          placeholder="동/읍/면"
          className="w-full h-11 rounded-xl bg-background/60 border border-white/10 px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
          aria-label="동/읍/면 입력"
          disabled={!sido}
        />
      </div>
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
const MAX_BULK_PHOTOS = 6;

// ── 2) 섹션 영역 + 3) + 글쓰기 추가 (항시 고정) ──
function SectionsBlock({
  sections,
  onAddSection,
  onAddPhotosAsSections,
  onUpdateSection,
  onRemoveSection,
  onSave,
  canSave,
  saving,
}: {
  sections: ReturnType<typeof useAppStore.getState>["drafts"][number]["sections"];
  onAddSection: () => void;
  onAddPhotosAsSections: (photos: { id: string; dataUrl: string }[]) => number;
  onUpdateSection: (
    id: string,
    patch: Partial<ReturnType<typeof useAppStore.getState>["drafts"][number]["sections"][number]>,
  ) => void;
  onRemoveSection: (id: string) => void;
  onSave: () => void;
  canSave: boolean;
  saving: boolean;
}) {
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [bulkLoading, setBulkLoading] = useState(false);

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    if (files.length > MAX_BULK_PHOTOS) {
      toast({
        title: `한 번에 최대 ${MAX_BULK_PHOTOS}장까지 업로드할 수 있어요`,
        description: `처음 ${MAX_BULK_PHOTOS}장만 추가됩니다.`,
      });
    }
    const picked = files.slice(0, MAX_BULK_PHOTOS);

    setBulkLoading(true);
    try {
      const compressed = await Promise.all(
        picked.map(
          (file) =>
            new Promise<string | null>((resolve) => {
              const reader = new FileReader();
              reader.onload = async (ev) => {
                const raw = (ev.target?.result as string) || "";
                if (!raw) return resolve(null);
                try {
                  resolve(await compressImage(raw, 800, 0.7));
                } catch {
                  resolve(raw);
                }
              };
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(file);
            }),
        ),
      );

      const photos = compressed
        .filter((d): d is string => !!d)
        .map((dataUrl) => ({ id: crypto.randomUUID(), dataUrl }));

      if (photos.length === 0) {
        toast({ title: "사진을 읽지 못했어요", variant: "destructive" });
        return;
      }

      const placed = onAddPhotosAsSections(photos);
      toast({ title: `사진 ${placed}장이 섹션으로 추가되었어요 ✨` });
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 사진 일괄 업로드 (최대 6장) */}
      <button
        onClick={() => bulkFileRef.current?.click()}
        disabled={bulkLoading}
        className="w-full flex items-center justify-center gap-2 btn-power disabled:opacity-60"
      >
        {bulkLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <ImagePlus className="w-5 h-5" />
        )}
        {bulkLoading ? "사진 압축 중…" : `갤러리에서 사진 여러장 추가 (최대 ${MAX_BULK_PHOTOS}장)`}
      </button>
      <input
        ref={bulkFileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleBulkUpload}
      />

      {sections.length === 0 && (
        <div className="glass-card p-6 text-center space-y-2">
          <div className="icon-chip icon-chip-lg mx-auto">
            <Sparkles color="#AB5EBE" size={22} />
          </div>
          <p className="text-sm font-semibold text-foreground">아직 작성된 글이 없어요</p>
          <p className="text-xs text-muted-foreground">
            위 버튼으로 <strong>사진 여러장 한번에 추가</strong>하거나,{" "}
            <strong>+ 글쓰기 추가</strong>로 수동 작성해 주세요
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
        <Plus className="w-4 h-4" /> 글쓰기 추가
      </button>

      <button
        onClick={onSave}
        disabled={!canSave || saving}
        className="btn-power w-full disabled:opacity-50 mt-1"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
        {saving ? "저장 중..." : "저장하기"}
      </button>
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
    reader.onload = async (ev) => {
      const raw = (ev.target?.result as string) || "";
      if (!raw) return;
      try {
        // localStorage/Supabase 용량 보호를 위해 800px · JPEG 70%로 압축
        const compressed = await compressImage(raw, 800, 0.7);
        onUpdate({
          photo: {
            id: crypto.randomUUID(),
            dataUrl: compressed,
          },
        });
      } catch {
        // 압축 실패 시 원본 그대로 사용
        onUpdate({
          photo: {
            id: crypto.randomUUID(),
            dataUrl: raw,
          },
        });
      }
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

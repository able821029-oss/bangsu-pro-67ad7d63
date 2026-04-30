import type { StateCreator } from "zustand";
import type { AppState, BlogDraft, DraftSection } from "../appStore";
import { MAX_DRAFTS, createEmptyDraft } from "../appStore";

export interface DraftSlice {
  drafts: BlogDraft[];
  activeDraftIdx: number;

  addDraft: () => void;
  removeDraft: (idx: number) => void;
  setActiveDraft: (idx: number) => void;
  updateDraft: (idx: number, patch: Partial<BlogDraft>) => void;
  addSection: (draftIdx: number) => void;
  /** 특정 섹션 바로 아래에 빈 섹션 1개 삽입 (블록별 + 버튼용) */
  insertSectionAfter: (draftIdx: number, sectionId: string) => void;
  /**
   * 여러 장의 사진을 한 번에 섹션에 추가 (갤러리 다중 선택용).
   * - 빈 사진 섹션이 있으면 먼저 채움
   * - 남은 사진은 새 섹션으로 추가
   * - 반환값은 추가/채운 실제 건수
   */
  addPhotosAsSections: (
    draftIdx: number,
    photos: { id: string; dataUrl: string }[],
  ) => number;
  updateSection: (
    draftIdx: number,
    sectionId: string,
    patch: Partial<DraftSection>,
  ) => void;
  removeSection: (draftIdx: number, sectionId: string) => void;
  resetDraft: (idx: number) => void;
}

export const createDraftSlice: StateCreator<
  AppState,
  [["zustand/persist", unknown]],
  [],
  DraftSlice
> = (set) => ({
  drafts: [createEmptyDraft()],
  activeDraftIdx: 0,

  addDraft: () =>
    set((state) => {
      if (state.drafts.length >= MAX_DRAFTS) return {};
      const next = [...state.drafts, createEmptyDraft()];
      return { drafts: next, activeDraftIdx: next.length - 1 };
    }),
  removeDraft: (idx) =>
    set((state) => {
      if (state.drafts.length <= 1) {
        // 최소 1개는 유지 — 마지막 1개 삭제 시도는 초기화로 처리
        return { drafts: [createEmptyDraft()], activeDraftIdx: 0 };
      }
      const next = state.drafts.filter((_, i) => i !== idx);
      const newActive = Math.min(state.activeDraftIdx, next.length - 1);
      return { drafts: next, activeDraftIdx: newActive };
    }),
  setActiveDraft: (idx) =>
    set((state) => {
      if (idx < 0 || idx >= state.drafts.length) return {};
      return { activeDraftIdx: idx };
    }),
  updateDraft: (idx, patch) =>
    set((state) => ({
      drafts: state.drafts.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    })),
  addSection: (draftIdx) =>
    set((state) => ({
      drafts: state.drafts.map((d, i) =>
        i === draftIdx
          ? {
              ...d,
              sections: [
                ...d.sections,
                { id: crypto.randomUUID(), subtitle: "", photo: null, text: "" },
              ],
            }
          : d,
      ),
    })),
  insertSectionAfter: (draftIdx, sectionId) =>
    set((state) => ({
      drafts: state.drafts.map((d, i) => {
        if (i !== draftIdx) return d;
        const idx = d.sections.findIndex((s) => s.id === sectionId);
        const empty = { id: crypto.randomUUID(), subtitle: "", photo: null, text: "" };
        if (idx === -1) return { ...d, sections: [...d.sections, empty] };
        const next = [...d.sections];
        next.splice(idx + 1, 0, empty);
        return { ...d, sections: next };
      }),
    })),
  addPhotosAsSections: (draftIdx, photos) => {
    let placed = 0;
    set((state) => {
      const drafts = state.drafts.map((d, i) => {
        if (i !== draftIdx) return d;
        const queue = [...photos];
        // 1) 빈 사진 슬롯이 있는 기존 섹션부터 채움
        const updatedSections = d.sections.map((s) => {
          if (!s.photo && queue.length > 0) {
            const next = queue.shift()!;
            placed += 1;
            return { ...s, photo: next };
          }
          return s;
        });
        // 2) 남은 사진은 새 섹션으로 생성
        while (queue.length > 0) {
          const next = queue.shift()!;
          updatedSections.push({
            id: crypto.randomUUID(),
            subtitle: "",
            photo: next,
            text: "",
          });
          placed += 1;
        }
        return { ...d, sections: updatedSections };
      });
      return { drafts };
    });
    return placed;
  },
  updateSection: (draftIdx, sectionId, patch) =>
    set((state) => ({
      drafts: state.drafts.map((d, i) =>
        i === draftIdx
          ? {
              ...d,
              sections: d.sections.map((s) =>
                s.id === sectionId ? { ...s, ...patch } : s,
              ),
            }
          : d,
      ),
    })),
  removeSection: (draftIdx, sectionId) =>
    set((state) => ({
      drafts: state.drafts.map((d, i) =>
        i === draftIdx
          ? { ...d, sections: d.sections.filter((s) => s.id !== sectionId) }
          : d,
      ),
    })),
  resetDraft: (idx) =>
    set((state) => ({
      drafts: state.drafts.map((d, i) => (i === idx ? createEmptyDraft() : d)),
    })),
});

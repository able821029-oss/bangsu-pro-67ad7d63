/**
 * 저장 시점 글 품질 방어선
 * - 제목이 너무 짧으면 현장 정보로 보강
 * - 해시태그 비어있으면 기본 세트 생성
 * - 본문 섹션 최소 기준 검증
 *
 * BlogWriterTab(직접 글쓰기)과 CameraTab(AI 글쓰기) 저장 로직에서 공통 사용.
 */

interface SafeTitleCtx {
  title: string;
  location?: string;
  siteMethod?: string;
  detectedWorkType?: string;
}

const MIN_TITLE_LEN = 8;

/**
 * 제목이 8자 미만이면 `지역 · 공법 · 본제목` 형태로 보강.
 * - "방수공사" → "부산 금정구 우레탄 방수공사"
 * - "" → "현장 시공 완료"
 */
export function buildSafeTitle(ctx: SafeTitleCtx): string {
  const raw = (ctx.title || "").trim();
  if (raw.length >= MIN_TITLE_LEN) return raw;

  const parts = [
    ctx.location?.trim(),
    ctx.siteMethod?.trim(),
    raw || ctx.detectedWorkType || "시공 완료",
  ].filter((v): v is string => Boolean(v && v.length));

  const combined = parts.join(" ").trim();
  return combined.length >= MIN_TITLE_LEN ? combined : "현장 시공 완료";
}

/**
 * 해시태그 비어있을 때 지역·공법 기반 기본 세트 생성.
 * 네이버 SEO 최소 요건(5개 이상) 충족.
 */
export function buildDefaultHashtags(ctx: {
  location?: string;
  siteMethod?: string;
  detectedWorkType?: string;
  companyName?: string;
}): string[] {
  const tags = new Set<string>();
  const loc = ctx.location?.replace(/\s/g, "");
  const type = ctx.detectedWorkType || "시공";

  if (loc) {
    tags.add(`${loc}시공`);
    tags.add(`${loc}${type}`);
  }
  tags.add(type);
  tags.add(`${type}업체`);
  tags.add(`${type}후기`);
  tags.add("시공업체추천");
  tags.add("시공완료");
  if (ctx.siteMethod) tags.add(ctx.siteMethod.replace(/\s/g, ""));
  if (ctx.companyName) tags.add(ctx.companyName.replace(/\s/g, ""));

  return Array.from(tags).slice(0, 10);
}

/**
 * 해시태그 정규화 — 선두 `#`·`＃` 전부 제거, 공백·빈 태그 제거, 중복 제거.
 *
 * 렌더링 시 `#{tag}` 접두사를 붙이는 구조이므로 저장된 태그에 `#`이 이미 붙어 있으면
 * UI에 `##태그`로 나옴. AI 응답이 `#호원1동방수`처럼 prefix 포함해 반환하는 케이스
 * 방어용으로 저장 직전 모든 흐름에서 호출한다.
 */
export function normalizeHashtags(raw: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    if (!r) continue;
    const t = String(r).replace(/^[#＃\s]+/u, "").trim().replace(/\s+/g, "");
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * 저장 가능한 최소 품질 기준.
 * - 제목이 있고(짧아도 buildSafeTitle이 보강)
 * - 섹션 중 하나 이상이 (소제목+글) 또는 사진을 가짐
 *   "현장 정보"만 있는 부실 글(= 사용자 섹션 0개) 저장 방지
 */
export function hasMinimumContent(sections: Array<{ subtitle: string; text: string; photo: unknown }>): boolean {
  return sections.some(
    (s) =>
      (s.subtitle.trim().length > 0 && s.text.trim().length > 0) ||
      Boolean(s.photo),
  );
}

import { supabase } from "@/integrations/supabase/client";

export interface GenerateSectionParams {
  subtitle: string;
  photoDataUrl?: string;
  location?: string;
  siteMethod?: string;
  siteArea?: string;
  mode: "expert" | "vlog";
}

export interface GenerateSectionResult {
  text: string;
  isMock?: boolean;
  error?: string;
}

/**
 * 섹션 한 개의 짧은 본문을 AI로 생성한다 (5줄 내외).
 * - generate-section Edge Function 호출
 * - 호출 실패 시 { text:"", error } 반환 (호출부가 toast로 알림)
 */
export async function generateSection(params: GenerateSectionParams): Promise<GenerateSectionResult> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-section", {
      body: params,
    });
    if (error) {
      return { text: "", error: error.message || "AI 호출 실패" };
    }
    if (!data || typeof data !== "object") {
      return { text: "", error: "응답 형식이 올바르지 않습니다" };
    }
    return {
      text: typeof data.text === "string" ? data.text : "",
      isMock: !!data.isMock,
      error: typeof data.error === "string" ? data.error : undefined,
    };
  } catch (e) {
    return { text: "", error: e instanceof Error ? e.message : "알 수 없는 오류" };
  }
}

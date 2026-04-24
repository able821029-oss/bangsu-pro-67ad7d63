import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { useAppStore, BlogPost, ContentBlock, Platform, Persona, PostStatus } from "@/stores/appStore";
import { isDevModeActive, disableDevMode, DEV_USER } from "@/lib/devAuth";
import { isTableKnownMissing, markTableMissing, isTableMissingError } from "@/lib/tableFlags";
import { migratePostPhotos } from "@/lib/migratePostPhotos";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/** 로그인한 사용자가 DB에 저장한 글을 Zustand 스토어로 병합. 로컬에만 있는 글은 보존. */
async function loadPostsIntoStore(userId: string) {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(
        "id, title, blocks, hashtags, photos, work_type, style, persona, platforms, status, location, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[Auth] posts load error:", error.message);
      return;
    }
    if (!data || data.length === 0) return;

    const state = useAppStore.getState();
    const existingIds = new Set(state.posts.map((p) => p.id));

    // DB 기준으로 새 글만 병합 (기존 로컬 글과 ID 충돌 방지)
    const merged: BlogPost[] = [...state.posts];
    for (const row of data) {
      if (existingIds.has(row.id)) continue;
      merged.push({
        id: row.id,
        title: row.title ?? "",
        photos: Array.isArray(row.photos)
          ? (row.photos as Array<{ id?: string; url?: string; dataUrl?: string }>).map((p) => ({
              id: p?.id ?? crypto.randomUUID(),
              ...(p?.url ? { url: p.url } : {}),
              ...(p?.dataUrl ? { dataUrl: p.dataUrl } : {}),
            }))
          : [],
        workType: (row.work_type ?? "기타") as BlogPost["workType"],
        style: (row.style ?? "시공일지형") as BlogPost["style"],
        blocks: Array.isArray(row.blocks) ? (row.blocks as unknown as ContentBlock[]) : [],
        hashtags: Array.isArray(row.hashtags) ? (row.hashtags as string[]) : [],
        status: (row.status ?? "완료") as PostStatus,
        createdAt: row.created_at ? String(row.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
        platforms: Array.isArray(row.platforms) ? (row.platforms as Platform[]) : ["naver"],
        persona: (row.persona ?? "장인형") as Persona,
        location: row.location ?? undefined,
      });
    }

    // 최신순 정렬 유지
    merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    useAppStore.setState({ posts: merged });
  } catch (e) {
    console.warn("[Auth] loadPostsIntoStore error:", e);
  }
}

/** 쇼츠 영상 보관함을 DB에서 스토어로 로드 */
async function loadShortsVideosIntoStore(userId: string) {
  // 테이블 없음이 이미 확인된 세션이면 네트워크 호출 자체를 skip
  // → 브라우저 콘솔의 'Failed to load resource 404' 반복 노출 방지
  if (isTableKnownMissing("shorts_videos")) return;

  try {
    const { data, error } = await supabase
      .from("shorts_videos")
      .select("id, title, video_url, thumbnail_data_url, video_style, voice_id, bgm_type, scenes_preview, photo_count, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      if (isTableMissingError(error as { message?: string; code?: string })) {
        // 24시간 동안 이 테이블 호출 전체 차단
        markTableMissing("shorts_videos");
        return;
      }
      console.warn("[Auth] shorts_videos load error:", error.message);
      return;
    }
    if (!data || data.length === 0) return;

    useAppStore.getState().setShortsVideos(
      data.map((row) => ({
        id: row.id,
        title: row.title ?? "무제 쇼츠",
        videoUrl: row.video_url ?? "",
        thumbnailDataUrl: row.thumbnail_data_url ?? undefined,
        videoStyle: row.video_style ?? undefined,
        voiceId: row.voice_id ?? undefined,
        bgmType: row.bgm_type ?? undefined,
        scenesPreview: Array.isArray(row.scenes_preview) ? row.scenes_preview as string[] : undefined,
        photoCount: row.photo_count ?? 0,
        createdAt: row.created_at ?? new Date().toISOString(),
      })),
    );
  } catch (e) {
    console.warn("[Auth] loadShortsVideosIntoStore error:", e);
  }
}

/** 로그인한 사용자의 업체정보를 DB에서 로드하여 Zustand 스토어에 주입 */
async function loadProfileIntoStore(userId: string) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "company_name, phone_number, service_area, company_description, logo_url, face_photo_url"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[Auth] profile load error:", error.message);
      return;
    }
    if (!data) return;

    // 빈 문자열은 기존 로컬 값을 덮어쓰지 않음 (사용자가 로컬에서 먼저 입력한 경우 보존)
    const updateSettings = useAppStore.getState().updateSettings;
    const patch: Record<string, string> = {};
    if (data.company_name) patch.companyName = data.company_name;
    if (data.phone_number) patch.phoneNumber = data.phone_number;
    if (data.service_area) patch.serviceArea = data.service_area;
    if (data.company_description) patch.companyDescription = data.company_description;
    if (data.logo_url) patch.logoUrl = data.logo_url;
    if (data.face_photo_url) patch.facePhotoUrl = data.face_photo_url;

    if (Object.keys(patch).length > 0) {
      updateSettings(patch);
    }
  } catch (e) {
    console.warn("[Auth] loadProfileIntoStore error:", e);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Dev 테스트 모드 — localhost에서만 작동. 가짜 세션 주입 후 Supabase는 건너뜀.
    if (isDevModeActive()) {
      setUser(DEV_USER as unknown as User);
      setSession({ user: DEV_USER, access_token: "dev-token" } as unknown as Session);
      setLoading(false);
      return;
    }

    // URL hash에 에러 콜백이 남아있으면 제거 (OAuth 실패 시)
    if (window.location.hash.includes("error")) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // 로그인 성공 시 DB에서 업체정보 + 저장된 글 로드
      if (event === "SIGNED_IN" && session?.user) {
        const uid = session.user.id;
        loadProfileIntoStore(uid);
        // posts 로드 후 레거시 dataUrl 사진을 Storage로 백그라운드 마이그레이션
        loadPostsIntoStore(uid).then(() => {
          void migratePostPhotos(uid);
        });
        loadShortsVideosIntoStore(uid);
      }
    });

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn("[Auth] getSession error:", error.message);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // 이미 로그인된 세션이 있으면 프로필 + 글 로드
      if (session?.user) {
        const uid = session.user.id;
        loadProfileIntoStore(uid);
        loadPostsIntoStore(uid).then(() => {
          void migratePostPhotos(uid);
        });
        loadShortsVideosIntoStore(uid);
      }
    }).catch(() => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Dev 모드였으면 플래그 해제
    if (isDevModeActive()) {
      disableDevMode();
      setUser(null);
      setSession(null);
      try { localStorage.removeItem("sms-app-store"); } catch { /* ignore */ }
      return;
    }
    await supabase.auth.signOut();
    // 로그아웃 시 로컬 영속화 데이터 정리 (다른 사용자 보호)
    try {
      localStorage.removeItem("sms-app-store");
    } catch (e) {
      console.warn("[Auth] localStorage clear error:", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

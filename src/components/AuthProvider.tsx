import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { useAppStore, type BusinessCategory } from "@/stores/appStore";

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

/** 로그인한 사용자의 업체정보를 DB에서 로드하여 Zustand 스토어에 주입 */
async function loadProfileIntoStore(userId: string) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "company_name, phone_number, service_area, business_category, company_description, logo_url, face_photo_url"
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
    if (data.business_category) patch.businessCategory = data.business_category;
    if (data.company_description) patch.companyDescription = data.company_description;
    if (data.logo_url) patch.logoUrl = data.logo_url;
    if (data.face_photo_url) patch.facePhotoUrl = data.face_photo_url;

    if (Object.keys(patch).length > 0) {
      updateSettings(patch as Partial<{ businessCategory: BusinessCategory }>);
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
    // URL hash에 에러 콜백이 남아있으면 제거 (OAuth 실패 시)
    if (window.location.hash.includes("error")) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // 로그인 성공 시 DB에서 업체정보 로드
      if (event === "SIGNED_IN" && session?.user) {
        loadProfileIntoStore(session.user.id);
      }
    });

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn("[Auth] getSession error:", error.message);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // 이미 로그인된 세션이 있으면 프로필 로드
      if (session?.user) {
        loadProfileIntoStore(session.user.id);
      }
    }).catch(() => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
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

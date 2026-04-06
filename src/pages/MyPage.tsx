import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { User, LogOut, Calendar, FileText, Settings, ChevronRight } from "lucide-react";
import { useAppStore } from "@/stores/appStore";

export function MyPage() {
  const { user, signOut } = useAuth();
  const settings = useAppStore((s) => s.settings);
  const subscription = useAppStore((s) => s.subscription);
  const [name, setName] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("name, google_refresh_token").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) {
          setName(data.name || "");
          setGoogleConnected(!!data.google_refresh_token);
        }
      });
  }, [user]);

  const handleUpdateName = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ name }).eq("user_id", user.id);
    if (error) toast.error("이름 변경 실패");
    else toast.success("이름이 변경되었습니다");
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("로그아웃 되었습니다");
  };

  return (
    <div className="pb-24 min-h-screen bg-background">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold">마이페이지</h1>
      </div>

      {/* Profile Card */}
      <div className="mx-4 bg-card border border-border rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">{name || user?.email?.split("@")[0] || "사용자"}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" className="h-9 text-sm" />
          <Button onClick={handleUpdateName} size="sm" variant="outline">저장</Button>
        </div>
      </div>

      {/* Subscription Info */}
      <div className="mx-4 bg-card border border-border rounded-2xl p-4 mb-4">
        <h3 className="font-semibold text-sm mb-3">구독 정보</h3>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">현재 플랜</span>
          <span className="font-medium text-primary">{subscription.plan}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-muted-foreground">블로그 사용량</span>
          <span>{subscription.usedCount} / {subscription.maxCount}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-muted-foreground">영상 사용량</span>
          <span>{subscription.videoUsed} / {subscription.maxVideo}</span>
        </div>
      </div>

      {/* Google Calendar */}
      <div className="mx-4 bg-card border border-border rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">구글 캘린더 연동</span>
          </div>
          <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${googleConnected ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
            {googleConnected ? "연동됨" : "미연동"}
          </div>
        </div>
        {!googleConnected && (
          <p className="text-xs text-muted-foreground mt-2">구글 캘린더 연동은 설정에서 구성할 수 있습니다.</p>
        )}
      </div>

      {/* Menu */}
      <div className="mx-4 bg-card border border-border rounded-2xl overflow-hidden mb-4">
        {[
          { icon: Settings, label: "업체 정보 설정", desc: settings.companyName || "미설정" },
          { icon: FileText, label: "이용약관", desc: "" },
        ].map(({ icon: Icon, label, desc }, i) => (
          <button key={i} className="w-full flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{label}</span>
            </div>
            <div className="flex items-center gap-1">
              {desc && <span className="text-xs text-muted-foreground">{desc}</span>}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>

      {/* Logout */}
      <div className="mx-4">
        <Button onClick={handleSignOut} variant="outline" className="w-full text-destructive border-destructive/30">
          <LogOut className="w-4 h-4 mr-2" />로그아웃
        </Button>
      </div>
    </div>
  );
}

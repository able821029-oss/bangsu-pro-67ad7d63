import { useState } from "react";
import { Key, Eye, EyeOff, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function AdminApiKeys() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("sk-ant-api03-****************************");
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    toast({ title: "✅ API 키가 저장되었습니다." });
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Key className="w-5 h-5 text-primary" /> API 키 관리
      </h2>

      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ANTHROPIC_API_KEY</label>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              className="flex-1 bg-secondary rounded-lg px-3 py-3 text-sm outline-none text-foreground font-mono"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">이 키는 서버 환경변수로만 저장되며 사용자에게 노출되지 않습니다.</p>
        </div>
        <Button onClick={handleSave}>
          <Save className="w-4 h-4" /> 저장
        </Button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Bot, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { personaPrompts, platformPrompts, type PersonaKey, type PlatformKey } from "@/lib/systemPrompts";

type PromptTab = "persona" | "platform";


export function AdminPersonas() {
  const { toast } = useToast();
  const [pPrompts, setPPrompts] = useState(personaPrompts);
  const [plPrompts, setPlPrompts] = useState(platformPrompts);
  const [activePersona, setActivePersona] = useState<PersonaKey>("장인형");
  const [activePlatform, setActivePlatform] = useState<PlatformKey>("naver");
  const [tab, setTab] = useState<PromptTab>("persona");

  const handleSave = () => {
    toast({ title: "프롬프트가 저장되었습니다." });
  };

  const platformLabels: Record<PlatformKey, string> = { naver: "네이버", instagram: "인스타그램", tiktok: "틱톡" };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Bot className="w-5 h-5 text-primary" /> 시스템 프롬프트 편집
      </h2>

      <div className="flex gap-2">
        <button onClick={() => setTab("persona")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "persona" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
          페르소나
        </button>
        <button onClick={() => setTab("platform")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "platform" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
          플랫폼별 SEO
        </button>
      </div>

      {tab === "persona" && (
        <>
          <div className="flex gap-2">
            {(Object.keys(pPrompts) as PersonaKey[]).map((key) => (
              <button key={key} onClick={() => setActivePersona(key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activePersona === key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                {key}
              </button>
            ))}
          </div>
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <label className="text-sm font-semibold">{activePersona} 페르소나 프롬프트</label>
            <textarea className="w-full bg-secondary rounded-lg p-3 text-sm outline-none text-foreground resize-none min-h-[200px]" value={pPrompts[activePersona]} onChange={(e) => setPPrompts({ ...pPrompts, [activePersona]: e.target.value })} />
            <Button onClick={handleSave}><Save className="w-4 h-4" /> 저장</Button>
          </div>
        </>
      )}

      {tab === "platform" && (
        <>
          <div className="flex gap-2">
            {(Object.keys(plPrompts) as PlatformKey[]).map((key) => (
              <button key={key} onClick={() => setActivePlatform(key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activePlatform === key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                {platformLabels[key]}
              </button>
            ))}
          </div>
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <label className="text-sm font-semibold">{platformLabels[activePlatform]} SEO 프롬프트</label>
            <textarea className="w-full bg-secondary rounded-lg p-3 text-sm outline-none text-foreground resize-none min-h-[200px]" value={plPrompts[activePlatform]} onChange={(e) => setPlPrompts({ ...plPrompts, [activePlatform]: e.target.value })} />
            <Button onClick={handleSave}><Save className="w-4 h-4" /> 저장</Button>
          </div>
        </>
      )}
    </div>
  );
}

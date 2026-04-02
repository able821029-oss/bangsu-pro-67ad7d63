import { useState } from "react";
import { Bot, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { personaPrompts, platformPrompts, type PersonaKey, type PlatformKey } from "@/lib/systemPrompts";

type PromptTab = "persona" | "platform";


export function AdminPersonas() {
  const { toast } = useToast();
  const [prompts, setPrompts] = useState(defaultPrompts);
  const [activePersona, setActivePersona] = useState<PersonaKey>("장인형");

  const handleSave = () => {
    toast({ title: "✅ 페르소나 프롬프트가 저장되었습니다." });
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Bot className="w-5 h-5 text-primary" /> 페르소나 프롬프트 편집
      </h2>

      <div className="flex gap-2">
        {(Object.keys(prompts) as PersonaKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setActivePersona(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activePersona === key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <label className="text-sm font-semibold">{activePersona} 시스템 프롬프트</label>
        <textarea
          className="w-full bg-secondary rounded-lg p-3 text-sm outline-none text-foreground resize-none min-h-[200px]"
          value={prompts[activePersona]}
          onChange={(e) => setPrompts({ ...prompts, [activePersona]: e.target.value })}
        />
        <Button onClick={handleSave}>
          <Save className="w-4 h-4" /> 저장
        </Button>
      </div>
    </div>
  );
}

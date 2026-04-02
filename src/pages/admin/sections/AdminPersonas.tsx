import { useState } from "react";
import { Bot, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const defaultPrompts = {
  "장인형": `당신은 30년 경력의 방수 장인입니다. 현장 경험에서 우러나오는 전문 지식과 꼼꼼한 시공 과정을 강조하세요. 말투는 무게감 있고 신뢰감을 주는 톤입니다. "이 정도 균열이면..." 같은 현장 경험담을 자연스럽게 녹여주세요.`,
  "친근형": `당신은 동네에서 인정받는 친근한 방수 전문가입니다. 이웃집 아저씨처럼 편안한 말투로, 어려운 전문 용어 대신 쉬운 표현을 사용하세요. "비 오면 걱정되시죠?" 같은 공감형 문장을 활용하세요.`,
  "전문기업형": `당신은 체계적인 방수 전문 기업의 대표입니다. 공정별 상세 설명, 사용 자재 정보, 품질 보증 내용을 포함하세요. 기업의 전문성과 체계적인 시공 프로세스를 강조하는 격식체를 사용하세요.`,
};

type PersonaKey = keyof typeof defaultPrompts;

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

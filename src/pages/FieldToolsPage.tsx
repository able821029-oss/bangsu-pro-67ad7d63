import { useState, useEffect } from "react";
import {
  ArrowLeft, Calculator, CloudRain, AlertTriangle,
  Sun, Cloud, CloudDrizzle, Zap, CheckCircle2, Phone, ExternalLink, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type ToolTab = "calc" | "weather" | "report";

// ── 일당 계산기 ──
function WageCalculator() {
  const [hours, setHours] = useState(8);
  const [overtime, setOvertime] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(15000);
  const [showDetail, setShowDetail] = useState(false);

  const basePay = hours * hourlyRate;
  const overtimePay = Math.round(overtime * hourlyRate * 1.5);
  const totalBefore = basePay + overtimePay;

  // 일용직 소득세: 일당 15만원 초과분의 2.7% (고용보험 0.9% 별도)
  const taxBase = Math.max(0, totalBefore - 150000);
  const incomeTax = Math.round(taxBase * 0.027);
  const localTax = Math.round(incomeTax * 0.1);
  const empInsurance = Math.round(totalBefore * 0.009);
  const totalDeduct = incomeTax + localTax + empInsurance;
  const takehome = totalBefore - totalDeduct;

  // 월 환산 (22일 기준)
  const monthlyEst = takehome * 22;

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <p className="text-sm font-semibold">근무 조건</p>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs text-muted-foreground">시급</label>
            <span className="text-sm font-semibold">{hourlyRate.toLocaleString()}원</span>
          </div>
          <input type="range" min="10000" max="40000" step="500"
            value={hourlyRate} onChange={e => setHourlyRate(+e.target.value)}
            className="w-full" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>1만원</span><span>최저{(9860).toLocaleString()}원</span><span>4만원</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">기본 근무시간</label>
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
              <button onClick={() => setHours(Math.max(1, hours - 1))} className="text-primary font-bold text-lg w-6">-</button>
              <span className="flex-1 text-center text-sm font-semibold">{hours}시간</span>
              <button onClick={() => setHours(Math.min(24, hours + 1))} className="text-primary font-bold text-lg w-6">+</button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">연장 근무시간</label>
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
              <button onClick={() => setOvertime(Math.max(0, overtime - 0.5))} className="text-primary font-bold text-lg w-6">-</button>
              <span className="flex-1 text-center text-sm font-semibold">{overtime}시간</span>
              <button onClick={() => setOvertime(Math.min(8, overtime + 0.5))} className="text-primary font-bold text-lg w-6">+</button>
            </div>
          </div>
        </div>
      </div>

      {/* 계산 결과 */}
      <div className="rounded-2xl overflow-hidden border border-border">
        <div className="p-4 space-y-2" style={{ background: "linear-gradient(135deg, rgba(35,127,255,0.1), rgba(171,94,190,0.08))" }}>
          <p className="text-xs text-muted-foreground">오늘 실수령액</p>
          <p className="text-4xl font-black" style={{ color: "#237FFF" }}>
            {takehome.toLocaleString()}<span className="text-lg font-semibold ml-1">원</span>
          </p>
          <p className="text-xs text-muted-foreground">월 환산 약 {Math.round(monthlyEst / 10000)}만원 (22일 기준)</p>
        </div>

        <button onClick={() => setShowDetail(!showDetail)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs text-muted-foreground border-t border-border hover:bg-secondary/50 transition-colors">
          <span>공제 내역 보기</span>
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showDetail ? "rotate-90" : ""}`} />
        </button>

        {showDetail && (
          <div className="border-t border-border px-4 py-3 space-y-1.5 bg-secondary/30">
            <Row label="기본급" value={basePay} />
            {overtime > 0 && <Row label={`연장수당 (×1.5)`} value={overtimePay} plus />}
            <div className="border-t border-border pt-1.5 mt-1.5">
              <Row label="세전 합계" value={totalBefore} />
              <Row label="소득세 (2.7%)" value={incomeTax} minus />
              <Row label="지방소득세 (0.27%)" value={localTax} minus />
              <Row label="고용보험 (0.9%)" value={empInsurance} minus />
            </div>
            <div className="border-t border-border pt-1.5 mt-1.5">
              <Row label="공제 합계" value={totalDeduct} minus />
              <Row label="실수령액" value={takehome} bold />
            </div>
          </div>
        )}
      </div>

      {/* 퇴직금 안내 */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-1.5">
        <p className="text-sm font-semibold text-amber-600">💡 퇴직금도 받을 수 있어요</p>
        <p className="text-xs text-muted-foreground">
          같은 사업장에서 1년 이상, 주 15시간 이상 근무하면<br/>
          일용직도 퇴직금 청구 가능합니다.
        </p>
        <button onClick={() => window.open("https://www.moel.go.kr/", "_blank")}
          className="text-xs text-amber-600 font-semibold flex items-center gap-1">
          고용노동부 퇴직금 계산기 <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, plus, minus, bold }: { label: string; value: number; plus?: boolean; minus?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-${bold ? "bold" : "medium"} ${minus ? "text-red-500" : plus ? "text-green-500" : ""}`}>
        {minus ? "-" : plus ? "+" : ""}{value.toLocaleString()}원
      </span>
    </div>
  );
}

// ── 날씨 현장 판단 ──
function WeatherAlert() {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");

  const fetchWeather = async (lat: number, lon: number) => {
    setLoading(true);
    setError("");
    try {
      // Open-Meteo 무료 API (API키 불필요)
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_probability_max,weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max&timezone=Asia%2FSeoul&forecast_days=3`
      );
      const data = await res.json();
      setWeather(data.daily);
    } catch {
      setError("날씨 정보를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        // 역지오코딩
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`);
          const data = await res.json();
          const addr = data.address;
          setLocation(addr?.suburb || addr?.city_district || addr?.city || "현재 위치");
        } catch {}
        fetchWeather(lat, lon);
      },
      () => { setLoading(false); setError("위치 권한을 허용해 주세요"); },
      { timeout: 8000 }
    );
  };

  // WMO 날씨 코드 → 현장 판단
  const getWorkability = (wcode: number, rain: number, wind: number) => {
    if (rain >= 70 || [51,53,55,61,63,65,71,73,75,77,80,81,82,95,96,99].includes(wcode)) {
      return { ok: false, icon: "🌧️", label: "현장 취소 권고", color: "#EF4444", desc: `강수확률 ${rain}% — 외부 작업 위험` };
    }
    if (rain >= 40 || wind >= 40) {
      return { ok: null, icon: "⚠️", label: "확인 필요", color: "#F97316", desc: `강수확률 ${rain}% — 사장님께 확인하세요` };
    }
    return { ok: true, icon: "☀️", label: "현장 정상", color: "#22C55E", desc: `강수확률 ${rain}% — 작업 가능합니다` };
  };

  const dayNames = ["오늘", "내일", "모레"];
  const wmoCodes: Record<number, string> = {
    0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림",
    45: "안개", 48: "안개",
    51: "이슬비", 53: "이슬비", 55: "이슬비",
    61: "비", 63: "비", 65: "강한 비",
    71: "눈", 73: "눈", 75: "강한 눈",
    80: "소나기", 81: "소나기", 82: "강한 소나기",
    95: "뇌우", 96: "뇌우", 99: "강한 뇌우",
  };

  return (
    <div className="space-y-4">
      {!weather ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <div className="text-5xl">🌤️</div>
          <div>
            <p className="font-semibold text-sm">현장 날씨 확인</p>
            <p className="text-xs text-muted-foreground mt-1">내 위치의 3일 날씨로 현장 출근 여부를 판단해 드립니다</p>
          </div>
          <Button className="w-full" onClick={getCurrentLocation} disabled={loading}>
            {loading ? "위치 확인 중..." : "📍 내 위치로 확인하기"}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{location || "현재 위치"} 날씨</p>
            <button onClick={() => { setWeather(null); setLocation(""); }}
              className="text-xs text-primary">다시 확인</button>
          </div>

          {dayNames.map((day, i) => {
            const wcode = weather.weathercode?.[i] ?? 0;
            const rain = weather.precipitation_probability_max?.[i] ?? 0;
            const wind = weather.windspeed_10m_max?.[i] ?? 0;
            const tMax = Math.round(weather.temperature_2m_max?.[i] ?? 0);
            const tMin = Math.round(weather.temperature_2m_min?.[i] ?? 0);
            const w = getWorkability(wcode, rain, wind);

            return (
              <div key={i} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{day}</p>
                    <p className="text-xs text-muted-foreground">{wmoCodes[wcode] || "날씨 정보"} · {tMin}~{tMax}°C</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl">{w.icon}</p>
                  </div>
                </div>
                <div className="rounded-xl px-3 py-2" style={{ background: `${w.color}18`, border: `1px solid ${w.color}40` }}>
                  <p className="text-sm font-semibold" style={{ color: w.color }}>{w.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: w.color }}>{w.desc}</p>
                </div>
              </div>
            );
          })}

          <div className="bg-secondary/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">
              💡 사장님께서 현장 취소 시 SMS 앱으로 인부들에게 알림을 보낼 수 있습니다
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 임금체불 신고 가이드 ──
function WageReport() {
  const [step, setStep] = useState(0);
  const [daysUnpaid, setDaysUnpaid] = useState(0);
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "복사되었습니다" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "복사 실패", variant: "destructive" });
    }
  };

  const noticeText = `임금 지급 요청서

수신: 사업주
발신: 근로자

본인은 귀 사업장에서 ${daysUnpaid}일간 근무하였으나 임금 ${amount}원을 지급받지 못하였습니다.

근로기준법 제43조에 따라 임금은 매월 1회 이상 일정한 기일에 지급하여야 합니다.

이에 본 내용증명을 통해 미지급 임금 ${amount}원의 즉시 지급을 요청하며, 이에 응하지 않을 경우 고용노동부에 임금체불로 신고할 것임을 알려드립니다.

작성일: ${new Date().toLocaleDateString("ko-KR")}`;

  const steps = [
    {
      icon: "📋",
      title: "1단계 — 증거 수집",
      content: (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">아래 자료를 미리 모아두세요</p>
          {[
            "카카오톡 / 문자 메시지 (일한다고 한 대화)",
            "통장 입금 내역 (일부라도 받은 경우)",
            "사진 / 현장 인증 자료",
            "목격자 연락처",
            "근로계약서 (없어도 신고 가능)",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p>{item}</p>
            </div>
          ))}
        </div>
      )
    },
    {
      icon: "✍️",
      title: "2단계 — 내용증명 발송",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">사장님께 공식 요청서를 보냅니다</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">미지급 일수</label>
              <input type="number" value={daysUnpaid || ""}
                onChange={e => setDaysUnpaid(+e.target.value)}
                placeholder="예) 5"
                className="w-full mt-1 bg-secondary rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">미지급 금액 (원)</label>
              <input type="number" value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="예) 450000"
                className="w-full mt-1 bg-secondary rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {noticeText.slice(0, 200)}...
          </div>
          <Button className="w-full gap-2" onClick={() => handleCopy(noticeText)}>
            {copied ? <CheckCircle2 className="w-4 h-4" /> : null}
            {copied ? "복사됨!" : "내용증명 전체 복사"}
          </Button>
        </div>
      )
    },
    {
      icon: "📞",
      title: "3단계 — 고용노동부 신고",
      content: (
        <div className="space-y-3 text-sm">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <p className="font-semibold text-red-600">임금체불은 형사처벌 대상입니다</p>
            <p className="text-xs text-muted-foreground mt-1">3년 이하 징역 또는 3천만원 이하 벌금</p>
          </div>
          {[
            { label: "고용노동부 상담전화", value: "1350", icon: "📞", action: () => window.location.href = "tel:1350" },
            { label: "온라인 신고 (e-노동OK)", value: "minwon.moel.go.kr", icon: "🌐", action: () => window.open("https://minwon.moel.go.kr", "_blank") },
            { label: "카카오톡 채널", value: "고용노동부 검색", icon: "💬", action: () => window.open("https://pf.kakao.com/_xkDxmT", "_blank") },
          ].map((item, i) => (
            <button key={i} onClick={item.action}
              className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-3 text-left hover:bg-secondary/50 transition-colors">
              <span className="text-2xl">{item.icon}</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">{item.label}</p>
                <p className="text-xs text-primary">{item.value}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
          <p className="text-xs text-muted-foreground text-center">
            신고 후 조사관이 사업주에게 연락 → 보통 14일 내 해결
          </p>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* 단계 표시 */}
      <div className="flex gap-2">
        {steps.map((s, i) => (
          <button key={i} onClick={() => setStep(i)}
            className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: step === i ? "linear-gradient(135deg,#237FFF,#AB5EBE)" : "hsl(var(--secondary))",
              color: step === i ? "white" : "hsl(var(--muted-foreground))"
            }}>
            {s.icon} {i + 1}단계
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="font-semibold text-sm">{steps[step].title}</p>
        {steps[step].content}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          이전
        </Button>
        <Button onClick={() => setStep(Math.min(steps.length - 1, step + 1))} disabled={step === steps.length - 1}>
          다음
        </Button>
      </div>

      {/* 산재 안내 */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-blue-600">🏥 현장에서 다치셨나요?</p>
        <p className="text-xs text-muted-foreground">산재 신청은 근로자 권리입니다. 사장 동의 없어도 신청 가능합니다.</p>
        <button onClick={() => window.location.href = "tel:1588-0075"}
          className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold">
          <Phone className="w-3.5 h-3.5" /> 근로복지공단 1588-0075
        </button>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──
export function FieldToolsPage({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<ToolTab>("calc");

  const tabs = [
    { id: "calc" as ToolTab, label: "일당 계산", icon: "🧮" },
    { id: "weather" as ToolTab, label: "날씨 판단", icon: "🌤️" },
    { id: "report" as ToolTab, label: "임금체불", icon: "⚠️" },
  ];

  return (
    <div className="pb-24 max-w-lg mx-auto">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold">현장 도우미</h1>
          <p className="text-xs text-muted-foreground">일용직 현장직 필수 도구</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 px-4 pt-4 pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: tab === t.id ? "linear-gradient(135deg,#237FFF,#AB5EBE)" : "hsl(var(--card))",
              border: tab === t.id ? "none" : "1px solid hsl(var(--border))",
              color: tab === t.id ? "white" : "hsl(var(--muted-foreground))"
            }}>
            <span className="text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* 컨텐츠 */}
      <div className="px-4 pt-2">
        {tab === "calc" && <WageCalculator />}
        {tab === "weather" && <WeatherAlert />}
        {tab === "report" && <WageReport />}
      </div>
    </div>
  );
}

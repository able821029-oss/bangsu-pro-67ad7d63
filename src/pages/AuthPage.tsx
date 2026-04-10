import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Phone, Loader2, ArrowRight } from "lucide-react";

type Step = "phone" | "otp" | "terms";

export default function AuthPage() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 카운트다운 타이머
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // 전화번호 포맷 (010-1234-5678)
  const formatPhone = (v: string) => {
    const nums = v.replace(/\D/g, "").slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
  };

  // E.164 포맷으로 변환
  const toE164 = (p: string) => {
    const nums = p.replace(/\D/g, "");
    if (nums.startsWith("0")) return `+82${nums.slice(1)}`;
    return `+82${nums}`;
  };

  // 인증번호 요청
  const handleSendOtp = async () => {
    const nums = phone.replace(/\D/g, "");
    if (nums.length < 10) {
      toast.error("올바른 전화번호를 입력해주세요");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: toE164(phone),
      });
      if (error) throw error;
      setStep("otp");
      setCountdown(180); // 3분
      toast.success("인증번호가 발송되었습니다");
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("rate limit")) {
        toast.error("잠시 후 다시 시도해주세요");
      } else {
        toast.error("인증번호 발송 실패: " + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // OTP 입력 핸들러
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // 자동 포커스 이동
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // 6자리 완성 시 자동 인증
    if (newOtp.every(d => d) && newOtp.join("").length === 6) {
      verifyOtp(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // OTP 검증
  const verifyOtp = async (code: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: toE164(phone),
        token: code,
        type: "sms",
      });
      if (error) throw error;
      if (data.session) {
        toast.success("인증 완료!");
      }
    } catch (e: any) {
      toast.error("인증번호가 올바르지 않습니다");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // 이용약관 화면
  if (showTerms) {
    return (
      <div className="min-h-screen bg-background p-6">
        <button onClick={() => setShowTerms(false)} className="text-primary mb-4 text-sm font-medium">← 돌아가기</button>
        <h1 className="text-xl font-bold mb-4 text-foreground">이용약관</h1>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <section><h2 className="font-semibold text-foreground mb-1">1. 서비스 목적</h2><p>본 서비스는 콘텐츠 생성 및 일정 관리 기능을 제공합니다.</p></section>
          <section><h2 className="font-semibold text-foreground mb-1">2. 개인정보 수집</h2><p>전화번호, 이름, 일정 정보 등 서비스 제공에 필요한 정보를 수집합니다.</p></section>
          <section><h2 className="font-semibold text-foreground mb-1">3. 데이터 활용</h2><p>사용자가 입력한 데이터는 서비스 기능 제공에만 사용됩니다.</p></section>
          <section><h2 className="font-semibold text-foreground mb-1">4. 외부 연동</h2><p>구글 캘린더 연동 시 사용자 동의 하에 데이터가 전송됩니다.</p></section>
          <section><h2 className="font-semibold text-foreground mb-1">5. 책임 제한</h2><p>서비스 사용으로 발생한 손해에 대해 책임이 제한됩니다.</p></section>
          <section><h2 className="font-semibold text-foreground mb-1">6. 서비스 변경</h2><p>기능은 사전 공지 없이 변경될 수 있습니다.</p></section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4"
          style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
          <span className="text-4xl font-black text-white">S</span>
        </div>
        <h1 className="text-2xl font-black" style={{ background: "linear-gradient(90deg,#237FFF,#AB5EBE)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>SMS</h1>
        <p className="text-xs text-muted-foreground mt-1 tracking-widest">셀프마케팅서비스</p>
      </div>

      <div className="w-full max-w-sm space-y-5">
        {step === "phone" && (
          <>
            <div className="text-center space-y-1">
              <p className="text-lg font-bold text-foreground">휴대폰 번호로 시작하기</p>
              <p className="text-sm text-muted-foreground">인증번호를 문자로 보내드립니다</p>
            </div>

            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="tel"
                placeholder="010-0000-0000"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                className="w-full h-14 rounded-2xl bg-card pl-12 pr-4 text-foreground text-lg font-semibold tracking-wider placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                style={{ border: "1px solid hsl(var(--border))" }}
              />
            </div>

            {/* 이용약관 */}
            <div className="flex items-start gap-2">
              <Checkbox id="terms" checked={termsAgreed} onCheckedChange={(v) => setTermsAgreed(!!v)}
                className="mt-0.5 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
              <label htmlFor="terms" className="text-xs text-muted-foreground">
                <button type="button" onClick={() => setShowTerms(true)} className="text-primary underline">이용약관</button> 및{" "}
                <button type="button" onClick={() => setShowTerms(true)} className="text-primary underline">개인정보처리방침</button>에 동의합니다
              </label>
            </div>

            <button
              onClick={handleSendOtp}
              disabled={loading || !termsAgreed || phone.replace(/\D/g, "").length < 10}
              className="w-full h-13 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)", height: 52 }}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>인증번호 받기 <ArrowRight className="w-4 h-4" /></>}
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <div className="text-center space-y-1">
              <p className="text-lg font-bold text-foreground">인증번호 입력</p>
              <p className="text-sm text-muted-foreground">{phone}으로 전송된 6자리 번호</p>
            </div>

            {/* OTP 6자리 입력 */}
            <div className="flex gap-2 justify-center">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 rounded-xl bg-card text-center text-xl font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                  style={{ border: "1px solid hsl(var(--border))" }}
                />
              ))}
            </div>

            {/* 카운트다운 */}
            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-sm text-muted-foreground">
                  남은 시간 <span className="text-primary font-bold">{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}</span>
                </p>
              ) : (
                <p className="text-sm text-destructive">인증 시간이 만료되었습니다</p>
              )}
            </div>

            {loading && (
              <div className="flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setStep("phone"); setOtp(["","","","","",""]); }}
                className="flex-1 h-11 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium">
                번호 변경
              </button>
              <button onClick={handleSendOtp} disabled={countdown > 150}
                className="flex-1 h-11 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium disabled:opacity-40">
                재전송 {countdown > 150 ? `(${countdown - 150}초)` : ""}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

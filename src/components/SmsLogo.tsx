/**
 * SMS 공용 로고 — 전 앱 통일 컴포넌트.
 *
 * 디자인: 라운드 사각형 + 블루→퍼플 그라데이션 테두리 + 투명 내부 + 그라데이션 "S" 글자 + 글로우.
 * LoginPage 로고를 기준으로 모든 SplashScreen / AuthPage / 픽토그램에 동일하게 사용한다.
 */

interface SmsLogoProps {
  size?: number;       // 픽셀 (정사각형 바운딩)
  glow?: boolean;
  withWordmark?: boolean;
  className?: string;
}

export function SmsLogo({
  size = 80,
  glow = true,
  withWordmark = false,
  className,
}: SmsLogoProps) {
  const borderWidth = Math.max(2, Math.round(size / 20));
  const radius = Math.round(size * 0.28);
  const innerRadius = Math.max(0, radius - borderWidth / 2);

  return (
    <div className={className} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          padding: borderWidth,
          background: "linear-gradient(135deg, #237FFF, #AB5EBE)",
          boxShadow: glow ? "0 0 32px rgba(35,127,255,0.4), 0 0 16px rgba(171,94,190,0.25)" : undefined,
        }}
        aria-hidden="true"
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: innerRadius,
            background: "hsl(var(--background))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Manrope', 'Noto Sans KR', sans-serif",
            fontWeight: 900,
            fontSize: size * 0.5,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            background: "hsl(var(--background))",
            color: "transparent",
          }}
        >
          <span
            style={{
              background: "linear-gradient(135deg, #237FFF, #AB5EBE)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              textShadow: glow ? "0 0 12px rgba(76,142,255,0.5)" : undefined,
            }}
          >
            S
          </span>
        </div>
      </div>
      {withWordmark && (
        <>
          <p
            style={{
              fontWeight: 900,
              fontSize: Math.round(size * 0.42),
              letterSpacing: "-0.03em",
              lineHeight: 1,
              background: "linear-gradient(90deg, #237FFF, #AB5EBE)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              margin: 0,
            }}
          >
            SMS
          </p>
          <p
            style={{
              margin: 0,
              fontSize: Math.max(9, Math.round(size * 0.12)),
              fontWeight: 600,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "rgba(180,185,210,0.65)",
            }}
          >
            Self Marketing Service
          </p>
        </>
      )}
    </div>
  );
}

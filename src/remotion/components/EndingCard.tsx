import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

const FONT = '-apple-system, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';

export function EndingCard({ companyName, phoneNumber, logoUrl }: {
  companyName: string;
  phoneNumber: string;
  logoUrl?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ fps, frame, config: { damping: 12, stiffness: 60 } });
  const nameSpring = spring({ fps, frame: Math.max(0, frame - 6), config: { damping: 12, stiffness: 60 } });
  const phoneSpring = spring({ fps, frame: Math.max(0, frame - 12), config: { damping: 12, stiffness: 60 } });
  const tagSpring = spring({ fps, frame: Math.max(0, frame - 18), config: { damping: 12, stiffness: 60 } });

  return (
    <AbsoluteFill style={{
      background: "linear-gradient(145deg, #0B1535 0%, #16083A 60%, #0E1322 100%)",
      justifyContent: "center",
      alignItems: "center",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: "25%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(35,127,255,0.15), transparent 70%)",
      }} />

      {/* Logo */}
      {logoUrl && (
        <div style={{
          opacity: logoSpring,
          transform: `scale(${interpolate(logoSpring, [0, 1], [0.5, 1])})`,
          marginBottom: 40,
        }}>
          <div style={{
            width: 200, height: 200, borderRadius: "50%",
            padding: 5,
            background: "linear-gradient(135deg, #237FFF, #AB5EBE)",
          }}>
            <img src={logoUrl} style={{
              width: "100%", height: "100%", borderRadius: "50%",
              objectFit: "cover", display: "block",
            }} />
          </div>
        </div>
      )}

      {/* SMS Logo (if no custom logo) */}
      {!logoUrl && (
        <div style={{
          opacity: logoSpring,
          transform: `scale(${interpolate(logoSpring, [0, 1], [0.5, 1])})`,
          marginBottom: 40,
          width: 160, height: 160, borderRadius: 40,
          background: "linear-gradient(135deg, #237FFF, #AB5EBE)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 100, fontWeight: 900, color: "#fff", fontFamily: "Arial Black" }}>S</span>
        </div>
      )}

      {/* Company name */}
      <div style={{
        opacity: nameSpring,
        transform: `translateY(${interpolate(nameSpring, [0, 1], [30, 0])}px)`,
      }}>
        <h1 style={{
          fontFamily: FONT, fontWeight: 900, fontSize: 120,
          color: "#fff", textAlign: "center", margin: 0,
          textShadow: "0 4px 30px rgba(0,0,0,0.5)",
        }}>
          {companyName || "SMS"}
        </h1>
      </div>

      {/* Phone number pill */}
      <div style={{
        opacity: phoneSpring,
        transform: `translateY(${interpolate(phoneSpring, [0, 1], [20, 0])}px)`,
        marginTop: 30,
      }}>
        <div style={{
          background: "linear-gradient(135deg, #237FFF, #AB5EBE)",
          padding: "20px 60px", borderRadius: 60,
          boxShadow: "0 8px 30px rgba(35,127,255,0.3)",
        }}>
          <span style={{
            fontFamily: FONT, fontWeight: 800, fontSize: 72,
            color: "#fff",
          }}>
            {phoneNumber || "문의하세요"}
          </span>
        </div>
      </div>

      {/* Tagline */}
      <div style={{
        position: "absolute", bottom: 120,
        opacity: tagSpring,
      }}>
        <p style={{
          fontFamily: FONT, fontSize: 32, color: "rgba(255,255,255,0.4)",
          textAlign: "center", margin: 0,
        }}>
          AI 블로그 자동 작성 | SMS 셀프마케팅서비스
        </p>
      </div>
    </AbsoluteFill>
  );
}

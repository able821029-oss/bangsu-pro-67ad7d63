import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import type { SmsScene } from "../types";

const FONT = '"Noto Sans KR", "Malgun Gothic", sans-serif';

export function SmsSceneComp({ scene, photoSrc }: { scene: SmsScene; photoSrc?: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const zoom = interpolate(frame, [0, scene.durationInFrames], [1, 1.12], { extrapolateRight: "clamp" });
  const textSpring = spring({ fps, frame, config: { damping: 15, stiffness: 80 } });
  const subtitleSpring = spring({ fps, frame: Math.max(0, frame - 9), config: { damping: 15, stiffness: 80 } });

  const getTextTransform = () => {
    switch (scene.animation) {
      case "slide_up":
        return `translateY(${interpolate(textSpring, [0, 1], [40, 0])}px)`;
      case "slide_left":
        return `translateX(${interpolate(textSpring, [0, 1], [-40, 0])}px)`;
      case "zoom_in":
        return `scale(${interpolate(textSpring, [0, 1], [0.7, 1])})`;
      case "fade_in":
      default:
        return "none";
    }
  };

  const hasPhoto = !!photoSrc;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0B1535" }}>
      <AbsoluteFill style={{ background: "linear-gradient(145deg, #0a1628 0%, #1a3a6a 100%)" }} />

      {hasPhoto && (
        <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
          <Img src={photoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      )}

      <AbsoluteFill style={{
        background: hasPhoto
          ? "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, transparent 60%)"
          : "none",
      }} />

      {!hasPhoto && (
        <AbsoluteFill style={{ opacity: interpolate(frame, [0, 30], [0, 0.08], { extrapolateRight: "clamp" }) }}>
          <div style={{
            width: "100%", height: "100%",
            backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }} />
        </AbsoluteFill>
      )}

      {!hasPhoto && (
        <div style={{
          position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
          width: 400, height: 400, borderRadius: "50%",
          background: `radial-gradient(circle, ${scene.accentColor}22, transparent 70%)`,
          opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" }),
        }} />
      )}

      <AbsoluteFill style={{
        justifyContent: hasPhoto ? "flex-end" : "center",
        alignItems: "flex-start",
        padding: hasPhoto ? "0 60px 400px" : "0 60px",
      }}>
        {scene.badge && (
          <div style={{ opacity: textSpring, transform: getTextTransform(), marginBottom: 24 }}>
            <span style={{
              background: scene.accentColor, color: "#fff",
              fontFamily: FONT, fontWeight: 800, fontSize: 28,
              padding: "8px 24px", borderRadius: 50, letterSpacing: 2,
            }}>
              {scene.badge}
            </span>
          </div>
        )}

        <div style={{ opacity: textSpring, transform: getTextTransform() }}>
          <h1 style={{
            fontFamily: FONT, fontWeight: 900, fontSize: 72,
            color: "#fff", lineHeight: 1.2,
            textShadow: "0 4px 20px rgba(0,0,0,0.6)", margin: 0,
          }}>
            {scene.title}
          </h1>
        </div>

        {scene.subtitle && (
          <div style={{
            opacity: subtitleSpring,
            transform: `translateY(${interpolate(subtitleSpring, [0, 1], [20, 0])}px)`,
            marginTop: 16,
          }}>
            <p style={{
              fontFamily: FONT, fontWeight: 500, fontSize: 36,
              color: scene.accentColor, margin: 0,
              textShadow: "0 2px 10px rgba(0,0,0,0.5)",
            }}>
              {scene.subtitle}
            </p>
          </div>
        )}
      </AbsoluteFill>

      <div style={{
        position: "absolute",
        bottom: hasPhoto ? 350 : "42%",
        left: 60,
        width: interpolate(textSpring, [0, 1], [0, 200]),
        height: 4,
        background: scene.accentColor,
        borderRadius: 2,
      }} />
    </AbsoluteFill>
  );
}

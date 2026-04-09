import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { SmsSceneComp } from "./components/SmsSceneComp";
import { EndingCard } from "./components/EndingCard";
import type { SmsVideoProps } from "./types";

const ENDING_FRAMES = 150; // 5초

function FadeTransition({ children, durationInFrames }: { children: React.ReactNode; durationInFrames: number }) {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>{children}</AbsoluteFill>;
}

export function SmsComposition({ scenes, photos, companyName, phoneNumber, logoUrl }: SmsVideoProps) {
  let cumFrames = 0;

  const getPhotoSrc = (photoKey: string | null): string | undefined => {
    if (!photoKey) return undefined;
    const match = photoKey.match(/photo_(\d+)/);
    if (match) {
      const idx = parseInt(match[1], 10) - 1;
      return photos[idx] || undefined;
    }
    return undefined;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#0B1535" }}>
      {scenes.map((scene, i) => {
        const from = cumFrames;
        cumFrames += scene.durationInFrames;
        return (
          <Sequence key={scene.id || i} from={from} durationInFrames={scene.durationInFrames}>
            <FadeTransition durationInFrames={scene.durationInFrames}>
              <SmsSceneComp scene={scene} photoSrc={getPhotoSrc(scene.photo)} />
            </FadeTransition>
          </Sequence>
        );
      })}

      <Sequence from={cumFrames} durationInFrames={ENDING_FRAMES}>
        <FadeTransition durationInFrames={ENDING_FRAMES}>
          <EndingCard companyName={companyName} phoneNumber={phoneNumber} logoUrl={logoUrl} />
        </FadeTransition>
      </Sequence>
    </AbsoluteFill>
  );
}

export function calculateTotalFrames(scenes: SmsVideoProps["scenes"]): number {
  return scenes.reduce((sum, s) => sum + s.durationInFrames, 0) + ENDING_FRAMES;
}

import { Player } from "@remotion/player";
import { SmsComposition, calculateTotalFrames } from "@/remotion/SmsComposition";
import type { SmsScene } from "@/remotion/types";
import type { BgmType } from "@/lib/bgmSynth";

interface ShortsPlayerProps {
  scenes: SmsScene[];
  photos: string[];
  companyName: string;
  phoneNumber: string;
  logoUrl?: string;
  bgmType: BgmType;
}

export default function ShortsPlayer(props: ShortsPlayerProps) {
  return (
    <Player
      component={SmsComposition}
      inputProps={props}
      durationInFrames={calculateTotalFrames(props.scenes)}
      compositionWidth={1080}
      compositionHeight={1920}
      fps={30}
      style={{ width: "100%", aspectRatio: "9/16" }}
      controls
      autoPlay
    />
  );
}

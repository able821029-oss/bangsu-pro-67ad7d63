import { Composition } from "remotion";
import { SmsComposition, calculateTotalFrames } from "./SmsComposition";
import type { SmsVideoProps } from "./types";

const FPS = 30;
const W = 1080;
const H = 1920;

// 기본 props (번들 시 필요)
const defaultProps: SmsVideoProps = {
  scenes: [
    {
      id: "0",
      durationInFrames: 100,
      photo: null,
      badge: "시공 현장",
      title: "SMS 셀프마케팅",
      subtitle: "AI로 쉽게 만드는 마케팅 영상",
      accentColor: "#237FFF",
      animation: "slide_up",
      narration: "",
    },
  ],
  photos: [],
  companyName: "SMS",
  phoneNumber: "010-0000-0000",
  bgmType: "none",
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SmsShorts"
      component={SmsComposition}
      durationInFrames={calculateTotalFrames(defaultProps.scenes)}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={defaultProps}
    />
  );
};

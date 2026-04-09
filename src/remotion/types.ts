export interface SmsScene {
  id: string;
  durationInFrames: number;
  photo: string | null;
  badge: string;
  title: string;
  subtitle: string;
  accentColor: string;
  animation: "slide_up" | "slide_left" | "zoom_in" | "fade_in";
  narration: string;
}

export interface SmsVideoProps {
  scenes: SmsScene[];
  photos: string[];
  companyName: string;
  phoneNumber: string;
  logoUrl?: string;
  bgmType: "upbeat" | "calm" | "hiphop" | "emotional" | "corporate" | "none";
  narrationAudios?: (string | null)[];
}

/** MirraScene → SmsScene 변환 */
export function mirraToRemotionScene(scene: any, index: number): SmsScene {
  return {
    id: String(index),
    durationInFrames: scene.duration || 100,
    photo: scene.photo || null,
    badge: scene.badge || "",
    title: scene.title || "",
    subtitle: scene.subtitle || "",
    accentColor: scene.accent_color || "#237FFF",
    animation: scene.animation || "fade_in",
    narration: scene.narration || "",
  };
}

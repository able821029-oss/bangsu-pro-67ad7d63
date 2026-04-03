import { Platform } from "@/stores/appStore";

const NaverIcon = ({ selected }: { selected: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
    <path
      d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"
      fill={selected ? "white" : "#03C75A"}
    />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" width="20" height="20">
    <defs>
      <radialGradient id="igLogo" cx="30%" cy="107%" r="120%">
        <stop offset="0%" stopColor="#FFD676" />
        <stop offset="20%" stopColor="#F7A34B" />
        <stop offset="40%" stopColor="#F26B4E" />
        <stop offset="60%" stopColor="#E1306C" />
        <stop offset="80%" stopColor="#833AB4" />
        <stop offset="100%" stopColor="#4F5BD5" />
      </radialGradient>
    </defs>
    <rect width="48" height="48" rx="12" fill="url(#igLogo)" />
    <rect x="13" y="13" width="22" height="22" rx="6" stroke="white" strokeWidth="2.2" fill="none" />
    <circle cx="24" cy="24" r="6" stroke="white" strokeWidth="2.2" fill="none" />
    <circle cx="33" cy="15" r="2" fill="white" />
  </svg>
);

const TiktokIcon = ({ selected }: { selected: boolean }) => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path
      d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"
      fill={selected ? "white" : "#000000"}
    />
  </svg>
);

const platformConfig: Record<Platform, {
  label: string;
  icon: (selected: boolean) => JSX.Element;
  selectedBg: string;
  selectedBorder: string;
}> = {
  naver: {
    label: "네이버 블로그",
    icon: (sel) => <NaverIcon selected={sel} />,
    selectedBg: "#03C75A",
    selectedBorder: "#03C75A",
  },
  instagram: {
    label: "인스타그램",
    icon: () => <InstagramIcon />,
    selectedBg: "white",
    selectedBorder: "#E1306C",
  },
  tiktok: {
    label: "틱톡",
    icon: (sel) => <TiktokIcon selected={sel} />,
    selectedBg: "#000000",
    selectedBorder: "#000000",
  },
};

interface PlatformChipProps {
  platform: Platform;
  selected: boolean;
  onClick: () => void;
}

export function PlatformChip({ platform, selected, onClick }: PlatformChipProps) {
  const config = platformConfig[platform];
  const isInsta = platform === "instagram";

  const style: React.CSSProperties = selected
    ? isInsta
      ? { background: "hsl(var(--card))", border: "2px solid #E1306C", color: "#E1306C" }
      : { background: config.selectedBg, border: `2px solid ${config.selectedBorder}`, color: "white" }
    : { background: "hsl(var(--card))", border: "1.5px solid hsl(var(--border))", color: "hsl(var(--foreground))" };

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 font-medium text-sm transition-all"
      style={{
        ...style,
        borderRadius: 50,
        padding: "10px 18px",
      }}
    >
      {config.icon(selected)}
      {config.label}
    </button>
  );
}

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type ChipColor =
  | "blue"
  | "purple"
  | "cyan"
  | "green"
  | "amber"
  | "rose"
  | "indigo"
  | "orange"
  | "slate";

const COLORS: Record<ChipColor, string> = {
  blue: "#237FFF",
  purple: "#AB5EBE",
  cyan: "#06B6D4",
  green: "#22C55E",
  amber: "#F59E0B",
  rose: "#F43F5E",
  indigo: "#6366F1",
  orange: "#F97316",
  slate: "#64748B",
};

type Size = "sm" | "md" | "lg";

interface IconChipProps {
  icon: LucideIcon;
  color?: ChipColor;
  size?: Size;
  className?: string;
  strokeWidth?: number;
}

export function IconChip({
  icon: Icon,
  color = "blue",
  size = "md",
  className,
  strokeWidth = 2,
}: IconChipProps) {
  const sizeClass =
    size === "sm" ? "icon-chip icon-chip-sm" : size === "lg" ? "icon-chip icon-chip-lg" : "icon-chip";
  const iconSize = size === "sm" ? 18 : size === "lg" ? 24 : 22;
  return (
    <div className={cn(sizeClass, className)} aria-hidden="true">
      <Icon size={iconSize} strokeWidth={strokeWidth} color={COLORS[color]} />
    </div>
  );
}

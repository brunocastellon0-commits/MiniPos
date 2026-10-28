import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface-muted text-foreground",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  info: "border-info/30 bg-info/10 text-info",
  accent: "border-accent/30 bg-accent/10 text-accent",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}

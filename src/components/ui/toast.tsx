import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type ToastTone = "neutral" | "success" | "danger" | "warning";

const toneClasses: Record<ToastTone, string> = {
  neutral: "border-border bg-surface text-foreground",
  success: "border-success/30 bg-success/10 text-success",
  danger: "border-danger/30 bg-danger/10 text-danger",
  warning: "border-warning/30 bg-warning/10 text-warning",
};

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  tone?: ToastTone;
  title: string;
  description?: string;
}

export function Toast({ tone = "neutral", title, description, className, ...props }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-md border p-4 shadow-card",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="mt-1 text-sm opacity-90">{description}</p> : null}
      </div>
    </div>
  );
}

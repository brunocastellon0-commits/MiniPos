import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-6 items-center justify-center rounded border border-border bg-surface-muted px-1.5 py-0.5 font-sans text-xs font-medium text-muted shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

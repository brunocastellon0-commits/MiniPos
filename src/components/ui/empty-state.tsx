import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-surface p-8 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="text-muted" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

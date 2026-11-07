"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ExpandableRowProps {
  summary: ReactNode;
  children: ReactNode;
  colSpan?: number;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  className?: string;
  detailClassName?: string;
}

export function ExpandableRow({
  summary,
  children,
  colSpan = 6,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onToggle,
  className,
  detailClassName,
}: ExpandableRowProps) {
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : uncontrolledExpanded;

  const handleToggle = () => {
    const next = !isExpanded;
    if (controlledExpanded === undefined) {
      setUncontrolledExpanded(next);
    }
    onToggle?.(next);
  };

  return (
    <>
      <tr
        onClick={handleToggle}
        className={cn(
          "cursor-pointer border-b border-border transition-colors hover:bg-surface-muted/50",
          isExpanded && "bg-surface-muted/30",
          className,
        )}
        aria-expanded={isExpanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <td className="w-8 px-2 py-3 text-center text-muted">
          {isExpanded ? (
            <ChevronDown className="inline-block h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="inline-block h-4 w-4" aria-hidden="true" />
          )}
        </td>
        {summary}
      </tr>
      {isExpanded && (
        <tr className={cn("border-b border-border bg-surface-muted/20", detailClassName)}>
          <td colSpan={colSpan + 1} className="p-4">
            {children}
          </td>
        </tr>
      )}
    </>
  );
}

import { cn } from "@/lib/utils/cn";

export interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className, label = "Cargando" }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex size-5", className)}>
      <svg
        aria-hidden="true"
        className="size-full animate-spin motion-reduce:animate-none"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

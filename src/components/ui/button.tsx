"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "border border-border bg-surface text-foreground hover:bg-surface-muted",
  ghost: "text-foreground hover:bg-surface-muted",
  danger: "bg-danger text-danger-foreground hover:bg-danger-hover",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
  icon: "size-10",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    type = "button",
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
});

Button.displayName = "Button";

export interface IconButtonProps extends Omit<ButtonProps, "size" | "aria-label"> {
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant = "ghost", ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      size="icon"
      variant={variant}
      className={cn("shrink-0", className)}
      {...props}
    />
  );
});

IconButton.displayName = "IconButton";

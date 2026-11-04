"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-classes";
import { Spinner } from "./spinner";

export { buttonClasses };
export type { ButtonSize, ButtonVariant };

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
      className={buttonClasses({ variant, size, className })}
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

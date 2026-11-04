import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface FormFieldControlProps {
  id: string;
  invalid: boolean;
  "aria-describedby": string | undefined;
}

export interface FormFieldProps {
  id: string;
  label: ReactNode;
  /** Nodo estático o función recibe `id`, `invalid` y `aria-describedby` para el control. */
  children: ReactNode | ((control: FormFieldControlProps) => ReactNode);
  error?: string | null;
  help?: ReactNode;
  labelClassName?: string;
  className?: string;
}

/**
 * Campo de formulario con etiqueta siempre visible, microcopia de ayuda y error
 * debajo del control (B1.1/B1.3): vincula label, `aria-invalid` y `aria-describedby`.
 */
export function FormField({
  id,
  label,
  children,
  error = null,
  help,
  labelClassName,
  className,
}: FormFieldProps) {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  // El error reemplaza a la ayuda: solo se referencia lo que está renderizado.
  const describedBy =
    [!error && help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;
  const control: FormFieldControlProps = {
    id,
    invalid: Boolean(error),
    "aria-describedby": describedBy,
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className={cn("text-xs font-medium text-foreground", labelClassName)}>
        {label}
      </label>
      {typeof children === "function" ? children(control) : children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : help ? (
        <p id={helpId} className="text-xs text-foreground-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}

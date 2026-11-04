import type { ComponentPropsWithoutRef } from "react";

export function Table({ className = "", ...props }: ComponentPropsWithoutRef<"table">) {
  return <table className={`min-w-full text-sm ${className}`.trim()} {...props} />;
}

export function Th({ className = "", ...props }: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide ${className}`.trim()}
      {...props}
    />
  );
}

export function Td({ className = "", ...props }: ComponentPropsWithoutRef<"td">) {
  return <td className={`px-4 py-2.5 ${className}`.trim()} {...props} />;
}

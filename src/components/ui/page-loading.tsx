import { Skeleton } from "./skeleton";

export interface PageLoadingProps {
  /** Texto accesible que describe qué se está cargando. */
  label: string;
  /** Filas esqueleto de la tabla o lista principal. */
  rows?: number;
}

/**
 * Esqueleto genérico de página: imita el formato título + barra + tabla/tarjeta
 * de las vistas de LILA MARKET para evitar saltos de diseño al navegar.
 */
export function PageLoading({ label, rows = 6 }: PageLoadingProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="space-y-6"
      data-testid="page-loading"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="space-y-3 rounded-card border border-border bg-surface p-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-28 sm:block" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

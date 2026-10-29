export default function ProductosLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando productos">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-surface-muted" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-surface-muted" />
      </div>
      <div className="space-y-3">
        <div className="h-10 w-full animate-pulse rounded-md bg-surface-muted" />
        <div className="h-40 w-full animate-pulse rounded-card bg-surface-muted" />
      </div>
    </div>
  );
}

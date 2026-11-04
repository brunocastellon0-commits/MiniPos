import { PageLoading } from "@/components/ui/page-loading";

export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <PageLoading label="Cargando LILA MARKET" rows={3} />
    </div>
  );
}

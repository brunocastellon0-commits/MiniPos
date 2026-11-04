import { PageLoading } from "@/components/ui/page-loading";

export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <PageLoading label="Cargando inicio de sesión" rows={3} />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-700">
          LILA MARKET
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Base del proyecto lista</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Next.js 16, TypeScript estricto y Tailwind CSS. Las pantallas de caja,
          inventario y reportes se construyen en las siguientes tareas.
        </p>
      </section>
    </main>
  );
}

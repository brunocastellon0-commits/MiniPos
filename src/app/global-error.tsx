"use client";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Se renderiza con estilos inline: al reemplazar el layout raíz no se carga globals.css.
  // Nunca se muestra error.message: puede contener detalles internos (p. ej. de Postgres).
  return (
    <html lang="es-BO">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: "28rem",
            width: "100%",
            borderRadius: "0.75rem",
            border: "1px solid rgba(185, 28, 28, 0.3)",
            background: "rgba(185, 28, 28, 0.1)",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
            No se pudo iniciar la aplicación
          </h1>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>
            Ocurrió un error inesperado. Tus datos no se perdieron; vuelve a intentar.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1rem",
              borderRadius: "0.375rem",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}

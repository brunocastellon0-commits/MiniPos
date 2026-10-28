"use client";

import { useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, PackageSearch, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Toast } from "@/components/ui/toast";

const swatches = [
  { name: "background", className: "bg-background" },
  { name: "surface", className: "bg-surface" },
  { name: "surface-muted", className: "bg-surface-muted" },
  { name: "border", className: "bg-border" },
  { name: "primary", className: "bg-primary" },
  { name: "primary-hover", className: "bg-primary-hover" },
  { name: "accent", className: "bg-accent" },
  { name: "success", className: "bg-success" },
  { name: "warning", className: "bg-warning" },
  { name: "danger", className: "bg-danger" },
  { name: "info", className: "bg-info" },
  { name: "muted", className: "bg-muted" },
];

export function DesignShowcase() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-12">
      <Section
        title="Colores"
        description="Tokens semánticos. Ningún componente usa colores hardcodeados."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {swatches.map((swatch) => (
            <div key={swatch.name} className="rounded-lg border border-border bg-surface p-3">
              <div className={`h-12 rounded-md border border-border ${swatch.className}`} />
              <p className="mt-2 font-mono text-xs text-foreground">{swatch.name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografía" description="Inter con números tabulares para importes.">
        <div className="space-y-2 rounded-card border border-border bg-surface p-5">
          <p className="text-3xl font-semibold">LILA MARKET</p>
          <p className="text-lg font-medium">Título de sección</p>
          <p className="text-sm text-muted">
            Texto secundario para descripciones y ayudas dentro de la interfaz.
          </p>
          <p className="text-2xl font-semibold tabular-nums">Bs 46,50</p>
        </div>
      </Section>

      <Section title="Botones" description="Variantes, tamaños y estados.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Guardar</Button>
          <Button variant="secondary">Cancelar</Button>
          <Button variant="ghost">Ver detalle</Button>
          <Button variant="danger">Anular</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Pequeño</Button>
          <Button size="md">Mediano</Button>
          <Button size="lg">Grande</Button>
          <Button loading>Cobrando</Button>
          <Button disabled>Deshabilitado</Button>
          <IconButton aria-label="Eliminar producto">
            <Trash2 className="size-5" aria-hidden="true" />
          </IconButton>
          <IconButton aria-label="Agregar producto" variant="secondary">
            <Plus className="size-5" aria-hidden="true" />
          </IconButton>
        </div>
      </Section>

      <Section title="Formularios" description="Campo normal, inválido y deshabilitado.">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1.5 text-sm font-medium text-foreground">
            <span>Buscar producto</span>
            <Input placeholder="Nombre o código de barras" />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-foreground">
            <span>Precio</span>
            <Input invalid defaultValue="-" aria-describedby="precio-error" />
            <span id="precio-error" className="block text-xs font-normal text-danger">
              Ingresá un monto válido.
            </span>
          </label>
          <label className="space-y-1.5 text-sm font-medium text-foreground">
            <span>Usuario</span>
            <Input disabled defaultValue="cajero@lilamarket.bo" />
          </label>
        </div>
      </Section>

      <Section title="Badges" description="Cada estado combina color, ícono y texto.">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Neutro</Badge>
          <Badge tone="success">
            <CircleCheck className="size-3.5" aria-hidden="true" />
            Caja abierta
          </Badge>
          <Badge tone="warning">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            Stock bajo
          </Badge>
          <Badge tone="danger">
            <CircleAlert className="size-3.5" aria-hidden="true" />
            Agotado
          </Badge>
          <Badge tone="info">Pausada</Badge>
          <Badge tone="accent">Nueva</Badge>
        </div>
      </Section>

      <Section title="Card" description="Contenedor con borde fino y sombra suave.">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Coca-Cola 2 L</CardTitle>
            <CardDescription>Bebidas · 12 disponibles</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">Bs 12,50</p>
          </CardContent>
          <CardFooter>
            <Button size="sm">Agregar</Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Estados" description="Vacío, carga, toast y diferencia de caja.">
        <div className="grid gap-4 lg:grid-cols-2">
          <EmptyState
            icon={<PackageSearch className="size-8" />}
            title="No hay productos que coincidan"
            description="Probá con otro nombre o código de barras."
            action={<Button variant="secondary">Limpiar búsqueda</Button>}
          />
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-5">
              <Spinner />
              <span className="text-sm text-muted">Cargando productos…</span>
            </div>
            <Toast tone="success" title="Venta registrada" description="Se descontó el stock." />
            <Toast
              tone="warning"
              title="Hay una diferencia de Bs 10,00 en la caja"
              description="Se registrará al cerrar el turno."
            />
          </div>
        </div>
      </Section>

      <Section title="Diálogo" description="Foco al abrir, Escape y clic fuera para cerrar.">
        <Button onClick={() => setDialogOpen(true)}>Abrir diálogo</Button>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Anular venta"
          description="La venta se anula, se repone el stock y se revierte la caja."
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => setDialogOpen(false)}>
                Anular venta
              </Button>
            </>
          }
        >
          <p>Motivo: error de cobro.</p>
        </Dialog>
      </Section>

      <Section title="Atajos" description="Se muestran junto al campo o acción.">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
          <span className="inline-flex items-center gap-2">
            Buscar <Kbd>F2</Kbd>
          </span>
          <span className="inline-flex items-center gap-2">
            Cobrar <Kbd>F9</Kbd>
          </span>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

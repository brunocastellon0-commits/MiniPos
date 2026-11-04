"use client";

import { Table, Td, Th } from "@/components/ui/table";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";
import {
  importProductsCsvAction,
  previewProductsCsvAction,
} from "@/lib/actions/products-csv";
import type { ProductsCsvPreview } from "@/lib/actions/products-csv-core";
import { formatBs } from "@/lib/money";

export interface ImportProductsDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: (imported: number) => void;
}

export function ImportProductsDialog({ open, onClose, onImported }: ImportProductsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Importar productos desde CSV"
      description="Sube un archivo con tus productos. Si hay errores, no se importa ninguna fila."
      className="max-w-2xl"
    >
      <ImportDialogContent key={String(open)} onClose={onClose} onImported={onImported} />
    </Dialog>
  );
}

function ImportDialogContent({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (imported: number) => void;
}) {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProductsCsvPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setPreview(null);
    setCsv(null);
    setFileName(file.name);

    if (file.size > 1_000_000) {
      setErrorMessage("El archivo supera el máximo de 1 MB. Divídelo en varios archivos.");
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      setErrorMessage("No se pudo leer el archivo. Verifica que sea un CSV de texto.");
      return;
    }

    setCsv(text);
    setLoadingPreview(true);
    const result = await previewProductsCsvAction({ csv: text });
    setLoadingPreview(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setPreview(result.data);
  };

  const handleImport = async () => {
    if (!csv) return;
    setImporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await importProductsCsvAction({ csv });
    setImporting(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    if (result.data.errors.length > 0) {
      setPreview((previous) =>
        previous ? { ...previous, errors: result.data.errors } : previous,
      );
      setErrorMessage("No se importó ninguna fila. Corrige los errores y vuelve a intentar.");
      return;
    }

    setSuccessMessage(`Se importaron ${result.data.imported} productos correctamente.`);
    onImported(result.data.imported);
  };

  const hasErrors = Boolean(preview && preview.errors.length > 0);
  const canImport =
    Boolean(csv) && preview !== null && preview.validRows > 0 && !hasErrors && !importing;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface-muted/40 p-3 text-sm text-foreground-muted">
        <p>
          Descarga la plantilla, complétala y guárdala como CSV. Columnas obligatorias:
          <strong className="text-foreground"> nombre</strong> y
          <strong className="text-foreground"> precio</strong>.
        </p>
        <a
          href="/plantilla_productos.csv"
          download
          className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Descargar plantilla CSV
        </a>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="products-csv-file" className="text-xs font-medium text-foreground">
          Archivo CSV
        </label>
        <input
          id="products-csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          disabled={importing}
          className="block w-full cursor-pointer rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
        />
        <p className="text-xs text-foreground-muted">
          Máximo 1 MB y 1.000 filas por archivo. {fileName ? `Archivo: ${fileName}` : ""}
        </p>
      </div>

      {loadingPreview ? (
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <FileUp className="h-4 w-4 animate-pulse" aria-hidden="true" />
          Analizando archivo...
        </div>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {successMessage ? <Toast tone="success" title={successMessage} /> : null}

      {preview ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={preview.validRows > 0 ? "success" : "neutral"}>
              {preview.validRows} filas válidas
            </Badge>
            {preview.errors.length > 0 ? (
              <Badge tone="danger">{preview.errors.length} filas con errores</Badge>
            ) : (
              <Badge tone="success">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Sin errores
              </Badge>
            )}
            <span className="text-xs text-foreground-muted">
              Total de filas de datos: {preview.totalRows}
            </span>
          </div>

          {preview.errors.length > 0 ? (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-danger/30 bg-danger/5">
              <Table className="w-full text-left text-sm">
                <caption className="sr-only">Errores encontrados en el archivo CSV</caption>
                <thead className="border-b border-danger/20 text-xs text-danger">
                  <tr>
                    <Th scope="col">
                      Fila
                    </Th>
                    <Th scope="col">
                      Problema
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errors.map((error) => (
                    <tr key={`${error.line}-${error.message}`} className="border-b border-danger/10">
                      <Td className="tabular-nums text-danger">{error.line || "—"}</Td>
                      <Td className="text-foreground">{error.message}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : preview.preview.length > 0 ? (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              <Table className="w-full text-left text-sm">
                <caption className="sr-only">Vista previa de productos a importar</caption>
                <thead className="border-b border-border text-xs text-foreground-muted">
                  <tr>
                    <Th scope="col">
                      Producto
                    </Th>
                    <Th scope="col">
                      Categoría
                    </Th>
                    <Th scope="col" className="text-right">
                      Precio
                    </Th>
                    <Th scope="col" className="text-right">
                      Stock
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row) => (
                    <tr key={`${row.line}-${row.name}`} className="border-b border-border">
                      <Td className="font-medium text-foreground">{row.name}</Td>
                      <Td className="text-foreground-muted">
                        {row.categoryName ?? "Sin categoría"}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {formatBs(row.priceCents)}
                      </Td>
                      <Td className="text-right tabular-nums">{row.stockQty}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : null}

          {preview.validRows > 10 ? (
            <p className="text-xs text-foreground-muted">
              Se muestran los primeros 10 productos de {preview.validRows}.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose} disabled={importing}>
          {successMessage ? "Cerrar" : "Cancelar"}
        </Button>
        <Button onClick={handleImport} disabled={!canImport} loading={importing}>
          Importar {preview?.validRows ?? 0} productos
        </Button>
      </div>
    </div>
  );
}

import {
  type ProductsCsvError,
  type ProductsCsvRow,
  parseProductsCsv,
  toProductInsert,
} from "@/lib/domain/products-csv";
import { SupabaseAuditRepo } from "@/lib/repos/supabase/audit";
import { SupabaseCategoriesRepo } from "@/lib/repos/supabase/categories";
import { SupabaseProductsRepo } from "@/lib/repos/supabase/products";
import { SupabaseSettingsRepo } from "@/lib/repos/supabase/settings";
import type {
  AuditRepo,
  CategoriesRepo,
  ProductsRepo,
  SettingsRepo,
  UserContext,
} from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, type AuthenticatedUser, secureAction } from "./secure-action";
import { productsCsvSchema, type ProductsCsvInput } from "./products-csv-schema";

export interface ProductsCsvPreviewItem {
  line: number;
  name: string;
  categoryName: string | null;
  priceCents: number;
  stockQty: number;
}

export interface ProductsCsvPreview {
  totalRows: number;
  validRows: number;
  errors: ProductsCsvError[];
  preview: ProductsCsvPreviewItem[];
}

export interface ImportProductsCsvResult {
  imported: number;
  errors: ProductsCsvError[];
}

export interface ProductsCsvActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  productsRepoFactory?: (user: UserContext) => Promise<ProductsRepo>;
  categoriesRepoFactory?: (user: UserContext) => Promise<CategoriesRepo>;
  auditRepoFactory?: (user: UserContext) => Promise<AuditRepo>;
  settingsRepoFactory?: (user: UserContext) => Promise<SettingsRepo>;
}

async function defaultProductsRepoFactory(user: UserContext): Promise<ProductsRepo> {
  const supabase = await createClient();
  return new SupabaseProductsRepo(supabase, user);
}

async function defaultSettingsRepoFactory(user: UserContext): Promise<SettingsRepo> {
  const supabase = await createClient();
  return new SupabaseSettingsRepo(supabase, user);
}

async function defaultCategoriesRepoFactory(user: UserContext): Promise<CategoriesRepo> {
  const supabase = await createClient();
  return new SupabaseCategoriesRepo(supabase, user);
}

async function defaultAuditRepoFactory(user: UserContext): Promise<AuditRepo> {
  const supabase = await createClient();
  return new SupabaseAuditRepo(supabase, user);
}

function toUserContext(user: AuthenticatedUser): UserContext {
  return { id: user.id, role: user.role, active: user.isActive };
}

interface PreparedCsv {
  rows: ProductsCsvRow[];
  errors: ProductsCsvError[];
  totalRows: number;
}

async function prepareCsv(
  csv: string,
  user: UserContext,
  productsRepoFactory: (user: UserContext) => Promise<ProductsRepo>,
  categoriesRepoFactory: (user: UserContext) => Promise<CategoriesRepo>,
  settingsRepoFactory: (user: UserContext) => Promise<SettingsRepo>,
): Promise<PreparedCsv> {
  const [productsRepo, categoriesRepo, settingsRepo] = await Promise.all([
    productsRepoFactory(user),
    categoriesRepoFactory(user),
    settingsRepoFactory(user),
  ]);
  const [products, categories, publicSettings] = await Promise.all([
    productsRepo.list(),
    categoriesRepo.list(),
    settingsRepo.getPublicSettings(),
  ]);

  return parseProductsCsv(csv, {
    categories,
    existingBarcodes: products
      .map((product) => product.barcode)
      .filter((barcode): barcode is string => Boolean(barcode)),
    defaultMinStock: publicSettings.low_stock_default,
  });
}

export function createPreviewProductsCsvAction(deps: ProductsCsvActionDeps = {}) {
  const {
    currentUserResolver,
    productsRepoFactory = defaultProductsRepoFactory,
    categoriesRepoFactory = defaultCategoriesRepoFactory,
    settingsRepoFactory = defaultSettingsRepoFactory,
  } = deps;

  return async (input: ProductsCsvInput): Promise<ActionResult<ProductsCsvPreview>> => {
    return secureAction<ProductsCsvInput, ProductsCsvPreview>({
      roles: ["owner"],
      schema: productsCsvSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const parsed = await prepareCsv(
          validatedInput.csv,
          userContext,
          productsRepoFactory,
          categoriesRepoFactory,
          settingsRepoFactory,
        );

        return {
          totalRows: parsed.totalRows,
          validRows: parsed.rows.length,
          errors: parsed.errors,
          preview: parsed.rows.slice(0, 10).map((row) => ({
            line: row.line,
            name: row.name,
            categoryName: row.categoryName,
            priceCents: row.priceCents,
            stockQty: row.stockQty,
          })),
        };
      },
    })(input);
  };
}

export function createImportProductsCsvAction(deps: ProductsCsvActionDeps = {}) {
  const {
    currentUserResolver,
    productsRepoFactory = defaultProductsRepoFactory,
    categoriesRepoFactory = defaultCategoriesRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
    settingsRepoFactory = defaultSettingsRepoFactory,
  } = deps;

  return async (input: ProductsCsvInput): Promise<ActionResult<ImportProductsCsvResult>> => {
    return secureAction<ProductsCsvInput, ImportProductsCsvResult>({
      roles: ["owner"],
      schema: productsCsvSchema,
      currentUserResolver,
      audit: async (validatedInput, result, ctx) => {
        if (!result.ok || !ctx.user || result.data.imported === 0) return;
        try {
          const auditRepo = await auditRepoFactory(toUserContext(ctx.user));
          await auditRepo.write({
            action: "products.import_csv",
            entity: "products",
            summary: { imported: result.data.imported, totalRows: validatedInput.csv.length },
            reason: "Importación de productos desde CSV",
          });
        } catch {
          // La auditoría no debe romper la operación
        }
      },
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const parsed = await prepareCsv(
          validatedInput.csv,
          userContext,
          productsRepoFactory,
          categoriesRepoFactory,
          settingsRepoFactory,
        );

        if (parsed.errors.length > 0 || parsed.rows.length === 0) {
          return { imported: 0, errors: parsed.errors };
        }

        const repo = await productsRepoFactory(toUserContext(ctx.user));
        try {
          await repo.createMany(parsed.rows.map(toProductInsert));
        } catch (error) {
          return {
            imported: 0,
            errors: [
              {
                line: 0,
                message:
                  error instanceof Error
                    ? error.message
                    : "No se pudo importar el archivo. Intenta de nuevo.",
              },
            ],
          };
        }

        return { imported: parsed.rows.length, errors: [] };
      },
    })(input);
  };
}

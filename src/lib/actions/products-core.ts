import { normalizeSearchText } from "@/lib/domain/search";
import { SupabaseAuditRepo } from "@/lib/repos/supabase/audit";
import { SupabaseProductsRepo } from "@/lib/repos/supabase/products";
import type { AuditRepo, Product, ProductsRepo, UserContext } from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import {
  ActionException,
  type ActionResult,
  type AuthenticatedUser,
  secureAction,
} from "./secure-action";
import {
  type CreateProductInput,
  createProductSchema,
  type ListProductsInput,
  listProductsSchema,
  type SetProductActiveInput,
  setProductActiveSchema,
  type UpdateProductInput,
  updateProductSchema,
} from "./products-schema";

export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductsActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  productsRepoFactory?: (user: UserContext) => Promise<ProductsRepo>;
  auditRepoFactory?: (user: UserContext) => Promise<AuditRepo>;
}

async function defaultProductsRepoFactory(user: UserContext): Promise<ProductsRepo> {
  const supabase = await createClient();
  return new SupabaseProductsRepo(supabase, user);
}

async function defaultAuditRepoFactory(user: UserContext): Promise<AuditRepo> {
  const supabase = await createClient();
  return new SupabaseAuditRepo(supabase, user);
}

function toUserContext(user: AuthenticatedUser): UserContext {
  return { id: user.id, role: user.role, active: user.isActive };
}

function normalizeCode(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function duplicateBarcodeError(): ActionException {
  return new ActionException(
    "El código de barras ya está registrado en otro producto.",
    "CONFLICT",
  );
}

export function createListProductsAction(deps: ProductsActionDeps = {}) {
  const { currentUserResolver, productsRepoFactory = defaultProductsRepoFactory } = deps;

  return async (input: ListProductsInput = {}): Promise<ActionResult<ProductPage>> => {
    return secureAction<ListProductsInput, ProductPage>({
      roles: ["owner"],
      schema: listProductsSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const repo = await productsRepoFactory(toUserContext(ctx.user));
        let items = await repo.list({
          categoryId: validatedInput.categoryId,
        });

        const status = validatedInput.status ?? "all";
        if (status === "active") {
          items = items.filter((product) => product.active);
        } else if (status === "inactive") {
          items = items.filter((product) => !product.active);
        } else if (status === "low") {
          items = items.filter((product) => product.stock_qty <= product.min_stock);
        }

        const search = normalizeSearchText(validatedInput.search ?? "");
        if (search) {
          items = items.filter((product) => {
            const haystack = normalizeSearchText(
              [product.name, product.barcode ?? "", product.internal_code ?? ""].join(" "),
            );
            return haystack.includes(search);
          });
        }

        items.sort((a, b) => a.name.localeCompare(b.name, "es"));

        const pageSize = validatedInput.pageSize ?? 20;
        const total = items.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const page = Math.min(validatedInput.page ?? 1, totalPages);
        const start = (page - 1) * pageSize;

        return {
          items: items.slice(start, start + pageSize),
          total,
          page,
          pageSize,
          totalPages,
        };
      },
    })(input);
  };
}

export function createCreateProductAction(deps: ProductsActionDeps = {}) {
  const {
    currentUserResolver,
    productsRepoFactory = defaultProductsRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (input: CreateProductInput): Promise<ActionResult<Product>> => {
    return secureAction<CreateProductInput, Product>({
      roles: ["owner"],
      schema: createProductSchema,
      currentUserResolver,
      audit: async (validatedInput, result, ctx) => {
        if (!result.ok || !ctx.user) return;
        try {
          const auditRepo = await auditRepoFactory(toUserContext(ctx.user));
          await auditRepo.write({
            action: "products.create",
            entity: "products",
            entityId: result.data.id,
            summary: {
              name: result.data.name,
              barcode: result.data.barcode,
              priceCents: result.data.price_cents,
              stockQty: result.data.stock_qty,
            },
            reason: "Alta de producto por propietario",
          });
        } catch {
          // La auditoría no debe romper la operación
        }
      },
      handler: async (validatedInput, ctx) => {
        const repo = await productsRepoFactory(toUserContext(ctx.user));
        const barcode = normalizeCode(validatedInput.barcode);

        if (barcode) {
          const existing = await repo.getByBarcode(barcode);
          if (existing) throw duplicateBarcodeError();
        }

        return await repo.create({
          name: validatedInput.name,
          barcode: normalizeCode(validatedInput.barcode),
          internal_code: normalizeCode(validatedInput.internalCode),
          category_id: validatedInput.categoryId ?? null,
          unit_label: validatedInput.unitLabel ?? "unidad",
          price_cents: validatedInput.priceCents,
          cost_cents: validatedInput.costCents ?? null,
          stock_qty: validatedInput.stockQty ?? 0,
          min_stock: validatedInput.minStock ?? 5,
          active: validatedInput.active ?? true,
        });
      },
    })(input);
  };
}

export function createUpdateProductAction(deps: ProductsActionDeps = {}) {
  const {
    currentUserResolver,
    productsRepoFactory = defaultProductsRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (input: UpdateProductInput): Promise<ActionResult<Product>> => {
    return secureAction<UpdateProductInput, Product>({
      roles: ["owner"],
      schema: updateProductSchema,
      currentUserResolver,
      audit: async (validatedInput, result, ctx) => {
        if (!result.ok || !ctx.user) return;
        try {
          const auditRepo = await auditRepoFactory(toUserContext(ctx.user));
          await auditRepo.write({
            action: "products.update",
            entity: "products",
            entityId: result.data.id,
            summary: {
              changed: Object.keys(validatedInput).filter((key) => key !== "id"),
              priceCents: result.data.price_cents,
            },
            reason: "Edición de producto por propietario",
          });
        } catch {
          // La auditoría no debe romper la operación
        }
      },
      handler: async (validatedInput, ctx) => {
        const repo = await productsRepoFactory(toUserContext(ctx.user));
        const existing = await repo.getById(validatedInput.id);
        if (!existing) {
          throw new ActionException("Producto no encontrado.", "NOT_FOUND");
        }

        const barcode = normalizeCode(validatedInput.barcode);
        if (barcode && barcode !== existing.barcode) {
          const duplicate = await repo.getByBarcode(barcode);
          if (duplicate && duplicate.id !== existing.id) throw duplicateBarcodeError();
        }

        const changes: {
          name?: string;
          barcode?: string | null;
          internal_code?: string | null;
          category_id?: string | null;
          unit_label?: string;
          price_cents?: number;
          cost_cents?: number | null;
          min_stock?: number;
          active?: boolean;
        } = {};

        if (validatedInput.name !== undefined) changes.name = validatedInput.name;
        if (validatedInput.barcode !== undefined) {
          changes.barcode = normalizeCode(validatedInput.barcode);
        }
        if (validatedInput.internalCode !== undefined) {
          changes.internal_code = normalizeCode(validatedInput.internalCode);
        }
        if (validatedInput.categoryId !== undefined) {
          changes.category_id = validatedInput.categoryId;
        }
        if (validatedInput.unitLabel !== undefined) changes.unit_label = validatedInput.unitLabel;
        if (validatedInput.priceCents !== undefined) changes.price_cents = validatedInput.priceCents;
        if (validatedInput.costCents !== undefined) changes.cost_cents = validatedInput.costCents;
        if (validatedInput.minStock !== undefined) changes.min_stock = validatedInput.minStock;
        if (validatedInput.active !== undefined) changes.active = validatedInput.active;

        return await repo.update(existing.id, changes);
      },
    })(input);
  };
}

export function createSetProductActiveAction(deps: ProductsActionDeps = {}) {
  const {
    currentUserResolver,
    productsRepoFactory = defaultProductsRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (input: SetProductActiveInput): Promise<ActionResult<Product>> => {
    return secureAction<SetProductActiveInput, Product>({
      roles: ["owner"],
      schema: setProductActiveSchema,
      currentUserResolver,
      audit: async (validatedInput, result, ctx) => {
        if (!result.ok || !ctx.user) return;
        try {
          const auditRepo = await auditRepoFactory(toUserContext(ctx.user));
          await auditRepo.write({
            action: "products.set_active",
            entity: "products",
            entityId: validatedInput.id,
            summary: { active: validatedInput.active },
            reason: validatedInput.active
              ? "Activación de producto"
              : "Desactivación de producto",
          });
        } catch {
          // La auditoría no debe romper la operación
        }
      },
      handler: async (validatedInput, ctx) => {
        const repo = await productsRepoFactory(toUserContext(ctx.user));
        const existing = await repo.getById(validatedInput.id);
        if (!existing) {
          throw new ActionException("Producto no encontrado.", "NOT_FOUND");
        }
        return await repo.update(existing.id, { active: validatedInput.active });
      },
    })(input);
  };
}

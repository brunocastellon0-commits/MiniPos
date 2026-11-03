import { SupabaseProductsRepo } from "@/lib/repos/supabase/products";
import { SupabaseSalesRepo } from "@/lib/repos/supabase/sales";
import { SupabaseSettingsRepo } from "@/lib/repos/supabase/settings";
import { SupabaseUsersRepo } from "@/lib/repos/supabase/users";
import { laPazDayBoundsIso } from "@/lib/dates";
import type {
  BusinessPublicSettings,
  Product,
  ProductsRepo,
  Sale,
  SaleItem,
  SalesListFilter,
  SalesRepo,
  SettingsRepo,
  UserContext,
  UsersRepo,
} from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import {
  ActionException,
  type ActionResult,
  type AuthenticatedUser,
  secureAction,
} from "./secure-action";
import {
  type ConfirmSaleInput,
  confirmSaleSchema,
  type GetSaleDetailInput,
  getSaleDetailSchema,
  type GetSaleTicketInput,
  getSaleTicketSchema,
  type ListSalesInput,
  listSalesSchema,
  type VoidSaleInput,
  voidSaleSchema,
} from "./sales-schema";

export interface ConfirmSaleResult {
  sale: Sale;
  items: SaleItem[];
}

export interface SaleTicket {
  sale: Sale;
  items: SaleItem[];
  business: BusinessPublicSettings;
}

export interface ListSalesResult {
  sales: Sale[];
  cashierNames: Record<string, string>;
}

export interface SaleDetail {
  sale: Sale;
  items: SaleItem[];
  cashierName: string;
}

export interface SalesActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  salesRepoFactory?: (user: UserContext) => Promise<SalesRepo>;
  productsRepoFactory?: (user: UserContext) => Promise<ProductsRepo>;
  settingsRepoFactory?: (user: UserContext) => Promise<SettingsRepo>;
  usersRepoFactory?: (user: UserContext) => Promise<UsersRepo>;
}

async function defaultSalesRepoFactory(user: UserContext): Promise<SalesRepo> {
  const supabase = await createClient();
  return new SupabaseSalesRepo(supabase, user);
}

async function defaultProductsRepoFactory(user: UserContext): Promise<ProductsRepo> {
  const supabase = await createClient();
  return new SupabaseProductsRepo(supabase, user);
}

async function defaultSettingsRepoFactory(user: UserContext): Promise<SettingsRepo> {
  const supabase = await createClient();
  return new SupabaseSettingsRepo(supabase, user);
}

async function defaultUsersRepoFactory(user: UserContext): Promise<UsersRepo> {
  const supabase = await createClient();
  return new SupabaseUsersRepo(supabase, user);
}

function toUserContext(user: AuthenticatedUser): UserContext {
  return { id: user.id, role: user.role, active: user.isActive };
}

function translateSaleError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (/Stock insuficiente|sesi|efectivo|descuento|inactiv|no encontrado|producto/i.test(message)) {
    throw new ActionException(message, "BAD_REQUEST");
  }
  throw error;
}

export function createConfirmSaleAction(deps: SalesActionDeps = {}) {
  const {
    currentUserResolver,
    salesRepoFactory = defaultSalesRepoFactory,
    productsRepoFactory = defaultProductsRepoFactory,
    settingsRepoFactory = defaultSettingsRepoFactory,
  } = deps;

  return async (input: ConfirmSaleInput): Promise<ActionResult<ConfirmSaleResult>> => {
    return secureAction<ConfirmSaleInput, ConfirmSaleResult>({
      roles: ["owner", "cashier"],
      schema: confirmSaleSchema,
      currentUserResolver,
      rateLimit: {
        keyPrefix: "sales.confirm",
        maxRequests: 60,
        windowMs: 60_000,
      },
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const salesRepo = await salesRepoFactory(userContext);
        const productsRepo = await productsRepoFactory(userContext);

        const quantities = new Map<string, number>();
        for (const item of validatedInput.items) {
          quantities.set(
            item.productId,
            (quantities.get(item.productId) ?? 0) + item.quantity,
          );
        }

        let subtotalCents = 0;
        const itemsData: Array<{
          product_id: string;
          name_snapshot: string;
          unit_price_cents: number;
          quantity: number;
          line_total_cents: number;
        }> = [];

        for (const [productId, quantity] of quantities) {
          const product: Product | null = await productsRepo.getById(productId);
          if (!product) {
            throw new ActionException("Producto no encontrado.", "NOT_FOUND");
          }
          if (!product.active) {
            throw new ActionException(
              `El producto ${product.name} está inactivo.`,
              "BAD_REQUEST",
            );
          }

          const lineTotal = product.price_cents * quantity;
          subtotalCents += lineTotal;
          itemsData.push({
            product_id: product.id,
            name_snapshot: product.name,
            unit_price_cents: product.price_cents,
            quantity,
            line_total_cents: lineTotal,
          });
        }

        const discountCents = validatedInput.discountCents ?? 0;
        if (discountCents > subtotalCents) {
          throw new ActionException(
            "El descuento no puede superar el subtotal.",
            "BAD_REQUEST",
          );
        }
        // D-008: el dueño siempre; el cajero solo si cashier_can_discount está habilitado.
        if (discountCents > 0 && ctx.user.role !== "owner") {
          let cashierCanDiscount = false;
          try {
            const settingsRepo = await settingsRepoFactory(userContext);
            cashierCanDiscount = (await settingsRepo.getPublicSettings()).cashier_can_discount;
          } catch {
            cashierCanDiscount = false;
          }
          if (!cashierCanDiscount) {
            throw new ActionException(
              "Tu rol no tiene permiso para aplicar descuentos.",
              "FORBIDDEN",
            );
          }
        }
        const totalCents = subtotalCents - discountCents;

        let cashReceivedCents: number | null = null;
        if (validatedInput.paymentMethod === "cash") {
          if (
            validatedInput.cashReceivedCents === undefined ||
            validatedInput.cashReceivedCents < totalCents
          ) {
            throw new ActionException(
              "El efectivo recibido debe cubrir el total de la venta.",
              "BAD_REQUEST",
            );
          }
          cashReceivedCents = validatedInput.cashReceivedCents;
        }

        try {
          return await salesRepo.createSale(
            {
              session_id: validatedInput.sessionId,
              status: "paid",
              subtotal_cents: subtotalCents,
              discount_cents: discountCents,
              total_cents: totalCents,
              payment_method: validatedInput.paymentMethod,
              cash_received_cents: cashReceivedCents,
              client_request_id: validatedInput.clientRequestId,
            },
            itemsData,
          );
        } catch (error) {
          translateSaleError(error);
        }
      },
    })(input);
  };
}

export function createGetSaleTicketAction(deps: SalesActionDeps = {}) {
  const {
    currentUserResolver,
    salesRepoFactory = defaultSalesRepoFactory,
    settingsRepoFactory = defaultSettingsRepoFactory,
  } = deps;

  return async (input: GetSaleTicketInput): Promise<ActionResult<SaleTicket>> => {
    return secureAction<GetSaleTicketInput, SaleTicket>({
      roles: ["owner", "cashier"],
      schema: getSaleTicketSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const salesRepo = await salesRepoFactory(userContext);
        const settingsRepo = await settingsRepoFactory(userContext);

        const result = await salesRepo.getById(validatedInput.saleId);
        if (!result) {
          throw new ActionException("Venta no encontrada.", "NOT_FOUND");
        }

        const business = await settingsRepo.getPublicSettings();
        return { sale: result.sale, items: result.items, business };
      },
    })(input);
  };
}

export function createListSalesAction(deps: SalesActionDeps = {}) {
  const {
    currentUserResolver,
    salesRepoFactory = defaultSalesRepoFactory,
    usersRepoFactory = defaultUsersRepoFactory,
  } = deps;

  return async (input: ListSalesInput): Promise<ActionResult<ListSalesResult>> => {
    return secureAction<ListSalesInput, ListSalesResult>({
      roles: ["owner", "cashier"],
      schema: listSalesSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const salesRepo = await salesRepoFactory(userContext);

        const filter: SalesListFilter = {};
        if (validatedInput.dateFrom) {
          filter.dateFrom = laPazDayBoundsIso(validatedInput.dateFrom).start;
        }
        if (validatedInput.dateTo) {
          filter.dateTo = laPazDayBoundsIso(validatedInput.dateTo).end;
        }
        if (validatedInput.paymentMethod) filter.paymentMethod = validatedInput.paymentMethod;
        if (validatedInput.status) filter.status = validatedInput.status;
        if (validatedInput.limit) filter.limit = validatedInput.limit;
        // El cajero siempre lista solo las suyas, aunque envíe otro cashierId.
        filter.cashierId =
          ctx.user.role === "cashier" ? ctx.user.id : validatedInput.cashierId;

        const sales = await salesRepo.list(filter);

        let cashierNames: Record<string, string>;
        if (ctx.user.role === "owner") {
          const usersRepo = await usersRepoFactory(userContext);
          const profiles = await usersRepo.listProfiles();
          cashierNames = Object.fromEntries(profiles.map((profile) => [profile.id, profile.full_name]));
        } else {
          cashierNames = { [ctx.user.id]: ctx.user.name };
        }

        return { sales, cashierNames };
      },
    })(input);
  };
}

export function createGetSaleDetailAction(deps: SalesActionDeps = {}) {
  const {
    currentUserResolver,
    salesRepoFactory = defaultSalesRepoFactory,
    usersRepoFactory = defaultUsersRepoFactory,
  } = deps;

  return async (input: GetSaleDetailInput): Promise<ActionResult<SaleDetail>> => {
    return secureAction<GetSaleDetailInput, SaleDetail>({
      roles: ["owner", "cashier"],
      schema: getSaleDetailSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const salesRepo = await salesRepoFactory(userContext);

        const result = await salesRepo.getById(validatedInput.saleId);
        if (!result) {
          throw new ActionException("Venta no encontrada.", "NOT_FOUND");
        }

        let cashierName = ctx.user.name;
        if (ctx.user.role === "owner" && result.sale.cashier_id !== ctx.user.id) {
          const usersRepo = await usersRepoFactory(userContext);
          const profile = await usersRepo.getProfile(result.sale.cashier_id);
          cashierName = profile?.full_name ?? "—";
        }

        return { sale: result.sale, items: result.items, cashierName };
      },
    })(input);
  };
}

export function createVoidSaleAction(deps: SalesActionDeps = {}) {
  const { currentUserResolver, salesRepoFactory = defaultSalesRepoFactory } = deps;

  return async (input: VoidSaleInput): Promise<ActionResult<Sale>> => {
    return secureAction<VoidSaleInput, Sale>({
      roles: ["owner"],
      schema: voidSaleSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const salesRepo = await salesRepoFactory(toUserContext(ctx.user));

        const existing = await salesRepo.getById(validatedInput.saleId);
        if (!existing) {
          throw new ActionException("Venta no encontrada.", "NOT_FOUND");
        }

        // Idempotente: si ya está anulada, devuelve la venta tal cual.
        if (existing.sale.status === "voided") {
          return existing.sale;
        }

        return salesRepo.voidSale(validatedInput.saleId, validatedInput.reason);
      },
    })(input);
  };
}

import { SupabaseProductsRepo } from "@/lib/repos/supabase/products";
import { SupabaseSalesRepo } from "@/lib/repos/supabase/sales";
import { SupabaseSettingsRepo } from "@/lib/repos/supabase/settings";
import type {
  BusinessPublicSettings,
  Product,
  ProductsRepo,
  Sale,
  SaleItem,
  SalesRepo,
  SettingsRepo,
  UserContext,
} from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import {
  ActionException,
  type ActionResult,
  type AuthenticatedUser,
  secureAction,
} from "./secure-action";
import { type ConfirmSaleInput, confirmSaleSchema, type GetSaleTicketInput, getSaleTicketSchema } from "./sales-schema";

export interface ConfirmSaleResult {
  sale: Sale;
  items: SaleItem[];
}

export interface SaleTicket {
  sale: Sale;
  items: SaleItem[];
  business: BusinessPublicSettings;
}

export interface SalesActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  salesRepoFactory?: (user: UserContext) => Promise<SalesRepo>;
  productsRepoFactory?: (user: UserContext) => Promise<ProductsRepo>;
  settingsRepoFactory?: (user: UserContext) => Promise<SettingsRepo>;
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

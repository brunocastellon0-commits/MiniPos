import { SupabaseAuditRepo } from "@/lib/repos/supabase/audit";
import { SupabaseCashRepo } from "@/lib/repos/supabase/cash";
import { SupabaseOrdersRepo } from "@/lib/repos/supabase/orders";
import { SupabaseProductsRepo } from "@/lib/repos/supabase/products";
import { SupabaseSettingsRepo } from "@/lib/repos/supabase/settings";
import { SupabaseUsersRepo } from "@/lib/repos/supabase/users";
import { canTransitionOrder, isOrderChargeable } from "@/lib/domain/orders";
import type {
  AuditRepo,
  CashRepo,
  Order,
  OrderItem,
  OrdersRepo,
  ProductsRepo,
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
  type ChargeOrderInput,
  chargeOrderSchema,
  type CreateOrderInput,
  createOrderSchema,
  type GetOrderInput,
  getOrderSchema,
  type ListOrdersInput,
  listOrdersSchema,
  type UpdateOrderStatusInput,
  updateOrderStatusSchema,
} from "./orders-schema";

export interface CreateOrderResult {
  order: Order;
  items: OrderItem[];
  saleId: string | null;
}

export interface ListOrdersResult {
  orders: Order[];
  items: OrderItem[];
  cashierNames: Record<string, string>;
}

export interface GetOrderResult {
  order: Order;
  items: OrderItem[];
  createdByName: string | null;
}

export interface ChargeOrderResult {
  saleId: string;
  order: Order;
}

export interface OrdersActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  ordersRepoFactory?: (user: UserContext) => Promise<OrdersRepo>;
  cashRepoFactory?: (user: UserContext) => Promise<CashRepo>;
  productsRepoFactory?: (user: UserContext) => Promise<ProductsRepo>;
  settingsRepoFactory?: (user: UserContext) => Promise<SettingsRepo>;
  usersRepoFactory?: (user: UserContext) => Promise<UsersRepo>;
  auditRepoFactory?: (user: UserContext) => Promise<AuditRepo>;
}

async function defaultOrdersRepoFactory(user: UserContext): Promise<OrdersRepo> {
  const supabase = await createClient();
  return new SupabaseOrdersRepo(supabase, user);
}

async function defaultCashRepoFactory(user: UserContext): Promise<CashRepo> {
  const supabase = await createClient();
  return new SupabaseCashRepo(supabase, user);
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

async function defaultAuditRepoFactory(user: UserContext): Promise<AuditRepo> {
  const supabase = await createClient();
  return new SupabaseAuditRepo(supabase, user);
}

function toUserContext(user: AuthenticatedUser): UserContext {
  return { id: user.id, role: user.role, active: user.isActive };
}

function translateOrderError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (/pedido|sesi|stock|efectivo|producto|inactiv|no encontrado/i.test(message)) {
    throw new ActionException(message, "BAD_REQUEST");
  }
  throw error;
}

export function createCreateOrderAction(deps: OrdersActionDeps = {}) {
  const {
    currentUserResolver,
    ordersRepoFactory = defaultOrdersRepoFactory,
    cashRepoFactory = defaultCashRepoFactory,
    productsRepoFactory = defaultProductsRepoFactory,
    settingsRepoFactory = defaultSettingsRepoFactory,
  } = deps;

  return async (input: CreateOrderInput): Promise<ActionResult<CreateOrderResult>> => {
    return secureAction<CreateOrderInput, CreateOrderResult>({
      roles: ["owner", "cashier"],
      schema: createOrderSchema,
      currentUserResolver,
      rateLimit: {
        keyPrefix: "orders.create",
        maxRequests: 30,
        windowMs: 60_000,
      },
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const settingsRepo = await settingsRepoFactory(userContext);
        const settings = await settingsRepo.getPublicSettings();
        if (settings.operating_mode !== "restaurant") {
          throw new ActionException(
            "La modalidad del negocio no es restaurante.",
            "BAD_REQUEST",
          );
        }

        const cashRepo = await cashRepoFactory(userContext);
        const session = await cashRepo.getCurrentSession();
        if (!session) {
          throw new ActionException("No hay turno de caja abierto.", "BAD_REQUEST");
        }

        const quantities = new Map<string, number>();
        for (const item of validatedInput.items) {
          quantities.set(
            item.productId,
            (quantities.get(item.productId) ?? 0) + item.quantity,
          );
        }

        const productsRepo = await productsRepoFactory(userContext);
        const fetchedProducts = await productsRepo.getByIds([...quantities.keys()]);
        const productsById = new Map(fetchedProducts.map((product) => [product.id, product]));

        let subtotalCents = 0;
        for (const [productId, quantity] of quantities) {
          const product = productsById.get(productId) ?? null;
          if (!product) {
            throw new ActionException("Producto no encontrado.", "NOT_FOUND");
          }
          if (!product.active) {
            throw new ActionException(
              `El producto ${product.name} está inactivo.`,
              "BAD_REQUEST",
            );
          }
          subtotalCents += product.price_cents * quantity;
        }

        const timing = settings.order_charge_timing;
        let paymentMethod: "cash" | "qr" | "card" | null = null;
        let cashReceivedCents: number | null = null;
        if (timing === "on_order") {
          if (!validatedInput.paymentMethod) {
            throw new ActionException("Selecciona el método de pago.", "BAD_REQUEST");
          }
          paymentMethod = validatedInput.paymentMethod;
          if (paymentMethod === "cash") {
            if (
              validatedInput.cashReceivedCents === undefined ||
              validatedInput.cashReceivedCents < subtotalCents
            ) {
              throw new ActionException(
                "El efectivo recibido debe cubrir el total del pedido.",
                "BAD_REQUEST",
              );
            }
            cashReceivedCents = validatedInput.cashReceivedCents;
          }
        }

        const ordersRepo = await ordersRepoFactory(userContext);
        let created: { order: Order; items: OrderItem[] };
        try {
          created = await ordersRepo.createOrder({
            sessionId: session.id,
            items: [...quantities].map(([productId, quantity]) => ({
              productId,
              quantity,
            })),
            notes: validatedInput.notes ?? null,
          });
        } catch (error) {
          translateOrderError(error);
        }

        if (timing === "on_order" && paymentMethod) {
          try {
            const charged = await ordersRepo.chargeOrder({
              orderId: created.order.id,
              paymentMethod,
              clientRequestId: validatedInput.clientRequestId ?? crypto.randomUUID(),
              cashReceivedCents,
            });
            return { order: charged.order, items: created.items, saleId: charged.saleId };
          } catch (error) {
            translateOrderError(error);
          }
        }

        return { order: created.order, items: created.items, saleId: null };
      },
    })(input);
  };
}

export function createListOrdersAction(deps: OrdersActionDeps = {}) {
  const {
    currentUserResolver,
    ordersRepoFactory = defaultOrdersRepoFactory,
    cashRepoFactory = defaultCashRepoFactory,
    usersRepoFactory = defaultUsersRepoFactory,
  } = deps;

  return async (input: ListOrdersInput): Promise<ActionResult<ListOrdersResult>> => {
    return secureAction<ListOrdersInput, ListOrdersResult>({
      roles: ["owner", "cashier"],
      schema: listOrdersSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const cashRepo = await cashRepoFactory(userContext);
        const session = await cashRepo.getCurrentSession();
        if (!session) {
          return { orders: [], items: [], cashierNames: {} };
        }

        const ordersRepo = await ordersRepoFactory(userContext);
        const orders = await ordersRepo.list({
          sessionId: session.id,
          status: validatedInput.status,
          limit: validatedInput.limit ?? 100,
        });
        const items =
          orders.length > 0
            ? await ordersRepo.listItemsForOrders(orders.map((order) => order.id))
            : [];

        const cashierNames: Record<string, string> =
          ctx.user.role === "owner"
            ? await (async () => {
                const usersRepo = await usersRepoFactory(userContext);
                const profiles = await usersRepo.listProfiles();
                return Object.fromEntries(
                  profiles.map((profile) => [profile.id, profile.full_name]),
                );
              })()
            : { [ctx.user.id]: ctx.user.name };

        return { orders, items, cashierNames };
      },
    })(input);
  };
}

export function createGetOrderAction(deps: OrdersActionDeps = {}) {
  const {
    currentUserResolver,
    ordersRepoFactory = defaultOrdersRepoFactory,
    usersRepoFactory = defaultUsersRepoFactory,
  } = deps;

  return async (input: GetOrderInput): Promise<ActionResult<GetOrderResult>> => {
    return secureAction<GetOrderInput, GetOrderResult>({
      roles: ["owner", "cashier"],
      schema: getOrderSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const ordersRepo = await ordersRepoFactory(userContext);
        const found = await ordersRepo.getById(validatedInput.orderId);
        if (!found) {
          throw new ActionException("Pedido no encontrado.", "NOT_FOUND");
        }

        let createdByName: string | null = null;
        if (found.order.created_by === ctx.user.id) {
          createdByName = ctx.user.name;
        } else if (ctx.user.role === "owner") {
          const usersRepo = await usersRepoFactory(userContext);
          const profile = await usersRepo.getProfile(found.order.created_by);
          createdByName = profile?.full_name ?? null;
        }

        return { order: found.order, items: found.items, createdByName };
      },
    })(input);
  };
}

export function createUpdateOrderStatusAction(deps: OrdersActionDeps = {}) {
  const {
    currentUserResolver,
    ordersRepoFactory = defaultOrdersRepoFactory,
    auditRepoFactory = defaultAuditRepoFactory,
  } = deps;

  return async (input: UpdateOrderStatusInput): Promise<ActionResult<Order>> => {
    return secureAction<UpdateOrderStatusInput, Order>({
      roles: ["owner", "cashier"],
      schema: updateOrderStatusSchema,
      currentUserResolver,
      rateLimit: {
        keyPrefix: "orders.status",
        maxRequests: 60,
        windowMs: 60_000,
      },
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const ordersRepo = await ordersRepoFactory(userContext);
        const found = await ordersRepo.getById(validatedInput.orderId);
        if (!found) {
          throw new ActionException("Pedido no encontrado.", "NOT_FOUND");
        }

        const from = found.order.status;
        if (!canTransitionOrder(from, validatedInput.status, found.order.payment_status)) {
          throw new ActionException(
            "Ese cambio de estado no está permitido para este pedido.",
            "BAD_REQUEST",
          );
        }

        let order: Order;
        try {
          order = await ordersRepo.updateStatus(validatedInput.orderId, validatedInput.status);
        } catch (error) {
          translateOrderError(error);
        }

        const auditRepo = await auditRepoFactory(userContext);
        await auditRepo.write({
          action: "order.status_changed",
          entity: "order",
          entityId: order.id,
          summary: { from, to: order.status },
          reason: validatedInput.reason
            ? validatedInput.reason
            : "Cambio de estado del pedido",
        });

        return order;
      },
    })(input);
  };
}

export function createChargeOrderAction(deps: OrdersActionDeps = {}) {
  const {
    currentUserResolver,
    ordersRepoFactory = defaultOrdersRepoFactory,
  } = deps;

  return async (input: ChargeOrderInput): Promise<ActionResult<ChargeOrderResult>> => {
    return secureAction<ChargeOrderInput, ChargeOrderResult>({
      roles: ["owner", "cashier"],
      schema: chargeOrderSchema,
      currentUserResolver,
      rateLimit: {
        keyPrefix: "orders.charge",
        maxRequests: 30,
        windowMs: 60_000,
      },
      handler: async (validatedInput, ctx) => {
        const userContext = toUserContext(ctx.user);
        const ordersRepo = await ordersRepoFactory(userContext);
        const found = await ordersRepo.getById(validatedInput.orderId);
        if (!found) {
          throw new ActionException("Pedido no encontrado.", "NOT_FOUND");
        }

        if (found.order.payment_status === "pagado" && found.order.sale_id) {
          return { saleId: found.order.sale_id, order: found.order };
        }
        if (!isOrderChargeable(found.order.status, found.order.payment_status)) {
          throw new ActionException(
            "No se puede cobrar un pedido cancelado.",
            "BAD_REQUEST",
          );
        }

        let cashReceivedCents: number | null = null;
        if (validatedInput.paymentMethod === "cash") {
          if (
            validatedInput.cashReceivedCents === undefined ||
            validatedInput.cashReceivedCents < found.order.total_cents
          ) {
            throw new ActionException(
              "El efectivo recibido debe cubrir el total del pedido.",
              "BAD_REQUEST",
            );
          }
          cashReceivedCents = validatedInput.cashReceivedCents;
        }

        try {
          const charged = await ordersRepo.chargeOrder({
            orderId: validatedInput.orderId,
            paymentMethod: validatedInput.paymentMethod,
            clientRequestId: validatedInput.clientRequestId,
            cashReceivedCents,
          });
          return { saleId: charged.saleId, order: charged.order };
        } catch (error) {
          translateOrderError(error);
        }
      },
    })(input);
  };
}

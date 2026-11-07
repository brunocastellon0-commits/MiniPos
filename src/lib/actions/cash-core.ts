import { z } from "zod";
import {
  expectedCashCents,
  summarizeSalesByPayment,
  type SalesByPayment,
} from "@/lib/domain/cash";
import { SupabaseCashRepo } from "@/lib/repos/supabase/cash";
import { SupabaseSalesRepo } from "@/lib/repos/supabase/sales";
import type {
  CashMovement,
  CashRepo,
  CashSession,
  OpenCashSessionPublic,
  Sale,
  SalesRepo,
  UserContext,
} from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import {
  ActionException,
  type ActionResult,
  type AuthenticatedUser,
  secureAction,
} from "./secure-action";
import {
  type AddCashMovementInput,
  addCashMovementSchema,
  type CloseCashSessionInput,
  closeCashSessionSchema,
  type ListCashSessionsInput,
  listCashSessionsSchema,
  type OpenCashSessionInput,
  openCashSessionSchema,
} from "./cash-schema";

export interface CashOverview {
  session: CashSession;
  openedByName: string;
  movements: CashMovement[];
  sales: Sale[];
  payments: SalesByPayment;
  expectedCents: number;
}

export interface CashActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  cashRepoFactory?: (user: UserContext) => Promise<CashRepo>;
  salesRepoFactory?: (user: UserContext) => Promise<SalesRepo>;
}

async function defaultCashRepoFactory(user: UserContext): Promise<CashRepo> {
  const supabase = await createClient();
  return new SupabaseCashRepo(supabase, user);
}

async function defaultSalesRepoFactory(user: UserContext): Promise<SalesRepo> {
  const supabase = await createClient();
  return new SupabaseSalesRepo(supabase, user);
}

function toUserContext(user: AuthenticatedUser): UserContext {
  return { id: user.id, role: user.role, active: user.isActive };
}

function translateCashError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (
    /Ya existe|supera el efectivo|ya se encuentra cerrada|no puede ser negativo|no encontrad|inexistente|obligatorio/i.test(
      message,
    )
  ) {
    throw new ActionException(message, "BAD_REQUEST");
  }
  throw error;
}

const emptyInputSchema = z.object({}).strict().optional().default({});

export function createGetCashOverviewAction(deps: CashActionDeps = {}) {
  const {
    currentUserResolver,
    cashRepoFactory = defaultCashRepoFactory,
    salesRepoFactory = defaultSalesRepoFactory,
  } = deps;

  return async (): Promise<ActionResult<CashOverview | null>> => {
    return secureAction<Record<string, never>, CashOverview | null>({
      roles: ["owner", "cashier"],
      schema: emptyInputSchema,
      currentUserResolver,
      handler: async (_input, ctx) => {
        const userContext = toUserContext(ctx.user);
        const cashRepo = await cashRepoFactory(userContext);
        const session = await cashRepo.getCurrentSession();
        if (!session) return null;

        const [openInfo, movements, sales] = await Promise.all([
          cashRepo.getOpenSessionPublic(),
          cashRepo.listMovements(session.id),
          (
            await salesRepoFactory(userContext)
          ).list({ sessionId: session.id }),
        ]);

        return {
          session,
          openedByName: openInfo?.opened_by_name ?? "Usuario",
          movements,
          sales,
          payments: summarizeSalesByPayment(sales),
          expectedCents: expectedCashCents({
            openingCents: session.opening_cents,
            sales,
            movements,
          }),
        };
      },
    })({});
  };
}

export function createGetCashSessionDetailAction(deps: CashActionDeps = {}) {
  const {
    currentUserResolver,
    cashRepoFactory = defaultCashRepoFactory,
    salesRepoFactory = defaultSalesRepoFactory,
  } = deps;

  return async (input: { sessionId: string }): Promise<ActionResult<CashOverview | null>> => {
    return secureAction<{ sessionId: string }, CashOverview | null>({
      roles: ["owner", "cashier"],
      schema: z.object({ sessionId: z.string().uuid() }),
      currentUserResolver,
      handler: async ({ sessionId }, ctx) => {
        const userContext = toUserContext(ctx.user);
        const [cashRepo, salesRepo] = await Promise.all([
          cashRepoFactory(userContext),
          salesRepoFactory(userContext),
        ]);
        const session = await cashRepo.getSessionById(sessionId);
        if (!session) return null;

        const [movements, sales] = await Promise.all([
          cashRepo.listMovements(session.id),
          salesRepo.list({ sessionId: session.id }),
        ]);

        return {
          session,
          openedByName: "Personal",
          movements,
          sales,
          payments: summarizeSalesByPayment(sales),
          expectedCents: expectedCashCents({
            openingCents: session.opening_cents,
            sales,
            movements,
          }),
        };
      },
    })(input);
  };
}

export function createGetOpenCashSessionAction(deps: CashActionDeps = {}) {
  const { currentUserResolver, cashRepoFactory = defaultCashRepoFactory } = deps;

  return async (): Promise<ActionResult<OpenCashSessionPublic | null>> => {
    return secureAction<Record<string, never>, OpenCashSessionPublic | null>({
      roles: ["owner", "cashier"],
      schema: emptyInputSchema,
      currentUserResolver,
      handler: async (_input, ctx) => {
        const repo = await cashRepoFactory(toUserContext(ctx.user));
        return await repo.getOpenSessionPublic();
      },
    })({});
  };
}

export function createOpenCashSessionAction(deps: CashActionDeps = {}) {
  const { currentUserResolver, cashRepoFactory = defaultCashRepoFactory } = deps;

  return async (input: OpenCashSessionInput): Promise<ActionResult<CashSession>> => {
    return secureAction<OpenCashSessionInput, CashSession>({
      roles: ["owner", "cashier"],
      schema: openCashSessionSchema,
      currentUserResolver,
      rateLimit: {
        keyPrefix: "cash.open",
        maxRequests: 10,
        windowMs: 60_000,
      },
      handler: async (validatedInput, ctx) => {
        const repo = await cashRepoFactory(toUserContext(ctx.user));
        try {
          return await repo.openSession(validatedInput.openingCents, validatedInput.notes);
        } catch (error) {
          translateCashError(error);
        }
      },
    })(input);
  };
}

export function createAddCashMovementAction(deps: CashActionDeps = {}) {
  const { currentUserResolver, cashRepoFactory = defaultCashRepoFactory } = deps;

  return async (input: AddCashMovementInput): Promise<ActionResult<CashMovement>> => {
    return secureAction<AddCashMovementInput, CashMovement>({
      roles: ["owner", "cashier"],
      schema: addCashMovementSchema,
      currentUserResolver,
      rateLimit: {
        keyPrefix: "cash.movement",
        maxRequests: 60,
        windowMs: 60_000,
      },
      handler: async (validatedInput, ctx) => {
        const repo = await cashRepoFactory(toUserContext(ctx.user));
        try {
          return await repo.addMovement({
            sessionId: validatedInput.sessionId,
            kind: validatedInput.kind,
            amountCents: validatedInput.amountCents,
            reason: validatedInput.reason,
          });
        } catch (error) {
          translateCashError(error);
        }
      },
    })(input);
  };
}

export function createCloseCashSessionAction(deps: CashActionDeps = {}) {
  const { currentUserResolver, cashRepoFactory = defaultCashRepoFactory } = deps;

  return async (input: CloseCashSessionInput): Promise<ActionResult<CashSession>> => {
    return secureAction<CloseCashSessionInput, CashSession>({
      roles: ["owner", "cashier"],
      schema: closeCashSessionSchema,
      currentUserResolver,
      rateLimit: {
        keyPrefix: "cash.close",
        maxRequests: 10,
        windowMs: 60_000,
      },
      handler: async (validatedInput, ctx) => {
        const repo = await cashRepoFactory(toUserContext(ctx.user));
        const session = await repo.getSessionById(validatedInput.sessionId);
        if (!session) {
          throw new ActionException("Turno de caja no encontrado.", "NOT_FOUND");
        }
        if (session.status !== "open") {
          throw new ActionException("La sesión de caja ya se encuentra cerrada.", "BAD_REQUEST");
        }
        try {
          return await repo.closeSession(
            validatedInput.sessionId,
            validatedInput.countedCents,
            validatedInput.notes,
          );
        } catch (error) {
          translateCashError(error);
        }
      },
    })(input);
  };
}

export function createListCashSessionsAction(deps: CashActionDeps = {}) {
  const { currentUserResolver, cashRepoFactory = defaultCashRepoFactory } = deps;

  return async (
    input: ListCashSessionsInput = {},
  ): Promise<ActionResult<CashSession[]>> => {
    return secureAction<ListCashSessionsInput, CashSession[]>({
      roles: ["owner", "cashier"],
      schema: listCashSessionsSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const repo = await cashRepoFactory(toUserContext(ctx.user));
        return await repo.listSessions(validatedInput.limit);
      },
    })(input);
  };
}

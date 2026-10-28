import { describe, expect, it } from "vitest";
import { z } from "zod";
import { secureAction } from "@/lib/actions/secure-action";

describe("Validación segura de entrada y Zod .strict()", () => {
  const dummyUser = {
    id: "user-123",
    email: "test@lilamarket.bo",
    name: "Dueño",
    role: "owner" as const,
    isActive: true,
  };

  const createDummyAction = <TInput, TOutput>(
    schema: z.ZodType<TInput>,
    handler: (data: TInput) => Promise<TOutput> = async (d) => d as unknown as TOutput,
  ) =>
    secureAction({
      roles: ["owner", "cashier"],
      currentUserResolver: async () => dummyUser,
      schema,
      handler: async (input) => handler(input),
    });

  it("rechaza campos inyectados no permitidos (ej. role, user_id, cashier_id) incluso si el schema no usó .strict()", async () => {
    // Schema sin .strict() explícito
    const schema = z.object({
      product_name: z.string().min(1),
      price_cents: z.number().int().positive(),
    });

    const action = createDummyAction(schema);

    // Payload con intento de inyección de rol y user_id
    const payloadWithInjections = {
      product_name: "Coca Cola 2L",
      price_cents: 1200,
      role: "owner",
      user_id: "injected-admin-id",
      cashier_id: "injected-cashier",
      is_admin: true,
    };

    const result = await action(
      payloadWithInjections as unknown as {
        product_name: string;
        price_cents: number;
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.message).toBe("Los datos proporcionados no son válidos.");
    }
  });

  it("rechaza montos negativos o valores no enteros en centavos", async () => {
    const moneySchema = z.object({
      amount_cents: z.number().int().positive(),
    });

    const action = createDummyAction(moneySchema);

    // Negativo
    const resNegative = await action({ amount_cents: -500 });
    expect(resNegative.ok).toBe(false);
    if (!resNegative.ok) {
      expect(resNegative.code).toBe("VALIDATION_ERROR");
      expect(resNegative.errors?.amount_cents).toBeDefined();
    }

    // Decimal (flotante)
    const resFloat = await action({ amount_cents: 45.5 as unknown as number });
    expect(resFloat.ok).toBe(false);
    if (!resFloat.ok) {
      expect(resFloat.code).toBe("VALIDATION_ERROR");
    }
  });

  it("rechaza cadenas vacías o compuestas únicamente de espacios en blanco", async () => {
    const textSchema = z.object({
      category_name: z.string().trim().min(1, { message: "El nombre no puede estar vacío" }),
    });

    const action = createDummyAction(textSchema);

    const result = await action({ category_name: "    " });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.errors?.category_name).toBeDefined();
    }
  });

  it("rechaza cadenas que superen la longitud máxima de seguridad", async () => {
    const limitedSchema = z.object({
      description: z.string().max(100),
    });

    const action = createDummyAction(limitedSchema);

    const oversizedString = "A".repeat(101);
    const result = await action({ description: oversizedString });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.errors?.description).toBeDefined();
    }
  });

  it("rechaza payload si faltan campos obligatorios", async () => {
    const requiredSchema = z.object({
      name: z.string().min(1),
      barcode: z.string().min(1),
    });

    const action = createDummyAction(requiredSchema);

    // Falta barcode
    const result = await action({ name: "Galletas" } as unknown as {
      name: string;
      barcode: string;
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.errors?.barcode).toBeDefined();
    }
  });

  it("permite payload válido, limpia espacios con trim y entrega datos tipados al handler", async () => {
    const validSchema = z.object({
      name: z.string().trim().min(1),
      cost_cents: z.number().int().nonnegative(),
    });

    const action = secureAction({
      roles: ["owner"],
      currentUserResolver: async () => dummyUser,
      schema: validSchema,
      handler: async (input) => {
        return { created: true, name: input.name, cost: input.cost_cents };
      },
    });

    const result = await action({
      name: "  Arroz Grano de Oro 1kg  ",
      cost_cents: 750,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        created: true,
        name: "Arroz Grano de Oro 1kg",
        cost: 750,
      });
    }
  });
});

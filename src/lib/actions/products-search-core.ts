import { z } from "zod";
import { searchProducts } from "@/lib/domain/search";
import { SupabaseProductsRepo } from "@/lib/repos/supabase/products";
import type { Product, ProductsRepo, UserContext } from "@/lib/repos/types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, type AuthenticatedUser, secureAction } from "./secure-action";
import {
  type ListPosProductsInput,
  listPosProductsSchema,
  type SearchPosProductsInput,
  searchPosProductsSchema,
} from "./products-search-schema";

const getProductsByIdsSchema = z
  .object({
    ids: z
      .array(z.string().min(1, { message: "ID de producto requerido." }))
      .min(1, { message: "Debe indicar al menos un producto." })
      .max(200, { message: "Máximo 200 productos por consulta." }),
  })
  .strict();

type GetProductsByIdsInput = z.infer<typeof getProductsByIdsSchema>;

export interface ProductsSearchActionDeps {
  currentUserResolver?: () => Promise<AuthenticatedUser | null>;
  productsRepoFactory?: (user: UserContext) => Promise<ProductsRepo>;
}

async function defaultProductsRepoFactory(user: UserContext): Promise<ProductsRepo> {
  const supabase = await createClient();
  return new SupabaseProductsRepo(supabase, user);
}

function toUserContext(user: AuthenticatedUser): UserContext {
  return { id: user.id, role: user.role, active: user.isActive };
}

export function createSearchPosProductsAction(deps: ProductsSearchActionDeps = {}) {
  const { currentUserResolver, productsRepoFactory = defaultProductsRepoFactory } = deps;

  return async (input: SearchPosProductsInput): Promise<ActionResult<Product[]>> => {
    return secureAction<SearchPosProductsInput, Product[]>({
      roles: ["owner", "cashier"],
      schema: searchPosProductsSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const repo = await productsRepoFactory(toUserContext(ctx.user));
        const limit = validatedInput.limit ?? 20;

        const exact = await repo.getByBarcode(validatedInput.query);
        if (exact && exact.active) {
          const rest = await repo.list({ activeOnly: true });
          return [
            exact,
            ...searchProducts(
              rest.filter((product) => product.id !== exact.id),
              validatedInput.query,
              Math.max(0, limit - 1),
            ),
          ];
        }

        const products = await repo.list({ activeOnly: true });
        return searchProducts(products, validatedInput.query, limit);
      },
    })(input);
  };
}

export function createListPosProductsAction(deps: ProductsSearchActionDeps = {}) {
  const { currentUserResolver, productsRepoFactory = defaultProductsRepoFactory } = deps;

  return async (input: ListPosProductsInput = {}): Promise<ActionResult<Product[]>> => {
    return secureAction<ListPosProductsInput, Product[]>({
      roles: ["owner", "cashier"],
      schema: listPosProductsSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const repo = await productsRepoFactory(toUserContext(ctx.user));
        const products = await repo.list({ activeOnly: true });
        const limit = validatedInput.limit ?? 200;
        return products.slice(0, limit);
      },
    })(input);
  };
}

export function createGetProductsByIdsAction(deps: ProductsSearchActionDeps = {}) {
  const { currentUserResolver, productsRepoFactory = defaultProductsRepoFactory } = deps;

  return async (input: GetProductsByIdsInput): Promise<ActionResult<Product[]>> => {
    return secureAction<GetProductsByIdsInput, Product[]>({
      roles: ["owner", "cashier"],
      schema: getProductsByIdsSchema,
      currentUserResolver,
      handler: async (validatedInput, ctx) => {
        const repo = await productsRepoFactory(toUserContext(ctx.user));
        const uniqueIds = [...new Set(validatedInput.ids)];
        const products: Product[] = [];
        for (const id of uniqueIds) {
          const product = await repo.getById(id);
          if (product && product.active) products.push(product);
        }
        return products;
      },
    })(input);
  };
}

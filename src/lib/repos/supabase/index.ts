import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Repositories, UserContext } from "../types";
import { SupabaseProductsRepo } from "./products";
import { SupabaseCategoriesRepo } from "./categories";
import { SupabaseCashRepo } from "./cash";
import { SupabaseSalesRepo } from "./sales";
import { SupabaseOrdersRepo } from "./orders";
import { SupabaseInventoryRepo } from "./inventory";
import { SupabasePurchasesRepo } from "./purchases";
import { SupabaseSuppliersRepo } from "./suppliers";
import { SupabaseUsersRepo } from "./users";
import { SupabaseSettingsRepo } from "./settings";
import { SupabaseAuditRepo } from "./audit";

export function createSupabaseRepositories(
  supabase: SupabaseClient<Database>,
  user: UserContext,
): Repositories {
  return {
    products: new SupabaseProductsRepo(supabase, user),
    categories: new SupabaseCategoriesRepo(supabase, user),
    cash: new SupabaseCashRepo(supabase, user),
    sales: new SupabaseSalesRepo(supabase, user),
    orders: new SupabaseOrdersRepo(supabase, user),
    inventory: new SupabaseInventoryRepo(supabase, user),
    purchases: new SupabasePurchasesRepo(supabase, user),
    suppliers: new SupabaseSuppliersRepo(supabase, user),
    users: new SupabaseUsersRepo(supabase, user),
    settings: new SupabaseSettingsRepo(supabase, user),
    audit: new SupabaseAuditRepo(supabase, user),
  };
}

import type { Repositories, UserContext } from "../types";
import { MemoryStore } from "./memory-store";
import { MemoryProductsRepo } from "./products";
import { MemoryCategoriesRepo } from "./categories";
import { MemoryCashRepo } from "./cash";
import { MemorySalesRepo } from "./sales";
import { MemoryOrdersRepo } from "./orders";
import { MemoryInventoryRepo } from "./inventory";
import { MemoryPurchasesRepo } from "./purchases";
import { MemorySuppliersRepo } from "./suppliers";
import { MemoryUsersRepo } from "./users";
import { MemorySettingsRepo } from "./settings";
import { MemoryAuditRepo } from "./audit";

export { MemoryStore };

export function createMemoryRepositories(store: MemoryStore, user: UserContext): Repositories {
  return {
    products: new MemoryProductsRepo(store, user),
    categories: new MemoryCategoriesRepo(store, user),
    cash: new MemoryCashRepo(store, user),
    sales: new MemorySalesRepo(store, user),
    orders: new MemoryOrdersRepo(store, user),
    inventory: new MemoryInventoryRepo(store, user),
    purchases: new MemoryPurchasesRepo(store, user),
    suppliers: new MemorySuppliersRepo(store, user),
    users: new MemoryUsersRepo(store, user),
    settings: new MemorySettingsRepo(store, user),
    audit: new MemoryAuditRepo(store, user),
  };
}

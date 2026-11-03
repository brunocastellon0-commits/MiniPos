"use server";

import { createListInventoryProductsAction, createListStockMovementsAction } from "./inventory-core";
import type { ListStockMovementsInput } from "./inventory-schema";

const listInventoryProductsInternal = createListInventoryProductsAction();
const listStockMovementsInternal = createListStockMovementsAction();

export async function listInventoryProductsAction() {
  return listInventoryProductsInternal();
}

export async function listStockMovementsAction(input: ListStockMovementsInput) {
  return listStockMovementsInternal(input);
}

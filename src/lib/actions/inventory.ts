"use server";

import {
  createAdjustStockAction,
  createListInventoryProductsAction,
  createListStockMovementsAction,
} from "./inventory-core";
import type { AdjustStockInput, ListStockMovementsInput } from "./inventory-schema";

const listInventoryProductsInternal = createListInventoryProductsAction();
const listStockMovementsInternal = createListStockMovementsAction();
const adjustStockInternal = createAdjustStockAction();

export async function listInventoryProductsAction() {
  return listInventoryProductsInternal();
}

export async function listStockMovementsAction(input: ListStockMovementsInput) {
  return listStockMovementsInternal(input);
}

export async function adjustStockAction(input: AdjustStockInput) {
  return adjustStockInternal(input);
}

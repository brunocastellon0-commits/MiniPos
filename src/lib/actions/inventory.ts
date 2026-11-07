"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import {
  createAdjustStockAction,
  createCountLowStockAction,
  createListInventoryProductsAction,
  createListStockMovementsAction,
} from "./inventory-core";
import type { AdjustStockInput, ListStockMovementsInput } from "./inventory-schema";

const listInventoryProductsInternal = createListInventoryProductsAction();
const countLowStockInternal = createCountLowStockAction();
const listStockMovementsInternal = createListStockMovementsAction();
const adjustStockInternal = createAdjustStockAction();

export async function listInventoryProductsAction() {
  return listInventoryProductsInternal();
}

export const countLowStockAction = cache(async function countLowStockAction() {
  return countLowStockInternal();
});

export async function listStockMovementsAction(input: ListStockMovementsInput) {
  return listStockMovementsInternal(input);
}

export async function adjustStockAction(input: AdjustStockInput) {
  const res = await adjustStockInternal(input);
  if (res.ok) {
    revalidatePath("/inventario");
    revalidatePath("/caja");
    revalidatePath("/panel");
  }
  return res;
}

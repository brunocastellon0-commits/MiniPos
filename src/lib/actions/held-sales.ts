"use server";

import {
  createDeleteHeldSaleAction,
  createListHeldSalesAction,
  createSaveHeldSaleAction,
} from "./held-sales-core";
import type { DeleteHeldSaleInput, SaveHeldSaleInput } from "./held-sales-schema";

const listHeldSalesInternal = createListHeldSalesAction();
const saveHeldSaleInternal = createSaveHeldSaleAction();
const deleteHeldSaleInternal = createDeleteHeldSaleAction();

export async function listHeldSalesAction() {
  return listHeldSalesInternal();
}

export async function saveHeldSaleAction(input: SaveHeldSaleInput) {
  return saveHeldSaleInternal(input);
}

export async function deleteHeldSaleAction(input: DeleteHeldSaleInput) {
  return deleteHeldSaleInternal(input);
}

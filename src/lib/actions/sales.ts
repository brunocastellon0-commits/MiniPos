"use server";

import { createConfirmSaleAction } from "./sales-core";
import type { ConfirmSaleInput } from "./sales-schema";

const confirmSaleInternal = createConfirmSaleAction();

export async function confirmSaleAction(input: ConfirmSaleInput) {
  return confirmSaleInternal(input);
}

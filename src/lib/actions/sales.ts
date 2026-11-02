"use server";

import { createConfirmSaleAction, createGetSaleTicketAction } from "./sales-core";
import type { ConfirmSaleInput, GetSaleTicketInput } from "./sales-schema";

const confirmSaleInternal = createConfirmSaleAction();
const getSaleTicketInternal = createGetSaleTicketAction();

export async function confirmSaleAction(input: ConfirmSaleInput) {
  return confirmSaleInternal(input);
}

export async function getSaleTicketAction(input: GetSaleTicketInput) {
  return getSaleTicketInternal(input);
}

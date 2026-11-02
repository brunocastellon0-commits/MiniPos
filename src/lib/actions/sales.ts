"use server";

import {
  createConfirmSaleAction,
  createGetSaleDetailAction,
  createGetSaleTicketAction,
  createListSalesAction,
} from "./sales-core";
import type {
  ConfirmSaleInput,
  GetSaleDetailInput,
  GetSaleTicketInput,
  ListSalesInput,
} from "./sales-schema";

const confirmSaleInternal = createConfirmSaleAction();
const getSaleTicketInternal = createGetSaleTicketAction();
const listSalesInternal = createListSalesAction();
const getSaleDetailInternal = createGetSaleDetailAction();

export async function confirmSaleAction(input: ConfirmSaleInput) {
  return confirmSaleInternal(input);
}

export async function getSaleTicketAction(input: GetSaleTicketInput) {
  return getSaleTicketInternal(input);
}

export async function listSalesAction(input: ListSalesInput) {
  return listSalesInternal(input);
}

export async function getSaleDetailAction(input: GetSaleDetailInput) {
  return getSaleDetailInternal(input);
}

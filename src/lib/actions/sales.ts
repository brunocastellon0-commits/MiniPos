"use server";

import {
  createConfirmSaleAction,
  createGetSaleDetailAction,
  createGetSaleTicketAction,
  createListSalesAction,
  createVoidSaleAction,
} from "./sales-core";
import type {
  ConfirmSaleInput,
  GetSaleDetailInput,
  GetSaleTicketInput,
  ListSalesInput,
  VoidSaleInput,
} from "./sales-schema";

const confirmSaleInternal = createConfirmSaleAction();
const getSaleTicketInternal = createGetSaleTicketAction();
const listSalesInternal = createListSalesAction();
const getSaleDetailInternal = createGetSaleDetailAction();
const voidSaleInternal = createVoidSaleAction();

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

export async function voidSaleAction(input: VoidSaleInput) {
  return voidSaleInternal(input);
}

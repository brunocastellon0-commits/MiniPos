"use server";

import {
  createCreatePurchaseAction,
  createGetPurchaseAction,
  createListPurchasesAction,
  createReceivePurchaseAction,
} from "./purchases-core";
import type {
  CreatePurchaseInput,
  GetPurchaseInput,
  ListPurchasesInput,
  ReceivePurchaseInput,
} from "./purchases-schema";

const createPurchaseInternal = createCreatePurchaseAction();
const listPurchasesInternal = createListPurchasesAction();
const getPurchaseInternal = createGetPurchaseAction();
const receivePurchaseInternal = createReceivePurchaseAction();

export async function createPurchaseAction(input: CreatePurchaseInput) {
  return createPurchaseInternal(input);
}

export async function listPurchasesAction(input: ListPurchasesInput = {}) {
  return listPurchasesInternal(input);
}

export async function getPurchaseAction(input: GetPurchaseInput) {
  return getPurchaseInternal(input);
}

export async function receivePurchaseAction(input: ReceivePurchaseInput) {
  return receivePurchaseInternal(input);
}

"use server";

import {
  createCancelPurchaseAction,
  createCreatePurchaseAction,
  createGetPurchaseAction,
  createGetPurchaseTimelineAction,
  createListPurchasesAction,
  createReceivePurchaseAction,
  createRegisterPurchaseVisitAction,
} from "./purchases-core";
import type {
  CancelPurchaseInput,
  CreatePurchaseInput,
  GetPurchaseInput,
  ListPurchasesInput,
  PurchaseTimelineInput,
  ReceivePurchaseInput,
  RegisterPurchaseVisitInput,
} from "./purchases-schema";

const createPurchaseInternal = createCreatePurchaseAction();
const listPurchasesInternal = createListPurchasesAction();
const getPurchaseInternal = createGetPurchaseAction();
const receivePurchaseInternal = createReceivePurchaseAction();
const cancelPurchaseInternal = createCancelPurchaseAction();
const registerPurchaseVisitInternal = createRegisterPurchaseVisitAction();
const getPurchaseTimelineInternal = createGetPurchaseTimelineAction();

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

export async function cancelPurchaseAction(input: CancelPurchaseInput) {
  return cancelPurchaseInternal(input);
}

export async function registerPurchaseVisitAction(input: RegisterPurchaseVisitInput) {
  return registerPurchaseVisitInternal(input);
}

export async function getPurchaseTimelineAction(input: PurchaseTimelineInput) {
  return getPurchaseTimelineInternal(input);
}

"use server";

import {
  createAddCashMovementAction,
  createCloseCashSessionAction,
  createGetCashOverviewAction,
  createGetOpenCashSessionAction,
  createListCashSessionsAction,
  createOpenCashSessionAction,
} from "./cash-core";
import type {
  AddCashMovementInput,
  CloseCashSessionInput,
  ListCashSessionsInput,
  OpenCashSessionInput,
} from "./cash-schema";

const getCashOverviewInternal = createGetCashOverviewAction();
const getOpenCashSessionInternal = createGetOpenCashSessionAction();
const openCashSessionInternal = createOpenCashSessionAction();
const addCashMovementInternal = createAddCashMovementAction();
const closeCashSessionInternal = createCloseCashSessionAction();
const listCashSessionsInternal = createListCashSessionsAction();

export async function getCashOverviewAction() {
  return getCashOverviewInternal();
}

export async function getOpenCashSessionAction() {
  return getOpenCashSessionInternal();
}

export async function openCashSessionAction(input: OpenCashSessionInput) {
  return openCashSessionInternal(input);
}

export async function addCashMovementAction(input: AddCashMovementInput) {
  return addCashMovementInternal(input);
}

export async function closeCashSessionAction(input: CloseCashSessionInput) {
  return closeCashSessionInternal(input);
}

export async function listCashSessionsAction(input: ListCashSessionsInput = {}) {
  return listCashSessionsInternal(input);
}

export type { CashOverview } from "./cash-core";

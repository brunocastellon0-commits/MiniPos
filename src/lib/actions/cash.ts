"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import {
  createAddCashMovementAction,
  createCloseCashSessionAction,
  createGetCashOverviewAction,
  createGetCashSessionDetailAction,
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
const getCashSessionDetailInternal = createGetCashSessionDetailAction();
const getOpenCashSessionInternal = createGetOpenCashSessionAction();
const openCashSessionInternal = createOpenCashSessionAction();
const addCashMovementInternal = createAddCashMovementAction();
const closeCashSessionInternal = createCloseCashSessionAction();
const listCashSessionsInternal = createListCashSessionsAction();

export async function getCashOverviewAction() {
  return getCashOverviewInternal();
}

export async function getCashSessionDetailAction(input: { sessionId: string }) {
  return getCashSessionDetailInternal(input);
}

export const getOpenCashSessionAction = cache(async function getOpenCashSessionAction() {
  return getOpenCashSessionInternal();
});

export async function openCashSessionAction(input: OpenCashSessionInput) {
  const res = await openCashSessionInternal(input);
  if (res.ok) {
    revalidatePath("/turno");
    revalidatePath("/caja");
    revalidatePath("/panel");
  }
  return res;
}

export async function addCashMovementAction(input: AddCashMovementInput) {
  const res = await addCashMovementInternal(input);
  if (res.ok) {
    revalidatePath("/turno");
    revalidatePath("/panel");
  }
  return res;
}

export async function closeCashSessionAction(input: CloseCashSessionInput) {
  const res = await closeCashSessionInternal(input);
  if (res.ok) {
    revalidatePath("/turno");
    revalidatePath("/caja");
    revalidatePath("/panel");
  }
  return res;
}

export const listCashSessionsAction = cache(async function listCashSessionsAction(
  input: ListCashSessionsInput = {},
) {
  return listCashSessionsInternal(input);
});

export type { CashOverview } from "./cash-core";

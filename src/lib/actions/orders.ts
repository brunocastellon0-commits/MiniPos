"use server";

import { revalidatePath } from "next/cache";
import {
  createChargeOrderAction,
  createCreateOrderAction,
  createGetOrderAction,
  createListOrdersAction,
  createUpdateOrderStatusAction,
} from "./orders-core";
import type {
  ChargeOrderInput,
  CreateOrderInput,
  GetOrderInput,
  ListOrdersInput,
  UpdateOrderStatusInput,
} from "./orders-schema";

const createOrderInternal = createCreateOrderAction();
const listOrdersInternal = createListOrdersAction();
const getOrderInternal = createGetOrderAction();
const updateOrderStatusInternal = createUpdateOrderStatusAction();
const chargeOrderInternal = createChargeOrderAction();

export async function createOrderAction(input: CreateOrderInput) {
  const res = await createOrderInternal(input);
  if (res.ok) {
    revalidatePath("/caja");
    revalidatePath("/ventas");
    revalidatePath("/inventario");
    revalidatePath("/panel");
  }
  return res;
}

export async function listOrdersAction(input: ListOrdersInput) {
  return listOrdersInternal(input);
}

export async function getOrderAction(input: GetOrderInput) {
  return getOrderInternal(input);
}

export async function updateOrderStatusAction(input: UpdateOrderStatusInput) {
  const res = await updateOrderStatusInternal(input);
  if (res.ok) {
    revalidatePath("/caja");
  }
  return res;
}

export async function chargeOrderAction(input: ChargeOrderInput) {
  const res = await chargeOrderInternal(input);
  if (res.ok) {
    revalidatePath("/caja");
    revalidatePath("/ventas");
    revalidatePath("/inventario");
    revalidatePath("/panel");
  }
  return res;
}

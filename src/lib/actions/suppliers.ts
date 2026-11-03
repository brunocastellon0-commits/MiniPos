"use server";

import {
  createCreateSupplierAction,
  createDeleteSupplierAction,
  createListSuppliersAction,
  createUpdateSupplierAction,
} from "./suppliers-core";
import type {
  CreateSupplierInput,
  DeleteSupplierInput,
  ListSuppliersInput,
  UpdateSupplierInput,
} from "./suppliers-schema";

const listSuppliersInternal = createListSuppliersAction();
const createSupplierInternal = createCreateSupplierAction();
const updateSupplierInternal = createUpdateSupplierAction();
const deleteSupplierInternal = createDeleteSupplierAction();

export async function listSuppliersAction(input: ListSuppliersInput = {}) {
  return listSuppliersInternal(input);
}

export async function createSupplierAction(input: CreateSupplierInput) {
  return createSupplierInternal(input);
}

export async function updateSupplierAction(input: UpdateSupplierInput) {
  return updateSupplierInternal(input);
}

export async function deleteSupplierAction(input: DeleteSupplierInput) {
  return deleteSupplierInternal(input);
}

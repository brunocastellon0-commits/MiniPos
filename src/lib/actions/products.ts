"use server";

import {
  createCreateProductAction,
  createListProductsAction,
  createSetProductActiveAction,
  createUpdateProductAction,
} from "./products-core";
import type {
  CreateProductInput,
  ListProductsInput,
  SetProductActiveInput,
  UpdateProductInput,
} from "./products-schema";

const listProductsInternal = createListProductsAction();
const createProductInternal = createCreateProductAction();
const updateProductInternal = createUpdateProductAction();
const setProductActiveInternal = createSetProductActiveAction();

export async function listProductsAction(input: ListProductsInput = {}) {
  return listProductsInternal(input);
}

export async function createProductAction(input: CreateProductInput) {
  return createProductInternal(input);
}

export async function updateProductAction(input: UpdateProductInput) {
  return updateProductInternal(input);
}

export async function setProductActiveAction(input: SetProductActiveInput) {
  return setProductActiveInternal(input);
}

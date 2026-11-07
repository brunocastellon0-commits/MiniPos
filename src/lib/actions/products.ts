"use server";

import {
  createCreateProductAction,
  createGetProductNamesAction,
  createListProductsAction,
  createSetProductActiveAction,
  createUpdateProductAction,
} from "./products-core";
import type {
  CreateProductInput,
  ListProductsInput,
  ProductNamesInput,
  SetProductActiveInput,
  UpdateProductInput,
} from "./products-schema";

const listProductsInternal = createListProductsAction();
const createProductInternal = createCreateProductAction();
const updateProductInternal = createUpdateProductAction();
const setProductActiveInternal = createSetProductActiveAction();
const getProductNamesInternal = createGetProductNamesAction();

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

export async function getProductNamesAction(input: ProductNamesInput) {
  return getProductNamesInternal(input);
}

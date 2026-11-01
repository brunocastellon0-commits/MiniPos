"use server";

import {
  createGetProductsByIdsAction,
  createListPosProductsAction,
  createSearchPosProductsAction,
} from "./products-search-core";
import type { ListPosProductsInput, SearchPosProductsInput } from "./products-search-schema";

const searchPosProductsInternal = createSearchPosProductsAction();
const listPosProductsInternal = createListPosProductsAction();
const getProductsByIdsInternal = createGetProductsByIdsAction();

export async function searchPosProductsAction(input: SearchPosProductsInput) {
  return searchPosProductsInternal(input);
}

export async function listPosProductsAction(input: ListPosProductsInput = {}) {
  return listPosProductsInternal(input);
}

export async function getProductsByIdsAction(input: { ids: string[] }) {
  return getProductsByIdsInternal(input);
}

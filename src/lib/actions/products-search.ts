"use server";

import {
  createListPosProductsAction,
  createSearchPosProductsAction,
} from "./products-search-core";
import type { ListPosProductsInput, SearchPosProductsInput } from "./products-search-schema";

const searchPosProductsInternal = createSearchPosProductsAction();
const listPosProductsInternal = createListPosProductsAction();

export async function searchPosProductsAction(input: SearchPosProductsInput) {
  return searchPosProductsInternal(input);
}

export async function listPosProductsAction(input: ListPosProductsInput = {}) {
  return listPosProductsInternal(input);
}

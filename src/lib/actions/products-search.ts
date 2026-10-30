"use server";

import { createSearchPosProductsAction } from "./products-search-core";
import type { SearchPosProductsInput } from "./products-search-schema";

const searchPosProductsInternal = createSearchPosProductsAction();

export async function searchPosProductsAction(input: SearchPosProductsInput) {
  return searchPosProductsInternal(input);
}

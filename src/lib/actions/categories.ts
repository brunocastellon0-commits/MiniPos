"use server";

import {
  createCreateCategoryAction,
  createDeleteCategoryAction,
  createListCategoriesAction,
  createReorderCategoriesAction,
  createUpdateCategoryAction,
} from "./categories-core";
import type {
  CreateCategoryInput,
  DeleteCategoryInput,
  ReorderCategoriesInput,
  UpdateCategoryInput,
} from "./categories-schema";

const listCategoriesInternal = createListCategoriesAction();
const createCategoryInternal = createCreateCategoryAction();
const updateCategoryInternal = createUpdateCategoryAction();
const reorderCategoriesInternal = createReorderCategoriesAction();
const deleteCategoryInternal = createDeleteCategoryAction();

export async function listCategoriesAction() {
  return listCategoriesInternal();
}

export async function createCategoryAction(input: CreateCategoryInput) {
  return createCategoryInternal(input);
}

export async function updateCategoryAction(input: UpdateCategoryInput) {
  return updateCategoryInternal(input);
}

export async function reorderCategoriesAction(input: ReorderCategoriesInput) {
  return reorderCategoriesInternal(input);
}

export async function deleteCategoryAction(input: DeleteCategoryInput) {
  return deleteCategoryInternal(input);
}

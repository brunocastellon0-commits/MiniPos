"use server";

import {
  createListUsersAction,
  createToggleUserActiveAction,
  createUpdateUserNameAction,
  createUpdateUserRoleAction,
} from "./users-core";
import type {
  ToggleUserActiveInput,
  UpdateUserNameInput,
  UpdateUserRoleInput,
} from "./users-schema";

const listUsersInternal = createListUsersAction();
const updateUserNameInternal = createUpdateUserNameAction();
const updateUserRoleInternal = createUpdateUserRoleAction();
const toggleUserActiveInternal = createToggleUserActiveAction();

export async function listUsersAction() {
  return listUsersInternal();
}

export async function updateUserNameAction(input: UpdateUserNameInput) {
  return updateUserNameInternal(input);
}

export async function updateUserRoleAction(input: UpdateUserRoleInput) {
  return updateUserRoleInternal(input);
}

export async function toggleUserActiveAction(input: ToggleUserActiveInput) {
  return toggleUserActiveInternal(input);
}

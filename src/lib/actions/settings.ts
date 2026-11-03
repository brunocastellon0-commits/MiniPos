"use server";

import {
  createGetBusinessPublicAction,
  createGetBusinessSettingsAction,
  createUpdateBusinessSettingsAction,
} from "./settings-core";
import type { UpdateBusinessSettingsInput } from "./settings-schema";

const getBusinessPublicInternal = createGetBusinessPublicAction();
const getBusinessSettingsInternal = createGetBusinessSettingsAction();
const updateBusinessSettingsInternal = createUpdateBusinessSettingsAction();

export async function getBusinessPublicAction() {
  return getBusinessPublicInternal();
}

export async function getBusinessSettingsAction() {
  return getBusinessSettingsInternal();
}

export async function updateBusinessSettingsAction(input: UpdateBusinessSettingsInput) {
  return updateBusinessSettingsInternal(input);
}

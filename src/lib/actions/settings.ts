"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import {
  createGetBusinessPublicAction,
  createGetBusinessSettingsAction,
  createUpdateBusinessSettingsAction,
} from "./settings-core";
import type { UpdateBusinessSettingsInput } from "./settings-schema";

const getBusinessPublicInternal = createGetBusinessPublicAction();
const getBusinessSettingsInternal = createGetBusinessSettingsAction();
const updateBusinessSettingsInternal = createUpdateBusinessSettingsAction();

export const getBusinessPublicAction = cache(async function getBusinessPublicAction() {
  return getBusinessPublicInternal();
});

export const getBusinessSettingsAction = cache(async function getBusinessSettingsAction() {
  return getBusinessSettingsInternal();
});

export async function updateBusinessSettingsAction(input: UpdateBusinessSettingsInput) {
  const res = await updateBusinessSettingsInternal(input);
  if (res.ok) {
    revalidatePath("/", "layout");
  }
  return res;
}

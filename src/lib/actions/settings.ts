"use server";

import { createGetBusinessPublicAction } from "./settings-core";

const getBusinessPublicInternal = createGetBusinessPublicAction();

export async function getBusinessPublicAction() {
  return getBusinessPublicInternal();
}

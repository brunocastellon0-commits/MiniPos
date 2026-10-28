"use server";

import { createLoginAction, type LoginInput, type LoginResult } from "./auth-core";
import type { ActionResult } from "./secure-action";

const internalLogin = createLoginAction();

export async function loginAction(input: LoginInput): Promise<ActionResult<LoginResult>> {
  return internalLogin(input);
}

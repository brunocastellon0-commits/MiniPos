"use server";

import { createClient } from "@/lib/supabase/server";
import { createLoginAction, type LoginInput, type LoginResult } from "./auth-core";
import type { ActionResult } from "./secure-action";

const internalLogin = createLoginAction();

export async function loginAction(input: LoginInput): Promise<ActionResult<LoginResult>> {
  return internalLogin(input);
}

export async function logoutAction(): Promise<ActionResult<{ redirectUrl: string }>> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Si falla signOut por red/sesión expirada, permitimos la redirección a login
  }
  return { ok: true, data: { redirectUrl: "/login" } };
}

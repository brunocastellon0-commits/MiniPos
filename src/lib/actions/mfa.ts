"use server";

import {
  createEnrollMfaAction,
  createGetMfaStatusAction,
  createUnenrollMfaAction,
  createVerifyLoginMfaAction,
  createVerifyMfaEnrollmentAction,
  type MfaEnrollResult,
  type VerifyMfaInput,
} from "./mfa-core";
import type { ActionResult } from "./secure-action";

const defaultEnroll = createEnrollMfaAction();
const defaultVerifyEnrollment = createVerifyMfaEnrollmentAction();
const defaultGetStatus = createGetMfaStatusAction();
const defaultUnenroll = createUnenrollMfaAction();
const defaultVerifyLogin = createVerifyLoginMfaAction();

export async function enrollMfaAction(): Promise<ActionResult<MfaEnrollResult>> {
  return defaultEnroll();
}

export async function verifyMfaEnrollmentAction(
  input: VerifyMfaInput,
): Promise<ActionResult<{ verified: boolean }>> {
  return defaultVerifyEnrollment(input);
}

export async function getMfaStatusAction(): Promise<
  ActionResult<{ enabled: boolean; factorId?: string }>
> {
  return defaultGetStatus();
}

export async function unenrollMfaAction(input: {
  factorId: string;
}): Promise<ActionResult<{ unenrolled: boolean }>> {
  return defaultUnenroll(input);
}

export async function verifyLoginMfaAction(
  input: VerifyMfaInput,
): Promise<ActionResult<{ redirectUrl: string }>> {
  return defaultVerifyLogin(input);
}

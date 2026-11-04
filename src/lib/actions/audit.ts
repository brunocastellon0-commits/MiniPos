"use server";

import {
  createGetAuditAlertsAction,
  createListAuditLogAction,
} from "./audit-core";

const listAuditLogInternal = createListAuditLogAction();
const getAuditAlertsInternal = createGetAuditAlertsAction();

export async function listAuditLogAction() {
  return listAuditLogInternal();
}

export async function getAuditAlertsAction() {
  return getAuditAlertsInternal();
}

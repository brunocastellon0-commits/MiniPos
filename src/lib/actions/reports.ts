"use server";

import {
  createExportSalesReportCsvAction,
  createGetReportsDataAction,
} from "./reports-core";
import type { ReportsRangeInput } from "./reports-schema";

const getReportsDataInternal = createGetReportsDataAction();
const exportSalesReportCsvInternal = createExportSalesReportCsvAction();

export async function getReportsDataAction(input: ReportsRangeInput) {
  return getReportsDataInternal(input);
}

export async function exportSalesReportCsvAction(input: ReportsRangeInput) {
  return exportSalesReportCsvInternal(input);
}

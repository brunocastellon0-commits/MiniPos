"use server";

import {
  createGetPanelInsightsAction,
  type PanelInsightsInput,
} from "./panel-core";

const getPanelInsightsInternal = createGetPanelInsightsAction();

export async function getPanelInsightsAction(input: PanelInsightsInput) {
  return getPanelInsightsInternal(input);
}

import { defaultMapId } from "../maps/mapCatalog.js";
import { endlessWavePlan } from "./endlessWavePlan.js";
import shallowStageData from "./stage_shallow_intro.json" with { type: "json" };
import shallowBreakwaterData from "./stage_shallow_breakwater.json" with { type: "json" };
import coralStageData from "./stage_coral_gauntlet.json" with { type: "json" };
import coralUndertowData from "./stage_coral_undertow.json" with { type: "json" };
import trenchStageData from "./stage_trench_siege.json" with { type: "json" };
import trenchAbyssalGateData from "./stage_trench_abyssal_gate.json" with { type: "json" };

export const stageCatalog = {
  endless_default: {
    id: "endless_default",
    label: "無盡模式（淺海灣）",
    mapId: defaultMapId,
    wavePlan: endlessWavePlan
  },
  [shallowStageData.id]: {
    id: shallowStageData.id,
    label: shallowStageData.label,
    mapId: defaultMapId,
    wavePlan: shallowStageData
  },
  [shallowBreakwaterData.id]: {
    id: shallowBreakwaterData.id,
    label: shallowBreakwaterData.label,
    mapId: defaultMapId,
    wavePlan: shallowBreakwaterData
  },
  [coralStageData.id]: {
    id: coralStageData.id,
    label: coralStageData.label,
    mapId: "coralMaze",
    wavePlan: coralStageData
  },
  [coralUndertowData.id]: {
    id: coralUndertowData.id,
    label: coralUndertowData.label,
    mapId: "coralMaze",
    wavePlan: coralUndertowData
  },
  [trenchStageData.id]: {
    id: trenchStageData.id,
    label: trenchStageData.label,
    mapId: "deepTrench",
    wavePlan: trenchStageData
  },
  [trenchAbyssalGateData.id]: {
    id: trenchAbyssalGateData.id,
    label: trenchAbyssalGateData.label,
    mapId: "deepTrench",
    wavePlan: trenchAbyssalGateData
  }
};

export const defaultStageId = "endless_default";

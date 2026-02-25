import { defaultMapId } from "../maps/mapCatalog.js";
import { endlessWavePlan } from "./endlessWavePlan.js";
import shallowStageData from "./stage_shallow_intro.json" with { type: "json" };
import coralStageData from "./stage_coral_gauntlet.json" with { type: "json" };
import trenchStageData from "./stage_trench_siege.json" with { type: "json" };

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
  [coralStageData.id]: {
    id: coralStageData.id,
    label: coralStageData.label,
    mapId: "coralMaze",
    wavePlan: coralStageData
  },
  [trenchStageData.id]: {
    id: trenchStageData.id,
    label: trenchStageData.label,
    mapId: "deepTrench",
    wavePlan: trenchStageData
  }
};

export const defaultStageId = "endless_default";

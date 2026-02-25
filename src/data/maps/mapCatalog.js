import { defaultMap } from "./defaultMap.js";
import coralMazeData from "./coralMaze.json" with { type: "json" };
import deepTrenchData from "./deepTrench.json" with { type: "json" };

export const mapCatalog = {
  [defaultMap.id]: defaultMap,
  [coralMazeData.id]: coralMazeData,
  [deepTrenchData.id]: deepTrenchData
};

export const defaultMapId = defaultMap.id;

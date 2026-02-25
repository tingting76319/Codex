import { canvas } from "../ui/dom.js";
import { defaultMap } from "../data/maps/defaultMap.js";

export function createMapRuntime(mapData) {
  const GRID = {
    cols: mapData.grid.cols,
    rows: mapData.grid.rows,
    size: mapData.grid.size,
    x: 0,
    y: mapData.grid.offsetY ?? 30
  };
  GRID.x = Math.floor((canvas.width - GRID.cols * GRID.size) / 2);
  GRID.y = mapData.grid.offsetY ?? 30;

  const pathCells = mapData.pathCells;

  const pathPoints = pathCells.map(([cx, cy]) => ({
    x: GRID.x + cx * GRID.size + GRID.size / 2,
    y: GRID.y + cy * GRID.size + GRID.size / 2
  }));

  const pathCellSet = new Set(pathCells.map(([x, y]) => `${x},${y}`));

  return { GRID, pathCells, pathPoints, pathCellSet, mapData };
}

export const { GRID, pathCells, pathPoints, pathCellSet, mapData } = createMapRuntime(defaultMap);

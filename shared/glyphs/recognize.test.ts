import { describe, it, expect } from "vitest";
import { recognizeGlyphWithActiveLayer } from "./recognize";
import { GRID_WIDTH, GRID_HEIGHT } from "../config";
import { ElementId } from "../constants";
import { PaintMeta } from "./paintMeta";

describe("recognizeGlyphWithActiveLayer", () => {
  function createEmptyGrid(): (ElementId | null)[][] {
    return Array(GRID_HEIGHT)
      .fill(null)
      .map(() => Array(GRID_WIDTH).fill(null));
  }

  it("должен игнорировать старые рисунки и использовать только active-слой", () => {
    const grid = createEmptyGrid();
    const paintMeta = new Map<string, PaintMeta>();
    const now = Date.now();

    // Старый рисунок (не в active-слое)
    for (let x = 5; x < 15; x++) {
      grid[10][x] = "fire";
      paintMeta.set(`${x},10`, {
        lastPaintAt: now - 10000, // 10 секунд назад
        castGeneration: 0,
      });
    }

    // Новый рисунок (в active-слое)
    for (let x = 30; x < 40; x++) {
      grid[20][x] = "fire";
      paintMeta.set(`${x},20`, {
        lastPaintAt: now - 1000, // 1 секунда назад
        castGeneration: 1,
      });
    }

    const result = recognizeGlyphWithActiveLayer(
      grid,
      "fire",
      paintMeta,
      1,
      now
    );

    expect(result.success).toBe(true);
    expect(result.componentCells).toBeDefined();
    // Должна быть найдена только новая компонента
    if (result.componentCells) {
      const hasOld = result.componentCells.some((c) => c.y === 10);
      const hasNew = result.componentCells.some((c) => c.y === 20);
      expect(hasOld).toBe(false);
      expect(hasNew).toBe(true);
    }
  });

  it("должен объединять близкие компоненты", () => {
    const grid = createEmptyGrid();
    const paintMeta = new Map<string, PaintMeta>();
    const now = Date.now();
    const currentGen = 1;

    // Две близкие компоненты
    for (let x = 10; x < 15; x++) {
      grid[10][x] = "fire";
      paintMeta.set(`${x},10`, {
        lastPaintAt: now - 500,
        castGeneration: currentGen,
      });
    }

    for (let x = 16; x < 18; x++) {
      grid[10][x] = "fire";
      paintMeta.set(`${x},10`, {
        lastPaintAt: now - 500,
        castGeneration: currentGen,
      });
    }

    const result = recognizeGlyphWithActiveLayer(
      grid,
      "fire",
      paintMeta,
      currentGen,
      now
    );

    expect(result.success).toBe(true);
    expect(result.componentCells?.length).toBeGreaterThan(5);
  });

  it("должен использовать fallback на весь грид, если active-слой слишком мал", () => {
    const grid = createEmptyGrid();
    const paintMeta = new Map<string, PaintMeta>();
    const now = Date.now();

    // Только 2 клетки в active-слое (слишком мало)
    grid[10][10] = "fire";
    paintMeta.set("10,10", {
      lastPaintAt: now - 500,
      castGeneration: 1,
    });
    grid[10][11] = "fire";
    paintMeta.set("11,10", {
      lastPaintAt: now - 500,
      castGeneration: 1,
    });

    // Большой старый рисунок
    for (let x = 20; x < 30; x++) {
      grid[20][x] = "fire";
      paintMeta.set(`${x},20`, {
        lastPaintAt: now - 10000,
        castGeneration: 0,
      });
    }

    const result = recognizeGlyphWithActiveLayer(
      grid,
      "fire",
      paintMeta,
      1,
      now
    );

    // Должен использовать fallback и найти большой старый рисунок
    expect(result.componentCells?.length).toBeGreaterThan(5);
  });
});

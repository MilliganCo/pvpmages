import { ElementId } from "../constants";
import { SpellId } from "../types";
import { GlyphTemplate, GLYPH_LIBRARY } from "./glyphLibrary";
import {
  GRID_WIDTH,
  GRID_HEIGHT,
  GLYPH_NORMALIZE_SIZE,
  MIN_COMPONENT_SIZE,
  ACTIVE_WINDOW_MS,
  MIN_ACTIVE_CELLS,
  MERGE_DISTANCE,
  NORMALIZATION_PADDING,
} from "../config";
import { PaintMeta } from "./paintMeta";

export interface RecognitionResult {
  success: boolean;
  spellId?: SpellId;
  score?: number;
  componentCells?: Array<{ x: number; y: number }>;
  bbox?: { minX: number; minY: number; maxX: number; maxY: number };
  centroid?: { x: number; y: number };
  element?: ElementId;
}

/**
 * Находит все связные компоненты заданного элемента на поле
 */
function findConnectedComponents(
  grid: (ElementId | null)[][],
  element: ElementId
): Array<Array<{ x: number; y: number }>> {
  const visited = new Set<string>();
  const components: Array<Array<{ x: number; y: number }>> = [];

  const key = (x: number, y: number) => `${x},${y}`;

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (grid[y][x] === element && !visited.has(key(x, y))) {
        // BFS для поиска связной компоненты
        const component: Array<{ x: number; y: number }> = [];
        const queue: Array<{ x: number; y: number }> = [{ x, y }];
        visited.add(key(x, y));

        while (queue.length > 0) {
          const { x: cx, y: cy } = queue.shift()!;
          component.push({ x: cx, y: cy });

          // Проверяем 4 соседа
          const neighbors = [
            { x: cx - 1, y: cy },
            { x: cx + 1, y: cy },
            { x: cx, y: cy - 1 },
            { x: cx, y: cy + 1 },
          ];

          for (const neighbor of neighbors) {
            const nkey = key(neighbor.x, neighbor.y);
            if (
              neighbor.x >= 0 &&
              neighbor.x < GRID_WIDTH &&
              neighbor.y >= 0 &&
              neighbor.y < GRID_HEIGHT &&
              grid[neighbor.y][neighbor.x] === element &&
              !visited.has(nkey)
            ) {
              visited.add(nkey);
              queue.push(neighbor);
            }
          }
        }

        if (component.length >= MIN_COMPONENT_SIZE) {
          components.push(component);
        }
      }
    }
  }

  return components;
}

/**
 * Вычисляет bounding box компоненты
 */
function getBoundingBox(component: Array<{ x: number; y: number }>): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const { x, y } of component) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Нормализует компоненту к фиксированному размеру с padding и центрированием
 */
function normalizeComponent(
  component: Array<{ x: number; y: number }>,
  size: number
): number[][] {
  const bbox = getBoundingBox(component);
  const width = bbox.maxX - bbox.minX + 1;
  const height = bbox.maxY - bbox.minY + 1;
  
  // Вычисляем максимальный размер для масштабирования (с учётом padding)
  const maxDim = Math.max(width, height) + NORMALIZATION_PADDING * 2;
  
  // Создаём бинарную маску с центрированием
  const maskSize = Math.max(maxDim, size);
  const mask: number[][] = Array(maskSize)
    .fill(null)
    .map(() => Array(maskSize).fill(0));

  // Центрируем компоненту в маске
  const offsetX = Math.floor((maskSize - width) / 2);
  const offsetY = Math.floor((maskSize - height) / 2);

  for (const { x, y } of component) {
    const localX = (x - bbox.minX) + offsetX;
    const localY = (y - bbox.minY) + offsetY;
    if (localX >= 0 && localX < maskSize && localY >= 0 && localY < maskSize) {
      mask[localY][localX] = 1;
    }
  }

  // Масштабируем к целевому размеру с центрированием
  const normalized: number[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill(0));

  // Для очень маленьких компонент используем более мягкое масштабирование
  if (maxDim <= 3) {
    // Для маленьких глифов просто центрируем без масштабирования
    const centerX = Math.floor(size / 2);
    const centerY = Math.floor(size / 2);
    const startX = centerX - Math.floor(width / 2);
    const startY = centerY - Math.floor(height / 2);
    
    for (const { x, y } of component) {
      const nx = startX + (x - bbox.minX);
      const ny = startY + (y - bbox.minY);
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        normalized[ny][nx] = 1;
      }
    }
  } else {
    // Для больших глифов используем масштабирование
    const scale = maskSize / size;
    const centerOffsetX = (maskSize - size * scale) / 2;
    const centerOffsetY = (maskSize - size * scale) / 2;

    for (let ny = 0; ny < size; ny++) {
      for (let nx = 0; nx < size; nx++) {
        const srcX = Math.floor(nx * scale + centerOffsetX);
        const srcY = Math.floor(ny * scale + centerOffsetY);
        if (srcX >= 0 && srcX < maskSize && srcY >= 0 && srcY < maskSize && mask[srcY][srcX] === 1) {
          normalized[ny][nx] = 1;
        }
      }
    }
  }

  return normalized;
}

/**
 * Вычисляет метрику Dice (F1-score для бинарных масок)
 * score = 2*|A∩B| / (|A|+|B|)
 */
function diceScore(mask1: number[][], mask2: number[][]): number {
  let intersection = 0;
  let sum1 = 0;
  let sum2 = 0;

  const size = mask1.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (mask1[y][x] === 1) sum1++;
      if (mask2[y][x] === 1) sum2++;
      if (mask1[y][x] === 1 && mask2[y][x] === 1) intersection++;
    }
  }

  const total = sum1 + sum2;
  if (total === 0) return 0;
  return (2 * intersection) / total;
}

/**
 * Находит компоненты в active-слое (свежие штрихи)
 */
function findActiveComponents(
  grid: (ElementId | null)[][],
  element: ElementId,
  paintMeta: Map<string, PaintMeta>,
  currentGeneration: number,
  now: number
): Array<Array<{ x: number; y: number }>> {
  const visited = new Set<string>();
  const components: Array<Array<{ x: number; y: number }>> = [];
  const key = (x: number, y: number) => `${x},${y}`;

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (grid[y][x] !== element) continue;

      const cellKey = key(x, y);
      const meta = paintMeta.get(cellKey);

      // Проверяем, является ли клетка "активной"
      const isActive =
        meta &&
        (meta.castGeneration === currentGeneration ||
          now - meta.lastPaintAt <= ACTIVE_WINDOW_MS);

      if (!isActive || visited.has(cellKey)) continue;

      // BFS для поиска связной компоненты
      const component: Array<{ x: number; y: number }> = [];
      const queue: Array<{ x: number; y: number }> = [{ x, y }];
      visited.add(cellKey);

      while (queue.length > 0) {
        const { x: cx, y: cy } = queue.shift()!;
        component.push({ x: cx, y: cy });

        const neighbors = [
          { x: cx - 1, y: cy },
          { x: cx + 1, y: cy },
          { x: cx, y: cy - 1 },
          { x: cx, y: cy + 1 },
        ];

        for (const neighbor of neighbors) {
          const nkey = key(neighbor.x, neighbor.y);
          if (
            neighbor.x >= 0 &&
            neighbor.x < GRID_WIDTH &&
            neighbor.y >= 0 &&
            neighbor.y < GRID_HEIGHT &&
            grid[neighbor.y][neighbor.x] === element &&
            !visited.has(nkey)
          ) {
            const neighborMeta = paintMeta.get(nkey);
            const neighborIsActive =
              neighborMeta &&
              (neighborMeta.castGeneration === currentGeneration ||
                now - neighborMeta.lastPaintAt <= ACTIVE_WINDOW_MS);

            if (neighborIsActive) {
              visited.add(nkey);
              queue.push(neighbor);
            }
          }
        }
      }

      if (component.length >= MIN_COMPONENT_SIZE) {
        components.push(component);
      }
    }
  }

  return components;
}

/**
 * Объединяет близкие компоненты
 */
function mergeNearbyComponents(
  components: Array<Array<{ x: number; y: number }>>
): Array<Array<{ x: number; y: number }>> {
  if (components.length <= 1) return components;

  const merged: Array<Array<{ x: number; y: number }>> = [];
  const used = new Set<number>();

  for (let i = 0; i < components.length; i++) {
    if (used.has(i)) continue;

    let current = [...components[i]];
    const bbox1 = getBoundingBox(current);

    // Ищем близкие компоненты для объединения
    for (let j = i + 1; j < components.length; j++) {
      if (used.has(j)) continue;

      const bbox2 = getBoundingBox(components[j]);

      // Вычисляем расстояние между bbox
      const center1 = { x: (bbox1.minX + bbox1.maxX) / 2, y: (bbox1.minY + bbox1.maxY) / 2 };
      const center2 = { x: (bbox2.minX + bbox2.maxX) / 2, y: (bbox2.minY + bbox2.maxY) / 2 };
      const dist = Math.sqrt((center1.x - center2.x) ** 2 + (center1.y - center2.y) ** 2);

      if (dist <= MERGE_DISTANCE) {
        current = [...current, ...components[j]];
        used.add(j);
        // Пересчитываем bbox
        const newBbox = getBoundingBox(current);
        bbox1.minX = newBbox.minX;
        bbox1.maxX = newBbox.maxX;
        bbox1.minY = newBbox.minY;
        bbox1.maxY = newBbox.maxY;
      }
    }

    merged.push(current);
    used.add(i);
  }

  return merged;
}

/**
 * Распознаёт глиф на поле игрока с поддержкой active-слоя
 */
export function recognizeGlyphWithActiveLayer(
  grid: (ElementId | null)[][],
  selectedElement: ElementId,
  paintMeta: Map<string, PaintMeta>,
  currentGeneration: number,
  now: number
): RecognitionResult {
  // Сначала пытаемся найти компоненты в active-слое
  let activeComponents = findActiveComponents(
    grid,
    selectedElement,
    paintMeta,
    currentGeneration,
    now
  );

  // Объединяем близкие компоненты
  activeComponents = mergeNearbyComponents(activeComponents);

  // Если активных компонент достаточно, используем их
  let candidateComponent: Array<{ x: number; y: number }> | null = null;

  if (activeComponents.length > 0) {
    const totalActiveCells = activeComponents.reduce((sum, c) => sum + c.length, 0);
    if (totalActiveCells >= MIN_ACTIVE_CELLS) {
      // Берём самую крупную активную компоненту
      candidateComponent = activeComponents.reduce((a, b) =>
        a.length > b.length ? a : b
      );
    }
  }

  // Fallback: если активного слоя недостаточно, используем старый алгоритм
  if (!candidateComponent) {
    const allComponents = findConnectedComponents(grid, selectedElement);
    if (allComponents.length === 0) {
      return { success: false, element: selectedElement };
    }
    candidateComponent = allComponents.reduce((a, b) =>
      a.length > b.length ? a : b
    );
  }

  if (candidateComponent.length < MIN_COMPONENT_SIZE) {
    return { success: false, element: selectedElement };
  }

  // Нормализуем компоненту
  const normalized = normalizeComponent(candidateComponent, GLYPH_NORMALIZE_SIZE);

  // Сравниваем с библиотекой эталонов того же элемента
  const candidates = GLYPH_LIBRARY.filter((g) => g.element === selectedElement);

  let bestMatch: GlyphTemplate | null = null;
  let bestScore = 0;

  for (const template of candidates) {
    const score = diceScore(normalized, template.bitmap);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }

  // Вычисляем bbox и centroid
  const bbox = getBoundingBox(candidateComponent);
  const centroid = {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2,
  };

  if (bestMatch && bestScore >= bestMatch.threshold) {
    return {
      success: true,
      spellId: bestMatch.spellId as SpellId,
      score: bestScore,
      componentCells: candidateComponent,
      bbox,
      centroid,
      element: selectedElement,
    };
  }

  return {
    success: false,
    score: bestScore,
    componentCells: candidateComponent,
    bbox,
    centroid,
    element: selectedElement,
  };
}

/**
 * Распознаёт глиф на поле игрока (старая версия для fallback)
 */
export function recognizeGlyph(
  grid: (ElementId | null)[][],
  selectedElement: ElementId
): RecognitionResult {
  // Находим все связные компоненты выбранного элемента
  const components = findConnectedComponents(grid, selectedElement);

  if (components.length === 0) {
    return { success: false, element: selectedElement };
  }

  // Берём самую крупную компоненту
  const largestComponent = components.reduce((a, b) =>
    a.length > b.length ? a : b
  );

  if (largestComponent.length < MIN_COMPONENT_SIZE) {
    return { success: false, element: selectedElement };
  }

  // Нормализуем компоненту
  const normalized = normalizeComponent(
    largestComponent,
    GLYPH_NORMALIZE_SIZE
  );

  // Сравниваем с библиотекой эталонов того же элемента
  const candidates = GLYPH_LIBRARY.filter((g) => g.element === selectedElement);

  let bestMatch: GlyphTemplate | null = null;
  let bestScore = 0;

  for (const template of candidates) {
    const score = diceScore(normalized, template.bitmap);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }

  // Вычисляем bbox и centroid
  const bbox = getBoundingBox(largestComponent);
  const centroid = {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2,
  };

  if (bestMatch && bestScore >= bestMatch.threshold) {
    return {
      success: true,
      spellId: bestMatch.spellId as SpellId,
      score: bestScore,
      componentCells: largestComponent,
      bbox,
      centroid,
      element: selectedElement,
    };
  }

  return {
    success: false,
    score: bestScore,
    componentCells: largestComponent,
    bbox,
    centroid,
    element: selectedElement,
  };
}

/**
 * Преобразует centroid в относительные координаты (0..1) для прицеливания
 */
export function mapCentroidToTarget(
  centroid: { x: number; y: number },
  gridW: number,
  gridH: number
): { rx: number; ry: number } {
  return {
    rx: Math.max(0, Math.min(1, centroid.x / (gridW - 1))),
    ry: Math.max(0, Math.min(1, centroid.y / (gridH - 1))),
  };
}


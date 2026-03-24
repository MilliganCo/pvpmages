export interface PaintMeta {
  lastPaintAt: number;
  castGeneration: number;
}

export function createPaintMetaMap(): Map<string, PaintMeta> {
  return new Map();
}


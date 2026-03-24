import { ElementId } from "./types";

export type CellKind = "empty" | "element" | "obstacle" | "summon";

export interface CellState {
  kind: CellKind;
  element?: ElementId; // только для kind="element"
  symbol?: string; // для obstacle/summon
  ttlMs?: number; // если временное (expiresAt timestamp)
}

export interface GridOverlay {
  obstacles: Map<string, CellState>; // key: "x,y"
  summons: Map<string, CellState>; // key: "x,y"
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseCellKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}


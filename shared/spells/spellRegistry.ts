import { SpellId, ElementId } from "../types";

export type SpellKind = "damage" | "heal" | "status" | "grid" | "summon" | "hybrid";

export interface SpellDef {
  id: SpellId;
  element: ElementId;
  cooldownMs: number;
  kind: SpellKind;
}

export const SPELLS: Record<SpellId, SpellDef> = {
  // ОГОНЬ
  fire_bolt: {
    id: "fire_bolt",
    element: "fire",
    cooldownMs: 5000, // Увеличен для баланса
    kind: "damage",
  },
  burn_sigil: {
    id: "burn_sigil",
    element: "fire",
    cooldownMs: 6000, // Увеличен для баланса
    kind: "status",
  },
  flare_cleanse: {
    id: "flare_cleanse",
    element: "fire",
    cooldownMs: 7000, // Увеличен для баланса
    kind: "grid",
  },
  imp_swarm: {
    id: "imp_swarm",
    element: "fire",
    cooldownMs: 8000, // Увеличен для баланса
    kind: "summon",
  },
  // ВОДА
  heal_ripple: {
    id: "heal_ripple",
    element: "water",
    cooldownMs: 5500, // Увеличен для баланса
    kind: "heal",
  },
  frost_shield: {
    id: "frost_shield",
    element: "water",
    cooldownMs: 7000, // Увеличен для баланса
    kind: "status",
  },
  tidal_erase: {
    id: "tidal_erase",
    element: "water",
    cooldownMs: 6500, // Увеличен для баланса
    kind: "grid",
  },
  mist_distortion: {
    id: "mist_distortion",
    element: "water",
    cooldownMs: 7500, // Увеличен для баланса
    kind: "status",
  },
  // ЗЕМЛЯ
  stone_skin: {
    id: "stone_skin",
    element: "earth",
    cooldownMs: 7000, // Увеличен для баланса
    kind: "status",
  },
  root_lock: {
    id: "root_lock",
    element: "earth",
    cooldownMs: 7000, // Увеличен для баланса
    kind: "grid",
  },
  quake: {
    id: "quake",
    element: "earth",
    cooldownMs: 7500, // Увеличен для баланса
    kind: "grid",
  },
  golem_tiles: {
    id: "golem_tiles",
    element: "earth",
    cooldownMs: 8000, // Увеличен для баланса
    kind: "summon",
  },
  // ВОЗДУХ
  shock_dart: {
    id: "shock_dart",
    element: "air",
    cooldownMs: 4500, // Увеличен для баланса
    kind: "damage",
  },
  chain_spark: {
    id: "chain_spark",
    element: "air",
    cooldownMs: 6000, // Увеличен для баланса
    kind: "damage",
  },
  wind_sweep: {
    id: "wind_sweep",
    element: "air",
    cooldownMs: 6500, // Увеличен для баланса
    kind: "grid",
  },
  static_jinx: {
    id: "static_jinx",
    element: "air",
    cooldownMs: 7500, // Увеличен для баланса
    kind: "status",
  },
};


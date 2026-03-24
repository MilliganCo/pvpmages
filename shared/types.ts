export type PlayerId = 1 | 2;

export type ElementId = "fire" | "water" | "earth" | "air";

export type SpellId =
  | "fire_bolt"
  | "burn_sigil"
  | "flare_cleanse"
  | "imp_swarm"
  | "heal_ripple"
  | "frost_shield"
  | "tidal_erase"
  | "mist_distortion"
  | "stone_skin"
  | "root_lock"
  | "quake"
  | "golem_tiles"
  | "shock_dart"
  | "chain_spark"
  | "wind_sweep"
  | "static_jinx";

export type StatusId =
  | "shield"
  | "damage_reduction"
  | "mist"
  | "jinx"
  | "burn_dot";

export interface ActiveStatus {
  id: StatusId;
  expiresAt: number; // server time ms
  value?: number; // мощность/объём
}


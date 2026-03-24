import { ElementId } from "../constants";
import { SpellId } from "../types";
import {
  FIRE_BOLT,
  BURN_SIGIL,
  FLARE_CLEANSE,
  IMP_SWARM,
  HEAL_RIPPLE,
  FROST_SHIELD,
  TIDAL_ERASE,
  MIST_DISTORTION,
  STONE_SKIN,
  ROOT_LOCK,
  QUAKE,
  GOLEM_TILES,
  SHOCK_DART,
  CHAIN_SPARK,
  WIND_SWEEP,
  STATIC_JINX,
} from "./glyphPatterns";

export interface GlyphTemplate {
  id: string; // Уникальный ID шаблона
  spellId: SpellId; // Связанное заклинание
  element: ElementId;
  size: number; // Размер нормализации (например 8)
  bitmap: number[][]; // 0/1 маска
  threshold: number; // Порог успеха (0..1)
}

export const GLYPH_LIBRARY: GlyphTemplate[] = [
  // ОГОНЬ
  {
    id: "glyph_fire_bolt",
    spellId: "fire_bolt",
    element: "fire",
    size: 8,
    bitmap: FIRE_BOLT,
    threshold: 0.55,
  },
  {
    id: "glyph_burn_sigil",
    spellId: "burn_sigil",
    element: "fire",
    size: 8,
    bitmap: BURN_SIGIL,
    threshold: 0.58,
  },
  {
    id: "glyph_flare_cleanse",
    spellId: "flare_cleanse",
    element: "fire",
    size: 8,
    bitmap: FLARE_CLEANSE,
    threshold: 0.60,
  },
  {
    id: "glyph_imp_swarm",
    spellId: "imp_swarm",
    element: "fire",
    size: 8,
    bitmap: IMP_SWARM,
    threshold: 0.62,
  },
  // ВОДА
  {
    id: "glyph_heal_ripple",
    spellId: "heal_ripple",
    element: "water",
    size: 8,
    bitmap: HEAL_RIPPLE,
    threshold: 0.65,
  },
  {
    id: "glyph_frost_shield",
    spellId: "frost_shield",
    element: "water",
    size: 8,
    bitmap: FROST_SHIELD,
    threshold: 0.58,
  },
  {
    id: "glyph_tidal_erase",
    spellId: "tidal_erase",
    element: "water",
    size: 8,
    bitmap: TIDAL_ERASE,
    threshold: 0.60,
  },
  {
    id: "glyph_mist_distortion",
    spellId: "mist_distortion",
    element: "water",
    size: 8,
    bitmap: MIST_DISTORTION,
    threshold: 0.70, // Порог для креста из 5 клеток
  },
  // ЗЕМЛЯ
  {
    id: "glyph_stone_skin",
    spellId: "stone_skin",
    element: "earth",
    size: 8,
    bitmap: STONE_SKIN,
    threshold: 0.65,
  },
  {
    id: "glyph_root_lock",
    spellId: "root_lock",
    element: "earth",
    size: 8,
    bitmap: ROOT_LOCK,
    threshold: 0.58,
  },
  {
    id: "glyph_quake",
    spellId: "quake",
    element: "earth",
    size: 8,
    bitmap: QUAKE,
    threshold: 0.60,
  },
  {
    id: "glyph_golem_tiles",
    spellId: "golem_tiles",
    element: "earth",
    size: 8,
    bitmap: GOLEM_TILES,
    threshold: 0.62,
  },
  // ВОЗДУХ
  {
    id: "glyph_shock_dart",
    spellId: "shock_dart",
    element: "air",
    size: 8,
    bitmap: SHOCK_DART,
    threshold: 0.65,
  },
  {
    id: "glyph_chain_spark",
    spellId: "chain_spark",
    element: "air",
    size: 8,
    bitmap: CHAIN_SPARK,
    threshold: 0.58,
  },
  {
    id: "glyph_wind_sweep",
    spellId: "wind_sweep",
    element: "air",
    size: 8,
    bitmap: WIND_SWEEP,
    threshold: 0.60,
  },
  {
    id: "glyph_static_jinx",
    spellId: "static_jinx",
    element: "air",
    size: 8,
    bitmap: STATIC_JINX,
    threshold: 0.62,
  },
];


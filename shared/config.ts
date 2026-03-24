// Размеры поля (квадратное поле)
export const GRID_SIZE = 8;
export const GRID_WIDTH = GRID_SIZE;
export const GRID_HEIGHT = GRID_SIZE;

// Ресурсы игрока
export const STARTING_HP = 100;
export const STARTING_INK = 100;
export const MAX_INK = 100;

// Механика рисования
export const DRAW_COST_PER_CELL = 1; // Ink за изменённую клетку

// Регенерация
export const INK_REGEN_PER_SECOND = 10;
export const TICK_RATE_MS = 100; // Интервал серверного тика

// Backfire (ошибка распознавания)
export const BACKFIRE_DAMAGE = 8; // Урон себе при неудачном касте (снижен для баланса)
export const CAST_COOLDOWN_MS = 600; // Кулдаун после каста (success или fail)

// Распознавание глифов
export const GLYPH_NORMALIZE_SIZE = 8; // Размер нормализации для сравнения
export const MIN_COMPONENT_SIZE = 2; // Минимальный размер компоненты для распознавания (уменьшено для маленьких глифов)
export const ACTIVE_WINDOW_MS = 5000; // Окно времени для "свежих" штрихов
export const MIN_ACTIVE_CELLS = 3; // Минимальное количество клеток в active-слое для использования
export const MERGE_DISTANCE = 3; // Расстояние для объединения компонент (клетки)
export const NORMALIZATION_PADDING = 1; // Padding вокруг bbox при нормализации

// Прототипный эффект каста (успешный)
export const TEST_SPELL_DAMAGE = 12; // Урон от успешного каста

// ========== ЗАКЛИНАНИЯ ==========

import { SpellId } from "./types";

export interface SpellConfig {
  cooldownMs: number;
  damage?: number;
  heal?: number;
  shieldValue?: number;
  durationMs?: number;
  eraseCount?: number;
  radius?: number;
  summon?: { count: number; ttlMs: number; moveEveryMs: number };
  thresholdOverride?: number;
}

export const SPELL_CONFIG: Record<SpellId, SpellConfig> = {
  // ОГОНЬ
  fire_bolt: {
    cooldownMs: 900,
    damage: 14,
  },
  burn_sigil: {
    cooldownMs: 1800,
    durationMs: 3000,
    // DoT damage применяется через статус
  },
  flare_cleanse: {
    cooldownMs: 2000,
    eraseCount: 4, // Уменьшено для поля 12×12
    radius: 1, // Уменьшено для поля 12×12
  },
  imp_swarm: {
    cooldownMs: 2800, // Увеличен для баланса
    summon: {
      count: 2, // Уменьшено для поля 12×12
      ttlMs: 5500,
      moveEveryMs: 350,
    },
  },
  // ВОДА
  heal_ripple: {
    cooldownMs: 1200,
    heal: 12,
  },
  frost_shield: {
    cooldownMs: 2000,
    shieldValue: 20,
    durationMs: 5000,
  },
  tidal_erase: {
    cooldownMs: 1800,
    eraseCount: 4, // Уменьшено для поля 16×16
    radius: 1, // Толщина полосы
  },
  mist_distortion: {
    cooldownMs: 2200,
    durationMs: 4000,
  },
  // ЗЕМЛЯ
  stone_skin: {
    cooldownMs: 2000,
    durationMs: 5000,
    // damage_reduction применяется через статус
  },
  root_lock: {
    cooldownMs: 2200, // Увеличен для баланса
    eraseCount: 2, // Уменьшено для поля 16×16
    radius: 1, // Уменьшено для поля 16×16
  },
  quake: {
    cooldownMs: 2200,
    eraseCount: 3, // Уменьшено для поля 16×16
    radius: 1, // Уменьшено для поля 16×16
  },
  golem_tiles: {
    cooldownMs: 2800, // Увеличен для баланса
    summon: {
      count: 1, // Уменьшено для поля 12×12
      ttlMs: 6500,
      moveEveryMs: 550,
    },
  },
  // ВОЗДУХ
  shock_dart: {
    cooldownMs: 600,
    damage: 10,
  },
  chain_spark: {
    cooldownMs: 1500,
    damage: 8, // базовый, увеличивается динамически
  },
  wind_sweep: {
    cooldownMs: 1800,
    eraseCount: 3, // Уменьшено для поля 16×16
    radius: 1, // Уменьшено для поля 16×16
  },
  static_jinx: {
    cooldownMs: 2200,
    durationMs: 4000,
  },
};

// Legacy константы для обратной совместимости (будут удалены позже)
export const FIRE_BOLT_DAMAGE = SPELL_CONFIG.fire_bolt.damage!;
export const FIRE_BOLT_COOLDOWN_MS = SPELL_CONFIG.fire_bolt.cooldownMs;
export const BURN_SIGIL_DOT_DAMAGE = 4;
export const BURN_SIGIL_DURATION_MS = SPELL_CONFIG.burn_sigil.durationMs!;
export const BURN_SIGIL_COOLDOWN_MS = SPELL_CONFIG.burn_sigil.cooldownMs;
export const FLARE_CLEANSE_RADIUS = SPELL_CONFIG.flare_cleanse.radius!;
export const FLARE_CLEANSE_CELLS = SPELL_CONFIG.flare_cleanse.eraseCount!;
export const FLARE_CLEANSE_COOLDOWN_MS = SPELL_CONFIG.flare_cleanse.cooldownMs;
export const IMP_SWARM_COUNT = SPELL_CONFIG.imp_swarm.summon!.count;
export const IMP_SWARM_TTL_MS = SPELL_CONFIG.imp_swarm.summon!.ttlMs;
export const IMP_SWARM_MOVE_INTERVAL_MS = SPELL_CONFIG.imp_swarm.summon!.moveEveryMs;
export const IMP_SWARM_COOLDOWN_MS = SPELL_CONFIG.imp_swarm.cooldownMs;
export const HEAL_RIPPLE_HEAL = SPELL_CONFIG.heal_ripple.heal!;
export const HEAL_RIPPLE_COOLDOWN_MS = SPELL_CONFIG.heal_ripple.cooldownMs;
export const FROST_SHIELD_VALUE = SPELL_CONFIG.frost_shield.shieldValue!;
export const FROST_SHIELD_DURATION_MS = SPELL_CONFIG.frost_shield.durationMs!;
export const FROST_SHIELD_COOLDOWN_MS = SPELL_CONFIG.frost_shield.cooldownMs;
export const TIDAL_ERASE_LENGTH = SPELL_CONFIG.tidal_erase.eraseCount!;
export const TIDAL_ERASE_THICKNESS = SPELL_CONFIG.tidal_erase.radius!;
export const TIDAL_ERASE_COOLDOWN_MS = SPELL_CONFIG.tidal_erase.cooldownMs;
export const MIST_DISTORTION_THRESHOLD_BONUS = 0.08;
export const MIST_DISTORTION_DURATION_MS = SPELL_CONFIG.mist_distortion.durationMs!;
export const MIST_DISTORTION_COOLDOWN_MS = SPELL_CONFIG.mist_distortion.cooldownMs;
export const STONE_SKIN_REDUCTION = 0.35;
export const STONE_SKIN_DURATION_MS = SPELL_CONFIG.stone_skin.durationMs!;
export const STONE_SKIN_COOLDOWN_MS = SPELL_CONFIG.stone_skin.cooldownMs;
export const ROOT_LOCK_COUNT = SPELL_CONFIG.root_lock.eraseCount!;
export const ROOT_LOCK_RADIUS = SPELL_CONFIG.root_lock.radius!;
export const ROOT_LOCK_TTL_MS = 3000;
export const ROOT_LOCK_COOLDOWN_MS = SPELL_CONFIG.root_lock.cooldownMs;
export const QUAKE_RADIUS = SPELL_CONFIG.quake.radius!;
export const QUAKE_CELLS = SPELL_CONFIG.quake.eraseCount!;
export const QUAKE_COOLDOWN_MS = SPELL_CONFIG.quake.cooldownMs;
export const GOLEM_TILES_COUNT = SPELL_CONFIG.golem_tiles.summon!.count;
export const GOLEM_TILES_TTL_MS = SPELL_CONFIG.golem_tiles.summon!.ttlMs;
export const GOLEM_TILES_MOVE_INTERVAL_MS = SPELL_CONFIG.golem_tiles.summon!.moveEveryMs;
export const GOLEM_TILES_COOLDOWN_MS = SPELL_CONFIG.golem_tiles.cooldownMs;
export const SHOCK_DART_DAMAGE = SPELL_CONFIG.shock_dart.damage!;
export const SHOCK_DART_COOLDOWN_MS = SPELL_CONFIG.shock_dart.cooldownMs;
export const CHAIN_SPARK_BASE_DAMAGE = SPELL_CONFIG.chain_spark.damage!;
export const CHAIN_SPARK_DAMAGE_PER_20_DRAWS = 2;
export const CHAIN_SPARK_MAX_DAMAGE = 18;
export const CHAIN_SPARK_WINDOW_MS = 2000;
export const CHAIN_SPARK_COOLDOWN_MS = SPELL_CONFIG.chain_spark.cooldownMs;
export const WIND_SWEEP_RADIUS = SPELL_CONFIG.wind_sweep.radius!;
export const WIND_SWEEP_CELLS = SPELL_CONFIG.wind_sweep.eraseCount!;
export const WIND_SWEEP_COOLDOWN_MS = SPELL_CONFIG.wind_sweep.cooldownMs;
export const STATIC_JINX_DURATION_MS = SPELL_CONFIG.static_jinx.durationMs!;
export const STATIC_JINX_COOLDOWN_MS = SPELL_CONFIG.static_jinx.cooldownMs;

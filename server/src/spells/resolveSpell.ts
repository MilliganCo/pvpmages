import { PlayerId, SpellId, ElementId, StatusId } from "../../../shared/types";
import { RecognitionResult, mapCentroidToTarget } from "../../../shared/glyphs/recognize";
import { GRID_WIDTH, GRID_HEIGHT } from "../../../shared/config";
import {
  FIRE_BOLT_DAMAGE,
  BURN_SIGIL_DOT_DAMAGE,
  BURN_SIGIL_DURATION_MS,
  FLARE_CLEANSE_RADIUS,
  FLARE_CLEANSE_CELLS,
  IMP_SWARM_COUNT,
  HEAL_RIPPLE_HEAL,
  FROST_SHIELD_VALUE,
  FROST_SHIELD_DURATION_MS,
  TIDAL_ERASE_LENGTH,
  TIDAL_ERASE_THICKNESS,
  MIST_DISTORTION_THRESHOLD_BONUS,
  MIST_DISTORTION_DURATION_MS,
  STONE_SKIN_REDUCTION,
  STONE_SKIN_DURATION_MS,
  ROOT_LOCK_COUNT,
  ROOT_LOCK_RADIUS,
  ROOT_LOCK_TTL_MS,
  QUAKE_RADIUS,
  QUAKE_CELLS,
  GOLEM_TILES_COUNT,
  CHAIN_SPARK_BASE_DAMAGE,
  CHAIN_SPARK_DAMAGE_PER_20_DRAWS,
  CHAIN_SPARK_MAX_DAMAGE,
  WIND_SWEEP_RADIUS,
  WIND_SWEEP_CELLS,
  STATIC_JINX_DURATION_MS,
} from "../../../shared/config";
import { StatusManager } from "../status/statusManager";
import { SummonSystem, SummonKind } from "../summons/summonSystem";
import { CellKind } from "../../../shared/grid";

export interface CastContext {
  casterId: PlayerId;
  targetId: PlayerId;
  element: ElementId;
  recognition: RecognitionResult;
  now: number;
}

export interface SpellResolution {
  hpChange?: { playerId: PlayerId; amount: number };
  statusChanges?: Array<{ playerId: PlayerId; statusId: StatusId; value?: number; durationMs: number }>;
  gridMutations?: Array<{ playerId: PlayerId; x: number; y: number; kind: CellKind; element?: ElementId; symbol?: string }>;
  summonSpawns?: Array<{ kind: SummonKind; x: number; y: number }>;
}

interface GameState {
  grids: Map<PlayerId, (ElementId | null)[][]>;
  obstacles: Map<PlayerId, Map<string, { x: number; y: number; expiresAt: number }>>;
  recentDrawCounts: Map<PlayerId, Array<number>>; // timestamps последних рисований
}

export function resolveSpell(
  ctx: CastContext,
  state: GameState,
  statusManager: StatusManager,
  summonSystem: SummonSystem
): SpellResolution {
  const { casterId, targetId, recognition, now } = ctx;
  const spellId = recognition.spellId!;

  // Вычисляем целевую точку на поле оппонента
  const targetRel = recognition.centroid
    ? mapCentroidToTarget(recognition.centroid, GRID_WIDTH, GRID_HEIGHT)
    : { rx: 0.5, ry: 0.5 };
  const targetX = Math.round(targetRel.rx * (GRID_WIDTH - 1));
  const targetY = Math.round(targetRel.ry * (GRID_HEIGHT - 1));

  const resolution: SpellResolution = {};

  switch (spellId) {
    // ========== ОГОНЬ ==========
    case "fire_bolt":
      resolution.hpChange = { playerId: targetId, amount: -FIRE_BOLT_DAMAGE };
      break;

    case "burn_sigil":
      resolution.statusChanges = [
        {
          playerId: targetId,
          statusId: "burn_dot",
          value: BURN_SIGIL_DOT_DAMAGE,
          durationMs: BURN_SIGIL_DURATION_MS,
        },
      ];
      break;

    case "flare_cleanse": {
      const cells = getCellsInRadius(state.grids.get(targetId)!, targetX, targetY, FLARE_CLEANSE_RADIUS);
      const toRemove = cells.slice(0, FLARE_CLEANSE_CELLS);
      resolution.gridMutations = toRemove.map(({ x, y }) => ({
        playerId: targetId,
        x,
        y,
        kind: "empty" as CellKind,
      }));
      break;
    }

    case "imp_swarm": {
      const spawns: Array<{ kind: SummonKind; x: number; y: number }> = [];
      for (let i = 0; i < IMP_SWARM_COUNT; i++) {
        const angle = (i / IMP_SWARM_COUNT) * Math.PI * 2;
        const offsetX = Math.round(Math.cos(angle) * 3);
        const offsetY = Math.round(Math.sin(angle) * 3);
        spawns.push({
          kind: "imp",
          x: Math.max(0, Math.min(GRID_WIDTH - 1, targetX + offsetX)),
          y: Math.max(0, Math.min(GRID_HEIGHT - 1, targetY + offsetY)),
        });
      }
      resolution.summonSpawns = spawns;
      break;
    }

    // ========== ВОДА ==========
    case "heal_ripple":
      resolution.hpChange = { playerId: casterId, amount: HEAL_RIPPLE_HEAL };
      break;

    case "frost_shield":
      resolution.statusChanges = [
        {
          playerId: casterId,
          statusId: "shield",
          value: FROST_SHIELD_VALUE,
          durationMs: FROST_SHIELD_DURATION_MS,
        },
      ];
      break;

    case "tidal_erase": {
      const bbox = recognition.bbox!;
      const isHorizontal = bbox.maxX - bbox.minX > bbox.maxY - bbox.minY;
      const cells: Array<{ x: number; y: number }> = [];

      if (isHorizontal) {
        // Горизонтальная полоса
        const startX = Math.max(0, targetX - TIDAL_ERASE_LENGTH / 2);
        const endX = Math.min(GRID_WIDTH - 1, targetX + TIDAL_ERASE_LENGTH / 2);
        for (let x = startX; x <= endX; x++) {
          for (let dy = -TIDAL_ERASE_THICKNESS; dy <= TIDAL_ERASE_THICKNESS; dy++) {
            const y = Math.max(0, Math.min(GRID_HEIGHT - 1, targetY + dy));
            cells.push({ x, y });
          }
        }
      } else {
        // Вертикальная полоса
        const startY = Math.max(0, targetY - TIDAL_ERASE_LENGTH / 2);
        const endY = Math.min(GRID_HEIGHT - 1, targetY + TIDAL_ERASE_LENGTH / 2);
        for (let y = startY; y <= endY; y++) {
          for (let dx = -TIDAL_ERASE_THICKNESS; dx <= TIDAL_ERASE_THICKNESS; dx++) {
            const x = Math.max(0, Math.min(GRID_WIDTH - 1, targetX + dx));
            cells.push({ x, y });
          }
        }
      }

      resolution.gridMutations = cells.map(({ x, y }) => ({
        playerId: targetId,
        x,
        y,
        kind: "empty" as CellKind,
      }));
      break;
    }

    case "mist_distortion":
      resolution.statusChanges = [
        {
          playerId: targetId,
          statusId: "mist",
          value: MIST_DISTORTION_THRESHOLD_BONUS,
          durationMs: MIST_DISTORTION_DURATION_MS,
        },
      ];
      break;

    // ========== ЗЕМЛЯ ==========
    case "stone_skin":
      resolution.statusChanges = [
        {
          playerId: casterId,
          statusId: "damage_reduction",
          value: STONE_SKIN_REDUCTION,
          durationMs: STONE_SKIN_DURATION_MS,
        },
      ];
      break;

    case "root_lock": {
      const obstacles: Array<{ x: number; y: number }> = [];
      const attempts = ROOT_LOCK_COUNT * 3; // Больше попыток для лучшего распределения
      for (let i = 0; i < attempts && obstacles.length < ROOT_LOCK_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * ROOT_LOCK_RADIUS;
        const x = Math.round(targetX + Math.cos(angle) * dist);
        const y = Math.round(targetY + Math.sin(angle) * dist);
        if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
          const key = `${x},${y}`;
          if (!obstacles.some((o) => o.x === x && o.y === y)) {
            obstacles.push({ x, y });
          }
        }
      }

      resolution.gridMutations = obstacles.map(({ x, y }) => ({
        playerId: targetId,
        x,
        y,
        kind: "obstacle" as CellKind,
        symbol: "X",
      }));
      break;
    }

    case "quake": {
      const cells = getCellsInRadius(state.grids.get(targetId)!, targetX, targetY, QUAKE_RADIUS);
      const shuffled = cells.sort(() => Math.random() - 0.5);
      const toDestroy = shuffled.slice(0, Math.min(QUAKE_CELLS, shuffled.length));
      resolution.gridMutations = toDestroy.map(({ x, y }) => ({
        playerId: targetId,
        x,
        y,
        kind: "empty" as CellKind,
      }));
      break;
    }

    case "golem_tiles": {
      const spawns: Array<{ kind: SummonKind; x: number; y: number }> = [];
      for (let i = 0; i < GOLEM_TILES_COUNT; i++) {
        const angle = (i / GOLEM_TILES_COUNT) * Math.PI * 2;
        const offsetX = Math.round(Math.cos(angle) * 4);
        const offsetY = Math.round(Math.sin(angle) * 4);
        spawns.push({
          kind: "golem",
          x: Math.max(0, Math.min(GRID_WIDTH - 1, targetX + offsetX)),
          y: Math.max(0, Math.min(GRID_HEIGHT - 1, targetY + offsetY)),
        });
      }
      resolution.summonSpawns = spawns;
      break;
    }

    // ========== ВОЗДУХ ==========
    case "shock_dart":
      resolution.hpChange = { playerId: targetId, amount: -10 };
      break;

    case "chain_spark": {
      const recentDraws = state.recentDrawCounts.get(targetId) || [];
      const windowStart = now - 2000;
      const count = recentDraws.filter((t) => t >= windowStart).length;
      const damage = Math.min(
        CHAIN_SPARK_MAX_DAMAGE,
        CHAIN_SPARK_BASE_DAMAGE + Math.floor((count / 20) * CHAIN_SPARK_DAMAGE_PER_20_DRAWS)
      );
      resolution.hpChange = { playerId: targetId, amount: -damage };
      break;
    }

    case "wind_sweep": {
      const cells = getCellsInRadius(state.grids.get(targetId)!, targetX, targetY, WIND_SWEEP_RADIUS);
      const shuffled = cells.sort(() => Math.random() - 0.5);
      const toRemove = shuffled.slice(0, Math.min(WIND_SWEEP_CELLS, shuffled.length));
      resolution.gridMutations = toRemove.map(({ x, y }) => ({
        playerId: targetId,
        x,
        y,
        kind: "empty" as CellKind,
      }));
      break;
    }

    case "static_jinx":
      resolution.statusChanges = [
        {
          playerId: targetId,
          statusId: "jinx",
          value: 1,
          durationMs: STATIC_JINX_DURATION_MS,
        },
      ];
      break;
  }

  return resolution;
}

function getCellsInRadius(
  grid: (ElementId | null)[][],
  centerX: number,
  centerY: number,
  radius: number
): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = Math.max(0, centerY - radius); y <= Math.min(GRID_HEIGHT - 1, centerY + radius); y++) {
    for (let x = Math.max(0, centerX - radius); x <= Math.min(GRID_WIDTH - 1, centerX + radius); x++) {
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (dist <= radius && grid[y][x] !== null) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}


import { PlayerId } from "../../../shared/types";
import { GRID_WIDTH, GRID_HEIGHT } from "../../../shared/config";
import {
  IMP_SWARM_TTL_MS,
  IMP_SWARM_MOVE_INTERVAL_MS,
  GOLEM_TILES_TTL_MS,
  GOLEM_TILES_MOVE_INTERVAL_MS,
} from "../../../shared/config";

export type SummonKind = "imp" | "golem";

export interface SummonEntity {
  id: string;
  ownerCasterId: PlayerId;
  targetPlayerId: PlayerId;
  kind: SummonKind;
  x: number;
  y: number;
  symbol: string;
  expiresAt: number;
  nextMoveAt: number;
}

export class SummonSystem {
  private summons: Map<string, SummonEntity> = new Map();
  private nextId = 0;

  spawn(
    casterId: PlayerId,
    targetId: PlayerId,
    kind: SummonKind,
    x: number,
    y: number,
    now: number
  ): SummonEntity {
    const id = `summon_${this.nextId++}`;
    const ttl = kind === "imp" ? IMP_SWARM_TTL_MS : GOLEM_TILES_TTL_MS;
    const moveInterval = kind === "imp" ? IMP_SWARM_MOVE_INTERVAL_MS : GOLEM_TILES_MOVE_INTERVAL_MS;

    const summon: SummonEntity = {
      id,
      ownerCasterId: casterId,
      targetPlayerId: targetId,
      kind,
      x: Math.max(0, Math.min(GRID_WIDTH - 1, x)),
      y: Math.max(0, Math.min(GRID_HEIGHT - 1, y)),
      symbol: kind === "imp" ? "i" : "G",
      expiresAt: now + ttl,
      nextMoveAt: now + moveInterval,
    };

    this.summons.set(id, summon);
    return summon;
  }

  tick(now: number): {
    moved: Array<{ old: SummonEntity; new: SummonEntity }>;
    expired: SummonEntity[];
  } {
    const moved: Array<{ old: SummonEntity; new: SummonEntity }> = [];
    const expired: SummonEntity[] = [];

    for (const [id, summon] of this.summons.entries()) {
      if (summon.expiresAt <= now) {
        expired.push(summon);
        this.summons.delete(id);
        continue;
      }

      if (summon.nextMoveAt <= now) {
        const newPos = this.moveSummon(summon);
        const newSummon = {
          ...summon,
          ...newPos,
          nextMoveAt: now + (summon.kind === "imp" ? IMP_SWARM_MOVE_INTERVAL_MS : GOLEM_TILES_MOVE_INTERVAL_MS),
        };
        moved.push({ old: summon, new: newSummon });
        this.summons.set(id, newSummon);
      }
    }

    return { moved, expired };
  }

  private moveSummon(summon: SummonEntity): { x: number; y: number } {
    // Простое случайное движение
    const directions = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];
    const dir = directions[Math.floor(Math.random() * directions.length)];

    const newX = Math.max(0, Math.min(GRID_WIDTH - 1, summon.x + dir.x));
    const newY = Math.max(0, Math.min(GRID_HEIGHT - 1, summon.y + dir.y));

    return { x: newX, y: newY };
  }

  getSummonAt(x: number, y: number): SummonEntity | undefined {
    for (const summon of this.summons.values()) {
      if (summon.x === x && summon.y === y) {
        return summon;
      }
    }
    return undefined;
  }

  getAllSummons(): SummonEntity[] {
    return Array.from(this.summons.values());
  }

  getSummonsForPlayer(playerId: PlayerId): SummonEntity[] {
    return Array.from(this.summons.values()).filter(
      (s) => s.targetPlayerId === playerId
    );
  }

  removeSummon(id: string): void {
    this.summons.delete(id);
  }

  clear(): void {
    this.summons.clear();
  }
}


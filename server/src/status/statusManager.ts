import { PlayerId, StatusId, ActiveStatus } from "../../../shared/types";

export class StatusManager {
  private statuses: Map<PlayerId, Map<StatusId, ActiveStatus>> = new Map();

  addStatus(playerId: PlayerId, status: ActiveStatus): void {
    if (!this.statuses.has(playerId)) {
      this.statuses.set(playerId, new Map());
    }
    this.statuses.get(playerId)!.set(status.id, status);
  }

  removeStatus(playerId: PlayerId, statusId: StatusId): void {
    this.statuses.get(playerId)?.delete(statusId);
  }

  getStatus(playerId: PlayerId, statusId: StatusId): ActiveStatus | undefined {
    return this.statuses.get(playerId)?.get(statusId);
  }

  getAllStatuses(playerId: PlayerId): ActiveStatus[] {
    return Array.from(this.statuses.get(playerId)?.values() || []);
  }

  tick(now: number): Map<PlayerId, ActiveStatus[]> {
    const updates = new Map<PlayerId, ActiveStatus[]>();

    for (const [playerId, playerStatuses] of this.statuses.entries()) {
      const expired: StatusId[] = [];
      const active: ActiveStatus[] = [];

      for (const [statusId, status] of playerStatuses.entries()) {
        if (status.expiresAt <= now) {
          expired.push(statusId);
        } else {
          active.push(status);
        }
      }

      // Удаляем истёкшие статусы
      for (const statusId of expired) {
        playerStatuses.delete(statusId);
      }

      if (expired.length > 0 || active.length > 0) {
        updates.set(playerId, active);
      }
    }

    return updates;
  }

  clear(): void {
    this.statuses.clear();
  }
}


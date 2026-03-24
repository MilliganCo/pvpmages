import { ElementId } from "./constants";
import { PlayerId, SpellId, StatusId, ActiveStatus } from "./types";
import { CellKind } from "./grid";

// ========== Client → Server ==========

export interface JoinMessage {
  type: "join";
  playerName?: string;
  debugPreferredSlot?: PlayerId; // Для локального тестирования через /p1 и /p2
}

export interface ReadyMessage {
  type: "ready";
}

export interface SelectElementMessage {
  type: "select_element";
  element: ElementId;
}

export interface DrawMessage {
  type: "draw";
  x: number;
  y: number;
  element: ElementId;
}

export interface CastMessage {
  type: "cast";
}

export interface ClearGridMessage {
  type: "clear_grid";
}

export type ClientToServer =
  | JoinMessage
  | ReadyMessage
  | SelectElementMessage
  | DrawMessage
  | CastMessage
  | ClearGridMessage;

// ========== Server → Client ==========

export interface SessionStateMessage {
  type: "session_state";
  players: Record<PlayerId, {
    playerId: PlayerId;
    hp: number;
    ink: number;
    selectedElement: ElementId | null;
    ready: boolean;
  }>;
  gridsMeta: Record<PlayerId, {
    width: number;
    height: number;
  }>;
}

export interface PlayerJoinedMessage {
  type: "player_joined";
  playerId: PlayerId;
  isYou?: boolean; // Флаг для клиента, что это его ID
}

export interface BothReadyMessage {
  type: "both_ready";
}

export interface GridPatchMessage {
  type: "grid_patch";
  playerId: PlayerId;
  cells: Array<{
    x: number;
    y: number;
    kind: CellKind;
    element?: ElementId;
    symbol?: string;
  }>;
}

export interface HpInkUpdateMessage {
  type: "hp_ink_update";
  playerId: PlayerId;
  hp: number;
  ink: number;
}

export interface CastResultMessage {
  type: "cast_result";
  playerId: PlayerId;
  success: boolean;
  spellId?: SpellId;
  selfDamage?: number;
  score?: number;
  failReason?: "no_glyph" | "score_too_low" | "on_cooldown" | "unknown";
  targetPoint?: { x: number; y: number }; // Целевая точка на поле оппонента для визуального фидбека
}

export interface StatusUpdateMessage {
  type: "status_update";
  playerId: PlayerId;
  statuses: ActiveStatus[];
}

export interface GameOverMessage {
  type: "game_over";
  winnerId: PlayerId;
  stats: {
    player1: { hp: number; spellsCast: number };
    player2: { hp: number; spellsCast: number };
  };
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type ServerToClient =
  | SessionStateMessage
  | PlayerJoinedMessage
  | BothReadyMessage
  | GridPatchMessage
  | HpInkUpdateMessage
  | CastResultMessage
  | StatusUpdateMessage
  | GameOverMessage
  | ErrorMessage;


import { WebSocketServer, WebSocket } from "ws";
import os from "os";
import {
  ClientToServer,
  ServerToClient,
  PlayerId,
  JoinMessage,
  ReadyMessage,
  SelectElementMessage,
  DrawMessage,
  CastMessage,
  ClearGridMessage,
} from "../../shared/protocol";
import { ElementId } from "../../shared/constants";
import { SpellId, StatusId } from "../../shared/types";
import { SPELLS } from "../../shared/spells/spellRegistry";
import {
  GRID_WIDTH,
  GRID_HEIGHT,
  STARTING_HP,
  STARTING_INK,
  MAX_INK,
  DRAW_COST_PER_CELL,
  INK_REGEN_PER_SECOND,
  TICK_RATE_MS,
  BACKFIRE_DAMAGE,
  CAST_COOLDOWN_MS,
  BURN_SIGIL_DOT_DAMAGE,
  MIST_DISTORTION_THRESHOLD_BONUS,
} from "../../shared/config";
import { recognizeGlyph, recognizeGlyphWithActiveLayer, mapCentroidToTarget } from "../../shared/glyphs/recognize";
import { PaintMeta } from "../../shared/glyphs/paintMeta";
import { GLYPH_LIBRARY } from "../../shared/glyphs/glyphLibrary";
import { StatusManager } from "./status/statusManager";
import { SummonSystem } from "./summons/summonSystem";
import { resolveSpell, CastContext } from "./spells/resolveSpell";
import { CellKind } from "../../shared/grid";
import { ROOT_LOCK_TTL_MS } from "../../shared/config";

interface Player {
  id: PlayerId;
  ws: WebSocket;
  hp: number;
  ink: number;
  selectedElement: ElementId | null;
  ready: boolean;
  lastCastTime: number;
  cooldowns: Map<SpellId, number>;
  playerName?: string;
  spellsCast: number; // Счётчик успешных кастов
}

interface GameSession {
  players: Map<PlayerId, Player>;
  grids: Map<PlayerId, (ElementId | null)[][]>;
  obstacles: Map<PlayerId, Map<string, { x: number; y: number; expiresAt: number }>>;
  paintMeta: Map<PlayerId, Map<string, PaintMeta>>; // трекинг свежих штрихов
  castGenerations: Map<PlayerId, number>; // текущее поколение кастов
  gameStarted: boolean;
  gameOver: boolean;
  recentDrawCounts: Map<PlayerId, number[]>; // timestamps последних рисований
}

const PORT = 8080;
const session: GameSession = {
  players: new Map(),
  grids: new Map(),
  obstacles: new Map(),
  paintMeta: new Map(),
  castGenerations: new Map(),
  gameStarted: false,
  gameOver: false,
  recentDrawCounts: new Map(),
};

const statusManager = new StatusManager();
const summonSystem = new SummonSystem();

function createEmptyGrid(): (ElementId | null)[][] {
  return Array(GRID_HEIGHT)
    .fill(null)
    .map(() => Array(GRID_WIDTH).fill(null));
}

function sendToClient(ws: WebSocket, message: ServerToClient) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcast(message: ServerToClient) {
  session.players.forEach((player) => {
    sendToClient(player.ws, message);
  });
}

function getOpponentId(playerId: PlayerId): PlayerId | null {
  return playerId === 1 ? 2 : 1;
}

function applyDamage(playerId: PlayerId, amount: number, now: number): number {
  const player = session.players.get(playerId);
  if (!player) return 0;

  // Проверяем щит
  const shield = statusManager.getStatus(playerId, "shield");
  let remainingDamage = amount;

  if (shield && shield.value) {
    if (shield.value >= remainingDamage) {
      shield.value -= remainingDamage;
      remainingDamage = 0;
      if (shield.value <= 0) {
        statusManager.removeStatus(playerId, "shield");
      }
    } else {
      remainingDamage -= shield.value;
      statusManager.removeStatus(playerId, "shield");
    }
  }

  // Проверяем редукцию урона
  const damageReduction = statusManager.getStatus(playerId, "damage_reduction");
  if (damageReduction && damageReduction.value) {
    remainingDamage = Math.floor(remainingDamage * (1 - damageReduction.value));
  }

  // Применяем урон
  const actualDamage = Math.min(remainingDamage, player.hp);
  player.hp = Math.max(0, player.hp - actualDamage);
  return actualDamage;
}

function handleJoin(ws: WebSocket, msg: JoinMessage) {
  if (session.players.size >= 2) {
    sendToClient(ws, {
      type: "error",
      message: "Сессия заполнена (максимум 2 игрока)",
    });
    ws.close();
    return;
  }

  // Поддержка debugPreferredSlot для локального тестирования
  let playerId: PlayerId;
  if (msg.debugPreferredSlot && !session.players.has(msg.debugPreferredSlot)) {
    playerId = msg.debugPreferredSlot;
  } else {
    playerId = session.players.size === 0 ? 1 : 2;
  }
  const player: Player = {
    id: playerId,
    ws,
    hp: STARTING_HP,
    ink: STARTING_INK,
    selectedElement: null,
    ready: false,
    lastCastTime: 0,
    cooldowns: new Map(),
    playerName: msg.playerName,
    spellsCast: 0,
  };

  session.players.set(playerId, player);
  session.grids.set(playerId, createEmptyGrid());
  session.obstacles.set(playerId, new Map());
  session.paintMeta.set(playerId, new Map());
  session.castGenerations.set(playerId, 0);
  session.recentDrawCounts.set(playerId, []);

  // Отправляем состояние сессии новому игроку
  const playersState: Record<PlayerId, any> = {};
  session.players.forEach((p) => {
    playersState[p.id] = {
      playerId: p.id,
      hp: p.hp,
      ink: p.ink,
      selectedElement: p.selectedElement,
      ready: p.ready,
    };
  });

  sendToClient(ws, {
    type: "session_state",
    players: playersState,
    gridsMeta: {
      1: { width: GRID_WIDTH, height: GRID_HEIGHT },
      2: { width: GRID_WIDTH, height: GRID_HEIGHT },
    },
  });

  // Отправляем явное сообщение о присвоенном ID новому игроку
  sendToClient(ws, {
    type: "player_joined",
    playerId,
    isYou: true,
  } as any);

  // Уведомляем остальных о новом игроке
  session.players.forEach((p) => {
    if (p.id !== playerId) {
      sendToClient(p.ws, {
        type: "player_joined",
        playerId,
        isYou: false,
      } as any);
    }
  });
}

function checkGameOver() {
  if (session.gameOver || !session.gameStarted) return;

  const players = Array.from(session.players.values());
  if (players.length !== 2) return;

  const player1 = players.find((p) => p.id === 1);
  const player2 = players.find((p) => p.id === 2);

  if (!player1 || !player2) return;

  // Проверяем условие победы
  if (player1.hp <= 0 || player2.hp <= 0) {
    session.gameOver = true;
    const winnerId = player1.hp > 0 ? 1 : 2;

    broadcast({
      type: "game_over",
      winnerId,
      stats: {
        player1: {
          hp: player1.hp,
          spellsCast: player1.spellsCast,
        },
        player2: {
          hp: player2.hp,
          spellsCast: player2.spellsCast,
        },
      },
    });
  }
}

function handleReady(player: Player, msg: ReadyMessage) {
  player.ready = true;

  // Проверяем, готовы ли оба игрока
  if (session.players.size === 2) {
    const allReady = Array.from(session.players.values()).every((p) => p.ready);
    if (allReady && !session.gameStarted) {
      session.gameStarted = true;
      broadcast({
        type: "both_ready",
      });
    }
  }
}

function handleSelectElement(player: Player, msg: SelectElementMessage) {
  if (!session.gameStarted) {
    sendToClient(player.ws, {
      type: "error",
      message: "Игра ещё не началась",
    });
    return;
  }

  // Проверяем jinx статус
  const jinx = statusManager.getStatus(player.id, "jinx");
  if (jinx) {
    // Циклически смещаем выбор элемента
    const elements: ElementId[] = ["fire", "water", "earth", "air"];
    const currentIndex = elements.indexOf(msg.element);
    const nextIndex = (currentIndex + 1) % elements.length;
    player.selectedElement = elements[nextIndex];
  } else {
    player.selectedElement = msg.element;
  }
}

function handleDraw(player: Player, msg: DrawMessage) {
  if (!session.gameStarted) {
    return;
  }

  const { x, y, element } = msg;

  // Валидация границ
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
    return;
  }

  // Проверка ресурса
  if (player.ink < DRAW_COST_PER_CELL) {
    return;
  }

  const grid = session.grids.get(player.id);
  if (!grid) return;

  // Проверяем препятствия
  const obstacles = session.obstacles.get(player.id);
  const obstacleKey = `${x},${y}`;
  if (obstacles?.has(obstacleKey)) {
    return; // Нельзя рисовать на препятствии
  }

  // Проверяем, не рисуем ли мы уже тот же элемент
  if (grid[y][x] === element) {
    return;
  }

  // Обновляем клетку
  grid[y][x] = element;
  player.ink -= DRAW_COST_PER_CELL;

  // Трекинг paintMeta для active-слоя
  const paintMetaMap = session.paintMeta.get(player.id)!;
  const cellKey = `${x},${y}`;
  const currentGeneration = session.castGenerations.get(player.id) || 0;
  paintMetaMap.set(cellKey, {
    lastPaintAt: Date.now(),
    castGeneration: currentGeneration,
  });

  // Записываем время рисования для chain_spark
  const draws = session.recentDrawCounts.get(player.id) || [];
  draws.push(Date.now());
  // Оставляем только последние 100 записей
  if (draws.length > 100) {
    draws.splice(0, draws.length - 100);
  }
  session.recentDrawCounts.set(player.id, draws);

  // Отправляем патч обоим игрокам
  broadcast({
    type: "grid_patch",
    playerId: player.id,
    cells: [{ x, y, kind: "element" as CellKind, element }],
  });

  // Отправляем обновление ресурсов
  broadcast({
    type: "hp_ink_update",
    playerId: player.id,
    hp: player.hp,
    ink: player.ink,
  });
}

function handleCast(player: Player, msg: CastMessage) {
  if (!session.gameStarted) {
    sendToClient(player.ws, {
      type: "error",
      message: "Игра ещё не началась",
    });
    return;
  }

  const now = Date.now();

  // Проверка базового кулдауна
  if (now - player.lastCastTime < CAST_COOLDOWN_MS) {
    return;
  }

  if (!player.selectedElement) {
    sendToClient(player.ws, {
      type: "error",
      message: "Элемент не выбран",
    });
    return;
  }

  const grid = session.grids.get(player.id);
  if (!grid) return;

  // Получаем paintMeta и текущее поколение для active-слоя
  const paintMeta = session.paintMeta.get(player.id)!;
  const currentGeneration = session.castGenerations.get(player.id) || 0;

  // Распознаём глиф с использованием active-слоя
  let result = recognizeGlyphWithActiveLayer(
    grid,
    player.selectedElement,
    paintMeta,
    currentGeneration,
    now
  );

  // Применяем модификатор mist
  const mist = statusManager.getStatus(player.id, "mist");
  if (mist && mist.value && result.success && result.spellId) {
    const glyphTemplate = GLYPH_LIBRARY.find(
      (g: any) => g.spellId === result.spellId
    );
    if (glyphTemplate) {
      const effectiveThreshold = glyphTemplate.threshold + mist.value;
      if (result.score && result.score < effectiveThreshold) {
        result = { ...result, success: false };
      }
    }
  }

  player.lastCastTime = now;

  // Увеличиваем поколение кастов после распознавания
  const newGeneration = (session.castGenerations.get(player.id) || 0) + 1;
  session.castGenerations.set(player.id, newGeneration);

  if (result.success && result.spellId) {
    // Проверяем кулдаун конкретного спелла
    const spellDef = SPELLS[result.spellId];
    const lastCast = player.cooldowns.get(result.spellId) || 0;
    if (now - lastCast < spellDef.cooldownMs) {
      // Очищаем грид при касте на кулдауне (без урона)
      const grid = session.grids.get(player.id);
      if (grid) {
        const cellsToClear: Array<{ x: number; y: number; kind: CellKind }> = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
          for (let x = 0; x < GRID_WIDTH; x++) {
            if (grid[y][x] !== null) {
              grid[y][x] = null;
              cellsToClear.push({ x, y, kind: "empty" as CellKind });
            }
          }
        }
        
        // Очищаем paintMeta и увеличиваем поколение кастов
        session.paintMeta.get(player.id)?.clear();
        const newGeneration = (session.castGenerations.get(player.id) || 0) + 1;
        session.castGenerations.set(player.id, newGeneration);
        
        // Отправляем патч с очисткой всех клеток
        if (cellsToClear.length > 0) {
          broadcast({
            type: "grid_patch",
            playerId: player.id,
            cells: cellsToClear,
          });
        }
      }
      
      broadcast({
        type: "cast_result",
        playerId: player.id,
        success: false,
        failReason: "on_cooldown",
      });
      return;
    }

    player.cooldowns.set(result.spellId, now);

    const opponentId = getOpponentId(player.id);
    if (!opponentId) return;

    // Резолвим заклинание
    const ctx: CastContext = {
      casterId: player.id,
      targetId: opponentId,
      element: player.selectedElement!,
      recognition: result,
      now,
    };

    const resolution = resolveSpell(
      ctx,
      {
        grids: session.grids,
        obstacles: session.obstacles,
        recentDrawCounts: session.recentDrawCounts,
      },
      statusManager,
      summonSystem
    );

  // Применяем изменения HP
  if (resolution.hpChange) {
    const targetPlayer = session.players.get(resolution.hpChange.playerId);
    if (targetPlayer) {
      if (resolution.hpChange.amount > 0) {
        // Лечение
        targetPlayer.hp = Math.min(STARTING_HP, targetPlayer.hp + resolution.hpChange.amount);
      } else {
        // Урон
        applyDamage(
          resolution.hpChange.playerId,
          Math.abs(resolution.hpChange.amount),
          now
        );
      }

      broadcast({
        type: "hp_ink_update",
        playerId: resolution.hpChange.playerId,
        hp: targetPlayer.hp,
        ink: targetPlayer.ink,
      });

      // Проверяем условие победы после изменения HP
      checkGameOver();
    }
  }

    // Применяем статусы
    if (resolution.statusChanges) {
      for (const change of resolution.statusChanges) {
        statusManager.addStatus(change.playerId, {
          id: change.statusId,
          expiresAt: now + change.durationMs,
          value: change.value,
        });
      }

      // Отправляем обновления статусов
      session.players.forEach((p) => {
        const statuses = statusManager.getAllStatuses(p.id);
        broadcast({
          type: "status_update",
          playerId: p.id,
          statuses,
        });
      });
    }

    // Применяем изменения сетки
    if (resolution.gridMutations) {
      for (const mutation of resolution.gridMutations) {
        const grid = session.grids.get(mutation.playerId);
        if (!grid) continue;

        if (mutation.kind === "empty") {
          grid[mutation.y][mutation.x] = null;
        } else if (mutation.kind === "obstacle") {
          const obstacles = session.obstacles.get(mutation.playerId)!;
          const key = `${mutation.x},${mutation.y}`;
          obstacles.set(key, {
            x: mutation.x,
            y: mutation.y,
            expiresAt: now + ROOT_LOCK_TTL_MS,
          });
        }
      }

      // Отправляем патчи
      const patchesByPlayer = new Map<PlayerId, typeof resolution.gridMutations>();
      for (const mutation of resolution.gridMutations) {
        if (!patchesByPlayer.has(mutation.playerId)) {
          patchesByPlayer.set(mutation.playerId, []);
        }
        patchesByPlayer.get(mutation.playerId)!.push(mutation);
      }

      patchesByPlayer.forEach((cells, playerId) => {
        broadcast({
          type: "grid_patch",
          playerId,
          cells: cells.map((c) => ({
            x: c.x,
            y: c.y,
            kind: c.kind,
            element: c.element,
            symbol: c.symbol,
          })),
        });
      });
    }

    // Призываем суммонов
    if (resolution.summonSpawns) {
      for (const spawn of resolution.summonSpawns) {
        summonSystem.spawn(player.id, opponentId, spawn.kind, spawn.x, spawn.y, now);

        // Отправляем патч для отображения суммона
        broadcast({
          type: "grid_patch",
          playerId: opponentId,
          cells: [
            {
              x: spawn.x,
              y: spawn.y,
              kind: "summon" as CellKind,
              symbol: spawn.kind === "imp" ? "i" : "G",
            },
          ],
        });
      }
    }

    // Вычисляем целевую точку для визуального фидбека
    const targetRel = result.centroid
      ? mapCentroidToTarget(result.centroid, GRID_WIDTH, GRID_HEIGHT)
      : { rx: 0.5, ry: 0.5 };
    const targetX = Math.round(targetRel.rx * (GRID_WIDTH - 1));
    const targetY = Math.round(targetRel.ry * (GRID_HEIGHT - 1));

    // Очищаем грид игрока после успешного каста
    const grid = session.grids.get(player.id);
    if (grid) {
      const cellsToClear: Array<{ x: number; y: number; kind: CellKind }> = [];
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          if (grid[y][x] !== null) {
            grid[y][x] = null;
            cellsToClear.push({ x, y, kind: "empty" as CellKind });
          }
        }
      }
      
      // Очищаем paintMeta и увеличиваем поколение кастов
      session.paintMeta.get(player.id)?.clear();
      const newGeneration = (session.castGenerations.get(player.id) || 0) + 1;
      session.castGenerations.set(player.id, newGeneration);
      
      // Отправляем патч с очисткой всех клеток
      if (cellsToClear.length > 0) {
        broadcast({
          type: "grid_patch",
          playerId: player.id,
          cells: cellsToClear,
        });
      }
    }

    // Увеличиваем счётчик успешных кастов
    player.spellsCast++;

    broadcast({
      type: "cast_result",
      playerId: player.id,
      success: true,
      spellId: result.spellId,
      score: result.score,
      targetPoint: { x: targetX, y: targetY },
    });

    // Проверяем условие победы после успешного каста
    checkGameOver();
  } else {
    // Backfire - определяем причину
    let failReason: "no_glyph" | "score_too_low" | "on_cooldown" | "unknown" = "unknown";
    if (!result.componentCells || result.componentCells.length === 0) {
      failReason = "no_glyph";
    } else if (result.score !== undefined && result.score < 0.5) {
      failReason = "score_too_low";
    }

    applyDamage(player.id, BACKFIRE_DAMAGE, now);
    
    // Очищаем грид игрока после неудачного каста
    const grid = session.grids.get(player.id);
    if (grid) {
      const cellsToClear: Array<{ x: number; y: number; kind: CellKind }> = [];
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          if (grid[y][x] !== null) {
            grid[y][x] = null;
            cellsToClear.push({ x, y, kind: "empty" as CellKind });
          }
        }
      }
      
      // Очищаем paintMeta и увеличиваем поколение кастов
      session.paintMeta.get(player.id)?.clear();
      const newGeneration = (session.castGenerations.get(player.id) || 0) + 1;
      session.castGenerations.set(player.id, newGeneration);
      
      // Отправляем патч с очисткой всех клеток
      if (cellsToClear.length > 0) {
        broadcast({
          type: "grid_patch",
          playerId: player.id,
          cells: cellsToClear,
        });
      }
    }
    
    broadcast({
      type: "hp_ink_update",
      playerId: player.id,
      hp: player.hp,
      ink: player.ink,
    });

    broadcast({
      type: "cast_result",
      playerId: player.id,
      success: false,
      selfDamage: BACKFIRE_DAMAGE,
      failReason,
    });
  }
}

// Серверный тик для регенерации ресурсов, статусов, призывов
setInterval(() => {
  if (!session.gameStarted) return;

  const now = Date.now();

  // Регенерация Ink
  session.players.forEach((player) => {
    const oldInk = player.ink;
    player.ink = Math.min(
      MAX_INK,
      player.ink + (INK_REGEN_PER_SECOND * TICK_RATE_MS) / 1000
    );

    if (Math.floor(oldInk) !== Math.floor(player.ink)) {
      broadcast({
        type: "hp_ink_update",
        playerId: player.id,
        hp: player.hp,
        ink: player.ink,
      });
    }
  });

  // Тик статусов (DoT, очистка истёкших)
  const statusUpdates = statusManager.tick(now);
  statusUpdates.forEach((statuses, playerId) => {
    broadcast({
      type: "status_update",
      playerId,
      statuses,
    });
  });

  // Применяем DoT урон
  session.players.forEach((player) => {
    const burnDot = statusManager.getStatus(player.id, "burn_dot");
    if (burnDot && burnDot.value) {
      applyDamage(player.id, burnDot.value * (TICK_RATE_MS / 1000), now);
      broadcast({
        type: "hp_ink_update",
        playerId: player.id,
        hp: player.hp,
        ink: player.ink,
      });
      // Проверяем условие победы после DoT
      checkGameOver();
    }
  });

  // Тик призывов
  const summonTick = summonSystem.tick(now);

  // Удаляем истёкшие призывы
  for (const expired of summonTick.expired) {
    broadcast({
      type: "grid_patch",
      playerId: expired.targetPlayerId,
      cells: [
        {
          x: expired.x,
          y: expired.y,
          kind: "empty" as CellKind,
        },
      ],
    });
  }

  // Перемещаем призывы
  for (const { old, new: newSummon } of summonTick.moved) {
    // Удаляем со старой позиции
    broadcast({
      type: "grid_patch",
      playerId: old.targetPlayerId,
      cells: [
        {
          x: old.x,
          y: old.y,
          kind: "empty" as CellKind,
        },
      ],
    });

    // Добавляем на новую позицию
    broadcast({
      type: "grid_patch",
      playerId: newSummon.targetPlayerId,
      cells: [
        {
          x: newSummon.x,
          y: newSummon.y,
          kind: "summon" as CellKind,
          symbol: newSummon.symbol,
        },
      ],
    });

    // "Съедаем" элементную клетку под суммоном
    const grid = session.grids.get(newSummon.targetPlayerId);
    if (grid && grid[newSummon.y][newSummon.x] !== null) {
      grid[newSummon.y][newSummon.x] = null;
      broadcast({
        type: "grid_patch",
        playerId: newSummon.targetPlayerId,
        cells: [
          {
            x: newSummon.x,
            y: newSummon.y,
            kind: "empty" as CellKind,
          },
        ],
      });
    }
  }

  // Очистка истёкших препятствий
  session.obstacles.forEach((obstacles, playerId) => {
    const toRemove: string[] = [];
    for (const [key, obstacle] of obstacles.entries()) {
      if (obstacle.expiresAt <= now) {
        toRemove.push(key);
        const grid = session.grids.get(playerId);
        if (grid) {
          const { x, y } = { x: parseInt(key.split(",")[0]), y: parseInt(key.split(",")[1]) };
          broadcast({
            type: "grid_patch",
            playerId,
            cells: [
              {
                x,
                y,
                kind: "empty" as CellKind,
              },
            ],
          });
        }
      }
    }
    toRemove.forEach((key) => obstacles.delete(key));
  });

  // Очистка старых записей рисования
  session.recentDrawCounts.forEach((draws, playerId) => {
    const windowStart = now - 2000;
    const filtered = draws.filter((t) => t >= windowStart);
    session.recentDrawCounts.set(playerId, filtered);
  });
}, TICK_RATE_MS);

const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

wss.on("connection", (ws: WebSocket) => {
  console.log("Новое подключение");

  ws.on("message", (data: Buffer) => {
    try {
      const message: ClientToServer = JSON.parse(data.toString());

      // Находим игрока по WebSocket
      let player: Player | undefined;
      for (const p of session.players.values()) {
        if (p.ws === ws) {
          player = p;
          break;
        }
      }

      switch (message.type) {
        case "join":
          handleJoin(ws, message);
          break;
        case "ready":
          if (player) {
            handleReady(player, message);
          }
          break;
        case "select_element":
          if (player) {
            handleSelectElement(player, message);
          }
          break;
        case "draw":
          if (player) {
            handleDraw(player, message);
          }
          break;
        case "cast":
          if (player) {
            handleCast(player, message);
          }
          break;
        case "clear_grid":
          if (player) {
            handleClearGrid(player, message);
          }
          break;
      }
    } catch (error) {
      console.error("Ошибка обработки сообщения:", error);
      sendToClient(ws, {
        type: "error",
        message: "Неверный формат сообщения",
      });
    }
  });

  ws.on("close", () => {
    console.log("Отключение");
    // Удаляем игрока из сессии
    for (const [id, player] of session.players.entries()) {
      if (player.ws === ws) {
        session.players.delete(id);
        session.grids.delete(id);
        session.obstacles.delete(id);
        session.paintMeta.delete(id);
        session.castGenerations.delete(id);
        session.recentDrawCounts.delete(id);
        break;
      }
    }
    // Если игроков не осталось, сбрасываем состояние игры
    if (session.players.size === 0) {
      session.gameStarted = false;
      session.gameOver = false;
      statusManager.clear();
      summonSystem.clear();
    }
  });
});

const networkInterfaces = os.networkInterfaces();
let localIP = "localhost";
for (const name of Object.keys(networkInterfaces)) {
  for (const iface of networkInterfaces[name] || []) {
    if (iface.family === "IPv4" && !iface.internal && iface.address.startsWith("192.168.")) {
      localIP = iface.address;
      break;
    }
  }
  if (localIP !== "localhost") break;
}
console.log(`WebSocket сервер запущен на ws://localhost:${PORT}`);
console.log(`Доступен в локальной сети по адресу: ws://${localIP}:${PORT}`);

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ClientToServer,
  ServerToClient,
  PlayerId,
} from "../../shared/protocol";
import { ElementId, ELEMENTS, ELEMENT_BY_KEY } from "../../shared/constants";
import { ActiveStatus, SpellId } from "../../shared/types";
import { CellKind } from "../../shared/grid";
import { GRID_WIDTH, GRID_HEIGHT } from "../../shared/config";
import { SPELLS } from "../../shared/spells/spellRegistry";
import { GLYPH_LIBRARY } from "../../shared/glyphs/glyphLibrary";
import "./App.css";

// Автоматически определяем URL WebSocket сервера на основе текущего хоста
const WS_URL = `ws://${window.location.hostname}:8080`;

interface PlayerState {
  playerId: PlayerId;
  hp: number;
  ink: number;
  selectedElement: ElementId | null;
  ready: boolean;
}

interface GameLogEntry {
  message: string;
  timestamp: number;
}

interface CellData {
  kind: CellKind;
  element?: ElementId;
  symbol?: string;
}

interface AppProps {
  debugHintPlayer?: PlayerId;
}

function App({ debugHintPlayer }: AppProps = {} as AppProps) {
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<PlayerId | null>(null);
  const [targetPoint, setTargetPoint] = useState<{ x: number; y: number } | null>(null);
  const [spellCooldowns, setSpellCooldowns] = useState<Map<SpellId, number>>(new Map());
  const [spellEffect, setSpellEffect] = useState<{ spellId: SpellId; targetPoint: { x: number; y: number } } | null>(null);

  // Поддержка ?p=1/2 как fallback
  const urlPlayerParam = searchParams.get("p");
  const effectiveDebugHint = debugHintPlayer || (urlPlayerParam ? parseInt(urlPlayerParam) as PlayerId : undefined);
  const [players, setPlayers] = useState<Record<PlayerId, PlayerState>>({} as any);
  const [myGrid, setMyGrid] = useState<CellData[][]>(
    Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(null).map(() => ({ kind: "empty" })))
  );
  const [opponentGrid, setOpponentGrid] = useState<CellData[][]>(
    Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(null).map(() => ({ kind: "empty" })))
  );
  const [playerStatuses, setPlayerStatuses] = useState<Record<PlayerId, ActiveStatus[]>>({} as any);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameStats, setGameStats] = useState<{ winnerId: PlayerId; stats: any } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]);
  const [readyClicked, setReadyClicked] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [gridFlashEffect, setGridFlashEffect] = useState<"success" | "error" | "cooldown" | false>(false);
  const [lastCell, setLastCell] = useState<{ x: number; y: number } | null>(null);
  const drawBatchRef = useRef<Array<{ x: number; y: number; element: ElementId }>>([]);
  const batchTimerRef = useRef<number | null>(null);
  const myGridRef = useRef<CellData[][]>([]);
  const myPlayerIdRef = useRef<PlayerId | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Синхронизируем ref с состоянием грида для актуального доступа
  useEffect(() => {
    myGridRef.current = myGrid;
  }, [myGrid]);
  
  // Синхронизируем ref с myPlayerId для актуального доступа
  useEffect(() => {
    myPlayerIdRef.current = myPlayerId;
  }, [myPlayerId]);

  const addLog = useCallback((message: string) => {
    setGameLog((prev) => {
      const newLog = [...prev, { message, timestamp: Date.now() }];
      return newLog.slice(-5); // Последние 5 записей
    });
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Автоматически присоединяемся с поддержкой debugHintPlayer
      const joinMsg: ClientToServer = {
        type: "join",
        debugPreferredSlot: effectiveDebugHint,
      };
      ws.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = (event) => {
      const message: ServerToClient = JSON.parse(event.data);

      switch (message.type) {
        case "session_state":
          setPlayers(message.players);
          // ID будет установлен через player_joined с isYou=true
          break;

        case "player_joined":
          if (message.isYou) {
            // Это сообщение для нас - устанавливаем наш ID
            setMyPlayerId(message.playerId);
            addLog(`Вы присоединились как Игрок ${message.playerId}`);
          } else {
            addLog(`Игрок ${message.playerId} присоединился`);
          }
          break;

        case "both_ready":
          setGameStarted(true);
          setReadyClicked(false);
          addLog("Оба игрока готовы! Игра началась!");
          break;

        case "game_over":
          setGameOver(true);
          setGameStats({
            winnerId: message.winnerId,
            stats: message.stats,
          });
          addLog(`Игра окончена! Победитель: Игрок ${message.winnerId}`);
          break;

        case "grid_patch": {
          // Обновляем грид в зависимости от того, чей это грид
          // Используем ref для актуального значения myPlayerId
          const currentMyPlayerId = myPlayerIdRef.current;
          if (message.playerId === currentMyPlayerId) {
            // Обновляем свой грид
            setMyGrid((prevGrid) => {
              const newGrid = prevGrid.map((row) => row.map((cell) => ({ ...cell })));
              message.cells.forEach(({ x, y, kind, element, symbol }) => {
                if (y >= 0 && y < GRID_HEIGHT && x >= 0 && x < GRID_WIDTH) {
                  newGrid[y][x] = { kind, element, symbol };
                }
              });
              return newGrid;
            });
          } else {
            // Обновляем грид оппонента
            setOpponentGrid((prevGrid) => {
              const newGrid = prevGrid.map((row) => row.map((cell) => ({ ...cell })));
              message.cells.forEach(({ x, y, kind, element, symbol }) => {
                if (y >= 0 && y < GRID_HEIGHT && x >= 0 && x < GRID_WIDTH) {
                  newGrid[y][x] = { kind, element, symbol };
                }
              });
              return newGrid;
            });
          }
          break;
        }

        case "status_update":
          setPlayerStatuses((prev) => ({
            ...prev,
            [message.playerId]: message.statuses,
          }));
          break;

        case "hp_ink_update":
          setPlayers((prev) => {
            if (prev[message.playerId]) {
              return {
                ...prev,
                [message.playerId]: {
                  ...prev[message.playerId],
                  hp: message.hp,
                  ink: message.ink,
                },
              };
            }
            return prev;
          });
          break;

        case "cast_result":
          if (message.playerId === myPlayerId) {
            if (message.success) {
              addLog(`Вы успешно применили ${message.spellId || "заклинание"}${message.score ? ` (score: ${message.score.toFixed(2)})` : ""}!`);
              // Показываем визуальный фидбек цели на поле оппонента
              if (message.targetPoint) {
                setTargetPoint(message.targetPoint);
                setTimeout(() => setTargetPoint(null), 350);
              }
              // Визуальный эффект заклинания
              // Для заклинаний на своё поле используем своё поле, для остальных - поле оппонента
              const selfTargetSpells: SpellId[] = ["heal_ripple", "frost_shield", "stone_skin"];
              if (message.spellId) {
                if (selfTargetSpells.includes(message.spellId)) {
                  // Для заклинаний на себя используем центр своего поля
                  const centerPoint = { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) };
                  setSpellEffect({ spellId: message.spellId, targetPoint: centerPoint });
                  setTimeout(() => setSpellEffect(null), 1000);
                } else if (message.targetPoint) {
                  // Для остальных используем целевую точку на поле оппонента
                  setSpellEffect({ spellId: message.spellId, targetPoint: message.targetPoint });
                  setTimeout(() => setSpellEffect(null), 1000);
                }
              }
              // Обновляем кулдауны
              if (message.spellId) {
                const spellDef = SPELLS[message.spellId];
                const newCooldowns = new Map(spellCooldowns);
                newCooldowns.set(message.spellId, Date.now() + spellDef.cooldownMs);
                setSpellCooldowns(newCooldowns);
              }
              
              // Визуальный эффект очистки поля при успешном касте (зелёный)
              setGridFlashEffect("success");
              setTimeout(() => setGridFlashEffect(false), 500);
            } else {
              const reasonText =
                message.failReason === "no_glyph"
                  ? "Глиф не найден"
                  : message.failReason === "score_too_low"
                  ? "Низкий score"
                  : message.failReason === "on_cooldown"
                  ? "На кулдауне"
                  : "Ошибка распознавания";
              
              if (message.failReason === "on_cooldown") {
                addLog(`${reasonText}! Поле очищено.`);
                // Визуальный эффект очистки поля при кулдауне (жёлтый)
                setGridFlashEffect("cooldown");
              } else {
                addLog(`${reasonText}! Урон себе: ${message.selfDamage}`);
                // Визуальный эффект очистки поля при ошибке (красный)
                setGridFlashEffect("error");
              }
              setTimeout(() => setGridFlashEffect(false), 500);
            }
          } else {
            if (message.success) {
              addLog(`Оппонент применил ${message.spellId || "заклинание"}!`);
              // Визуальный эффект заклинания оппонента
              if (message.spellId && message.targetPoint) {
                setSpellEffect({ spellId: message.spellId, targetPoint: message.targetPoint });
                setTimeout(() => setSpellEffect(null), 1000);
              }
            } else {
              addLog(`Оппонент ошибся при касте`);
            }
          }
          break;

        case "error":
          addLog(`Ошибка: ${message.message}`);
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = useCallback((message: ClientToServer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const handleReady = () => {
    sendMessage({ type: "ready" });
    addLog("Вы готовы!");
  };

  const handleSelectElement = (element: ElementId) => {
    if (gameStarted) {
      sendMessage({ type: "select_element", element });
      setPlayers((prev) => {
        if (myPlayerId && prev[myPlayerId]) {
          return {
            ...prev,
            [myPlayerId]: {
              ...prev[myPlayerId],
              selectedElement: element,
            },
          };
        }
        return prev;
      });
    }
  };

  // Функция для получения клетки из координат указателя
  const getCellFromPointer = (
    e: PointerEvent | React.PointerEvent<HTMLDivElement>,
    gridEl: HTMLElement,
    size: number
  ): { x: number; y: number } | null => {
    const rect = gridEl.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * size);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * size);
    
    const clampedX = Math.max(0, Math.min(size - 1, x));
    const clampedY = Math.max(0, Math.min(size - 1, y));
    
    return { x: clampedX, y: clampedY };
  };

  // Алгоритм Bresenham для интерполяции линии между двумя точками
  const bresenhamLine = (
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): Array<{ x: number; y: number }> => {
    const points: Array<{ x: number; y: number }> = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;

    while (true) {
      points.push({ x, y });
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return points;
  };

  // Отправка батча изменений
  const flushDrawBatch = useCallback(() => {
    if (drawBatchRef.current.length === 0) return;
    
    const batch = [...drawBatchRef.current];
    drawBatchRef.current = [];
    
    // Оптимистично обновляем локальный грид
    setMyGrid((prevGrid) => {
      const newGrid = prevGrid.map((row) => row.map((cell) => ({ ...cell })));
      batch.forEach((cell) => {
        if (cell.y >= 0 && cell.y < GRID_HEIGHT && cell.x >= 0 && cell.x < GRID_WIDTH) {
          newGrid[cell.y][cell.x] = {
            kind: "element",
            element: cell.element,
          };
        }
      });
      return newGrid;
    });
    
    // Отправляем каждое изменение отдельно (сервер обрабатывает их последовательно)
    batch.forEach((cell) => {
      sendMessage({
        type: "draw",
        x: cell.x,
        y: cell.y,
        element: cell.element,
      });
    });
  }, [sendMessage]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!gameStarted || !myPlayerId || !gridRef.current) return;
    const player = players[myPlayerId];
    if (!player?.selectedElement) return;

    e.preventDefault();
    setIsDrawing(true);
    gridRef.current.setPointerCapture(e.pointerId);
    
    const cell = getCellFromPointer(e, gridRef.current, GRID_WIDTH);
    if (cell) {
      setLastCell(cell);
      // Добавляем первую точку в батч
      drawBatchRef.current.push({ x: cell.x, y: cell.y, element: player.selectedElement });
      
      // Запускаем таймер для отправки батча
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
      batchTimerRef.current = window.setTimeout(flushDrawBatch, 16);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || !gameStarted || !myPlayerId || !gridRef.current) return;
    const player = players[myPlayerId];
    if (!player?.selectedElement || !lastCell) return;

    e.preventDefault();
    const currentCell = getCellFromPointer(e, gridRef.current, GRID_WIDTH);
    if (!currentCell) return;

    // Если клетка не изменилась, пропускаем
    if (currentCell.x === lastCell.x && currentCell.y === lastCell.y) return;

    // Интерполируем линию между lastCell и currentCell
    const linePoints = bresenhamLine(lastCell.x, lastCell.y, currentCell.x, currentCell.y);
    
    // Добавляем все точки линии в батч (с дедупликацией)
    // Используем ref для актуального состояния грида
    const currentGrid = myGridRef.current;
    const seen = new Set<string>();
    linePoints.forEach((point) => {
      const key = `${point.x},${point.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        // Проверяем, что клетка не занята тем же элементом
        const pointData = currentGrid[point.y]?.[point.x];
        if (
          !pointData ||
          pointData.kind === "empty" ||
          (pointData.kind === "element" && pointData.element !== player.selectedElement)
        ) {
          drawBatchRef.current.push({ x: point.x, y: point.y, element: player.selectedElement });
        }
      }
    });

    setLastCell(currentCell);

    // Перезапускаем таймер для отправки батча
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
    }
    batchTimerRef.current = window.setTimeout(flushDrawBatch, 16);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!gridRef.current) return;
    e.preventDefault();
    gridRef.current.releasePointerCapture(e.pointerId);
    setIsDrawing(false);
    setLastCell(null);
    
    // Отправляем оставшиеся изменения
    flushDrawBatch();
    
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    handlePointerUp(e);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Обработка help-меню (работает всегда)
    if (e.key === "h" || e.key === "H") {
      e.preventDefault();
      setShowHelp((prev) => !prev);
      return;
    }

    // Escape закрывает help-меню
    if (e.key === "Escape") {
      setShowHelp(false);
      return;
    }

    if (!gameStarted) return;

    if (e.key === " ") {
      e.preventDefault();
      sendMessage({ type: "cast" });
      return;
    }

    // Очистка поля по клавише E
    if (e.key === "e" || e.key === "E") {
      e.preventDefault();
      sendMessage({ type: "clear_grid" });
      addLog("Поле очищено");
      return;
    }

    const element = ELEMENT_BY_KEY[e.key];
    if (element) {
      handleSelectElement(element);
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [gameStarted, players, myPlayerId]);

  // Обновление кулдаунов каждую секунду для корректного отображения
  useEffect(() => {
    if (!gameStarted) return;
    
    const interval = setInterval(() => {
      setSpellCooldowns((prev) => {
        const now = Date.now();
        const updated = new Map(prev);
        let changed = false;
        
        prev.forEach((endTime, spellId) => {
          if (endTime <= now) {
            updated.delete(spellId);
            changed = true;
          }
        });
        
        return changed ? updated : prev;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [gameStarted]);

  const renderGrid = (
    grid: CellData[][],
    isInteractive: boolean,
    showTargetPoint: boolean = false
  ) => {
    return (
      <div
        ref={isInteractive ? gridRef : null}
        className={`grid ${isInteractive ? "interactive" : ""} ${isInteractive && gridFlashEffect ? "flash-effect" : ""}`}
        onPointerDown={isInteractive ? handlePointerDown : undefined}
        onPointerMove={isInteractive ? handlePointerMove : undefined}
        onPointerUp={isInteractive ? handlePointerUp : undefined}
        onPointerLeave={isInteractive ? handlePointerLeave : undefined}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${GRID_HEIGHT}, minmax(0, 1fr))`,
          position: "relative",
          width: "100%",
          height: "100%",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        {grid.map((row, y) =>
          row.map((cell, x) => {
            let symbol = ".";
            let color = "#444";
            let highlight = false;

            if (cell.kind === "element" && cell.element) {
              const element = ELEMENTS[cell.element];
              symbol = element.symbol;
              color = element.color;
            } else if (cell.kind === "obstacle" && cell.symbol) {
              symbol = cell.symbol;
              color = "#888";
            } else if (cell.kind === "summon" && cell.symbol) {
              symbol = cell.symbol;
              color = "#aaa";
            }

            // Подсветка целевой точки
            if (showTargetPoint && targetPoint && Math.abs(x - targetPoint.x) <= 2 && Math.abs(y - targetPoint.y) <= 2) {
              highlight = true;
            }

            // Визуальный эффект заклинания
            // На поле оппонента для заклинаний на оппонента
            // На своём поле для заклинаний на себя (heal_ripple, frost_shield, stone_skin)
            let spellEffectClass = "";
            if (spellEffect && spellEffect.targetPoint) {
              const selfTargetSpells: SpellId[] = ["heal_ripple", "frost_shield", "stone_skin"];
              const shouldShowOnThisGrid = 
                (isInteractive && selfTargetSpells.includes(spellEffect.spellId)) ||
                (!isInteractive && !selfTargetSpells.includes(spellEffect.spellId));
              
              if (shouldShowOnThisGrid) {
                const dist = Math.sqrt((x - spellEffect.targetPoint.x) ** 2 + (y - spellEffect.targetPoint.y) ** 2);
                if (dist <= 2) {
                  spellEffectClass = `spell-effect-${spellEffect.spellId}`;
                }
              }
            }

            return (
              <div
                key={`${x}-${y}`}
                className={`cell ${spellEffectClass}`}
                style={{
                  color,
                  fontSize: "16px",
                  backgroundColor: highlight ? "rgba(255, 255, 0, 0.3)" : "transparent",
                  transition: highlight ? "background-color 0.1s" : "none",
                }}
              >
                {symbol}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderSpellPanel = (element: ElementId | null) => {
    if (!element) return null;

    const elementSpells = Object.values(SPELLS).filter((s) => s.element === element);
    const now = Date.now();

    return (
      <div className="spell-panel">
        <h4>Заклинания {ELEMENTS[element].symbol}</h4>
        {elementSpells.map((spell) => {
          const cooldownEnd = spellCooldowns.get(spell.id);
          const remaining = cooldownEnd ? Math.max(0, cooldownEnd - now) : 0;
          const isOnCooldown = remaining > 0;

          return (
            <div
              key={spell.id}
              className={`spell-item ${isOnCooldown ? "on-cooldown" : ""}`}
            >
              <span className="spell-name">{spell.id.replace("_", " ")}</span>
              {isOnCooldown && (
                <span className="cooldown-timer">{(remaining / 1000).toFixed(1)}s</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Создаём случайный порядок всех глифов для подсказок (мемоизируем для стабильности)
  const shuffledGlyphsForHints = useMemo(() => {
    return [...GLYPH_LIBRARY].sort(() => Math.random() - 0.5);
  }, [gameStarted]); // Перемешиваем при старте игры

  // Компонент для прокручивающихся подсказок заклинаний
  const renderSpellHints = () => {
    // Дублируем для бесконечной прокрутки
    const duplicatedGlyphs = [...shuffledGlyphsForHints, ...shuffledGlyphsForHints, ...shuffledGlyphsForHints];

    return (
      <div className="spell-hints-container">
        <div className="spell-hints-scroll">
          {duplicatedGlyphs.map((glyph, index) => {
            const element = ELEMENTS[glyph.element];
            const spell = SPELLS[glyph.spellId];
            
            return (
              <div key={`${glyph.id}-${index}`} className="spell-hint-item">
                <div className="spell-hint-glyph">
                  <div className="spell-hint-grid">
                    {glyph.bitmap.map((row, y) =>
                      row.map((cell, x) => (
                        <div
                          key={`${x}-${y}`}
                          className="spell-hint-cell"
                          style={{
                            backgroundColor: cell === 1 ? element.color : "transparent",
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>
                <div className="spell-hint-name">{spell.id.replace(/_/g, " ")}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Описания заклинаний для help drawer
  const spellDescriptions: Record<SpellId, string> = {
    fire_bolt: "Прямой урон оппоненту (14 HP)",
    burn_sigil: "Накладывает ожог (4 HP/сек, 3 сек)",
    flare_cleanse: "Стирает клетки на поле оппонента",
    imp_swarm: "Призывает 2 импа на поле оппонента",
    heal_ripple: "Восстанавливает HP (12 HP)",
    frost_shield: "Щит, поглощает урон (20 HP, 5 сек)",
    tidal_erase: "Стирает полосу клеток на поле оппонента",
    mist_distortion: "Увеличивает порог распознавания (+8%)",
    stone_skin: "Снижает получаемый урон (35%, 5 сек)",
    root_lock: "Создаёт препятствия на поле оппонента",
    quake: "Стирает случайные клетки на поле оппонента",
    golem_tiles: "Призывает 1 голема на поле оппонента",
    shock_dart: "Прямой урон оппоненту (10 HP)",
    chain_spark: "Урон зависит от активности рисования (8-18 HP)",
    wind_sweep: "Стирает случайные клетки на поле оппонента",
    static_jinx: "Искажает выбор элемента оппонента",
  };

  const renderStatuses = (playerId: PlayerId) => {
    const statuses = playerStatuses[playerId] || [];
    if (statuses.length === 0) return null;

    const statusDescriptions: Record<StatusId, string> = {
      shield: "Поглощает урон до исчерпания",
      damage_reduction: "Снижает весь получаемый урон на 35%",
      mist: "Увеличивает порог распознавания глифов на 8%",
      jinx: "Искажает выбор элемента (выбирается следующий в цикле)",
      burn_dot: "Наносит 4 HP урона каждую секунду",
    };

    return (
      <div className="statuses">
        {statuses.map((status) => {
          const now = Date.now();
          const remaining = Math.max(0, status.expiresAt - now);
          const remainingSeconds = Math.ceil(remaining / 1000);
          
          let label = "";
          let icon = "";
          if (status.id === "shield") {
            icon = "🛡️";
            label = `Щит ${status.value || 0} HP`;
          } else if (status.id === "damage_reduction") {
            icon = "🪨";
            label = "Каменная кожа";
          } else if (status.id === "mist") {
            icon = "🌫️";
            label = "Туман";
          } else if (status.id === "jinx") {
            icon = "⚡";
            label = "Проклятие";
          } else if (status.id === "burn_dot") {
            icon = "🔥";
            label = "Ожог";
          }

          return (
            <span 
              key={status.id} 
              className="status-badge" 
              title={statusDescriptions[status.id]}
            >
              {icon} {label} ({remainingSeconds}с)
            </span>
          );
        })}
      </div>
    );
  };

  const myPlayer = myPlayerId ? players[myPlayerId] : null;
  const opponentId: PlayerId | null = myPlayerId === 1 ? 2 : myPlayerId === 2 ? 1 : null;
  const opponent = opponentId ? players[opponentId] : null;

  return (
    <div className="app">
      <div className="header">
        <h1>Glyph Duel</h1>
        <div className="status">
          {connected ? "Подключено" : "Отключено"}
          {myPlayerId && ` | Игрок ${myPlayerId}`}
        </div>
      </div>

      {!gameStarted && !gameOver && (
        <div className="lobby">
          <div className="lobby-instructions">
            <h2>Glyph Duel</h2>
            <p className="instruction-text">
              <span className="instruction-highlight">Цель игры:</span> Победите оппонента, снизив его HP до 0.
            </p>
            <p className="instruction-text">
              <span className="instruction-highlight">Как играть:</span> Выберите элемент (1-4), рисуйте глифы на своём поле мышью, нажмите Space для каста заклинания.
            </p>
            <p className="instruction-text">
              <span className="instruction-highlight">Элементы:</span> Огонь (1) 🔥, Вода (2) 💧, Земля (3) 🌍, Воздух (4) 💨
            </p>
            <p className="instruction-text">
              <span className="instruction-highlight">Управление:</span> 1-4 выбор элемента | ЛКМ рисование | Space каст | E очистка | H помощь
            </p>
          </div>
          <button
            onClick={handleReady}
            disabled={!connected || !myPlayerId || readyClicked}
            className={readyClicked ? "clicked" : ""}
          >
            {readyClicked ? "✓ Ready" : "Ready"}
          </button>
          <div>
            {myPlayer && myPlayer.ready && "Вы готовы"}
            {opponent && opponent.ready && " | Оппонент готов"}
          </div>
        </div>
      )}

      {gameOver && gameStats && (
        <div className="game-over-screen">
          <h2>Игра окончена!</h2>
          <div className="winner-announcement">
            Победитель: <span className="winner-name">Игрок {gameStats.winnerId}</span>
          </div>
          <div className="stats-panel">
            <h3>Статистика</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label">Игрок 1</div>
                <div className="stat-value">HP: {gameStats.stats.player1.hp}</div>
                <div className="stat-value">Заклинаний: {gameStats.stats.player1.spellsCast}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Игрок 2</div>
                <div className="stat-value">HP: {gameStats.stats.player2.hp}</div>
                <div className="stat-value">Заклинаний: {gameStats.stats.player2.spellsCast}</div>
              </div>
            </div>
          </div>
          <button
            className="restart-button"
            onClick={() => {
              window.location.reload();
            }}
          >
            Новая игра
          </button>
        </div>
      )}

      {gameStarted && !gameOver && myPlayer && (
        <div className="game-container">
          <div className="panels">
            <div className="panel">
              <h2>Ваше поле</h2>
              <div className="player-info">
                <div>HP: {myPlayer.hp}</div>
                <div>Ink: {Math.floor(myPlayer.ink)}</div>
                <div>
                  Элемент:{" "}
                  {myPlayer.selectedElement
                    ? ELEMENTS[myPlayer.selectedElement].symbol
                    : "не выбран"}
                </div>
                {renderStatuses(myPlayer.id)}
              </div>
              <div className="element-selector">
                {Object.entries(ELEMENTS).map(([id, elem]) => (
                  <button
                    key={id}
                    onClick={() => handleSelectElement(id as ElementId)}
                    className={
                      myPlayer.selectedElement === id ? "selected" : ""
                    }
                    style={{
                      backgroundColor:
                        myPlayer.selectedElement === id ? elem.color : "#333",
                      color: "#fff",
                    }}
                  >
                    {elem.key}: {elem.symbol}
                  </button>
                ))}
              </div>
              {renderSpellPanel(myPlayer.selectedElement)}
              {renderGrid(myGrid, true)}
            </div>

            <div className="panel">
              <h2>Поле оппонента</h2>
              {opponent && (
                <div className="player-info">
                  <div>HP: {opponent.hp}</div>
                  <div>Ink: {Math.floor(opponent.ink)}</div>
                  {renderStatuses(opponent.id)}
                </div>
              )}
              {renderSpellHints()}
              {renderGrid(opponentGrid, false, true)}
            </div>
          </div>

          <div className="sidebar">
            <div className="controls">
              <div>Управление:</div>
              <div>1-4: выбор элемента</div>
              <div>ЛКМ: рисование</div>
              <div>Space: каст</div>
              <div>E: очистка поля</div>
              <div>H: помощь</div>
            </div>
            <div className="log">
              <h3>Лог событий</h3>
              {gameLog.map((entry, i) => (
                <div key={i} className="log-entry">
                  {entry.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Help Drawer */}
      {showHelp && (
        <div className="help-drawer-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="help-drawer-header">
              <h2>Справочник глифов</h2>
              <button className="help-close" onClick={() => setShowHelp(false)}>
                ✕
              </button>
            </div>
            <div className="help-content">
              {Object.entries(ELEMENTS).map(([elementId, element]) => {
                const elementSpells = Object.values(SPELLS).filter(
                  (s) => s.element === elementId
                );
                const elementGlyphs = GLYPH_LIBRARY.filter(
                  (g) => g.element === elementId
                );

                return (
                  <div key={elementId} className="help-element-section">
                    <h3 style={{ color: element.color }}>
                      {element.symbol} {elementId.toUpperCase()}
                    </h3>
                    <div className="help-spells">
                      {elementSpells.map((spell) => {
                        const glyph = elementGlyphs.find(
                          (g) => g.spellId === spell.id
                        );
                        const description = spellDescriptions[spell.id] || "";
                        return (
                          <div key={spell.id} className="help-spell-item">
                            <div className="help-spell-name">
                              {spell.id.replace(/_/g, " ")}
                            </div>
                            {description && (
                              <div className="help-spell-description" style={{ color: element.color }}>
                                {description}
                              </div>
                            )}
                            {glyph && (
                              <div className="help-glyph-preview">
                                <div className="help-glyph-grid">
                                  {glyph.bitmap.map((row, y) =>
                                    row.map((cell, x) => (
                                      <div
                                        key={`${x}-${y}`}
                                        className="help-glyph-cell"
                                        style={{
                                          backgroundColor:
                                            cell === 1 ? element.color : "#222",
                                        }}
                                      />
                                    ))
                                  )}
                                </div>
                                <div className="help-glyph-threshold">
                                  Порог: {(glyph.threshold * 100).toFixed(0)}%
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;


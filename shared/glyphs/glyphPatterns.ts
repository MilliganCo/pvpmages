// Паттерны глифов для всех 16 заклинаний
// Каждый паттерн - это 8x8 битовая маска (контуры, без заполнения)

function createPattern(size: number, fn: (x: number, y: number) => boolean): number[][] {
  return Array(size).fill(null).map((_, y) =>
    Array(size).fill(0).map((_, x) => (fn(x, y) ? 1 : 0))
  );
}

// ========== ОГОНЬ ==========

// fire_bolt: горизонтальная линия
export const FIRE_BOLT = createPattern(8, (x, y) => 
  y === 3 && x >= 1 && x < 7
);

// burn_sigil: очень простой зигзаг (2 сегмента)
export const BURN_SIGIL = createPattern(8, (x, y) => 
  (y === 3 && x >= 2 && x < 6) || // Средняя линия
  (y === 2 && x >= 3 && x < 5) || // Верхний сегмент
  (y === 4 && x >= 4 && x < 6)    // Нижний сегмент
);

// flare_cleanse: крест (контур)
export const FLARE_CLEANSE = createPattern(8, (x, y) => 
  (y === 3 && x >= 2 && x < 6) || 
  (x === 3 && y >= 2 && y < 6)
);

// imp_swarm: три точки
export const IMP_SWARM = createPattern(8, (x, y) => 
  (y === 2 && (x === 2 || x === 3 || x === 4)) ||
  (y === 4 && (x === 2 || x === 3 || x === 4))
);

// ========== ВОДА ==========

// heal_ripple: круг (контур) - изменён на простой круг
export const HEAL_RIPPLE = createPattern(8, (x, y) => {
  const cx = 3.5, cy = 3.5, r = 2;
  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  return Math.abs(dist - r) < 0.5; // Только контур
});

// frost_shield: треугольник (контур) - изменён чтобы отличаться от heal_ripple
export const FROST_SHIELD = createPattern(8, (x, y) => 
  (y === 5 && x >= 2 && x < 6) || // Основание треугольника
  (x === 3 && y >= 2 && y < 5) || // Левая сторона
  (x === 4 && y >= 2 && y < 5) || // Правая сторона
  (y === 2 && x === 3) // Вершина
);

// tidal_erase: вертикальная линия
export const TIDAL_ERASE = createPattern(8, (x, y) => 
  x === 3 && y >= 1 && y < 7
);

// mist_distortion: простой крест (5 точек)
export const MIST_DISTORTION = createPattern(8, (x, y) => 
  (y === 3 && x === 3) || // Центр
  (y === 2 && x === 3) || // Верхняя точка
  (y === 4 && x === 3) || // Нижняя точка
  (y === 3 && x === 2) || // Левая точка
  (y === 3 && x === 4)    // Правая точка
);

// ========== ЗЕМЛЯ ==========

// stone_skin: квадрат (контур)
export const STONE_SKIN = createPattern(8, (x, y) => 
  (x >= 2 && x < 6 && (y === 2 || y === 5)) ||
  ((x === 2 || x === 5) && y >= 2 && y < 6)
);

// root_lock: простой крест
export const ROOT_LOCK = createPattern(8, (x, y) => 
  (y === 3 && x >= 2 && x < 6) || // Горизонтальная линия
  (x === 3 && y >= 2 && y < 6)    // Вертикальная линия
);

// quake: очень простой зигзаг вниз (2 блока)
export const QUAKE = createPattern(8, (x, y) => 
  (y >= 2 && y < 4 && x >= 2 && x < 4) ||   // Верхний блок
  (y >= 4 && y < 6 && x >= 3 && x < 5)      // Нижний блок
);

// golem_tiles: два простых квадрата (контур)
export const GOLEM_TILES = createPattern(8, (x, y) => 
  // Левый квадрат (контур)
  ((x === 1 && y >= 2 && y < 5) || (x === 3 && y >= 2 && y < 5) ||
   (y === 2 && x >= 1 && x < 4) || (y === 4 && x >= 1 && x < 4)) ||
  // Правый квадрат (контур)
  ((x === 4 && y >= 2 && y < 5) || (x === 6 && y >= 2 && y < 5) ||
   (y === 2 && x >= 4 && x < 7) || (y === 4 && x >= 4 && x < 7))
);

// ========== ВОЗДУХ ==========

// shock_dart: стрелка вправо
export const SHOCK_DART = createPattern(8, (x, y) => 
  (y === 3 && x >= 1 && x < 6) ||
  (x === 5 && y >= 2 && y < 5) ||
  (x === 4 && (y === 2 || y === 4))
);

// chain_spark: простая молния (зигзаг влево)
export const CHAIN_SPARK = createPattern(8, (x, y) => 
  (x === 2 && y >= 2 && y < 4) ||  // Верхняя часть
  (x === 3 && y >= 3 && y < 5) ||  // Средняя часть
  (x === 2 && y >= 4 && y < 6)     // Нижняя часть
);

// wind_sweep: простая дуга (3 сегмента)
export const WIND_SWEEP = createPattern(8, (x, y) => 
  (y === 2 && x >= 2 && x < 5) ||  // Верхний сегмент
  (y === 3 && x >= 1 && x < 6) ||  // Средний сегмент
  (y === 4 && x >= 2 && x < 5)     // Нижний сегмент
);

// static_jinx: символ молнии ⚡ (зигзаг вправо) - изменён чтобы отличаться от chain_spark
export const STATIC_JINX = createPattern(8, (x, y) => {
  // Простой зигзаг молнии вправо
  if (x === 4 && y >= 1 && y < 3) return true; // Верхняя часть
  if (x >= 4 && x < 6 && y >= 3 && y < 5) return true; // Средняя часть
  if (x === 5 && y >= 4 && y < 6) return true; // Нижняя часть
  return false;
});

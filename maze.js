// Cell Types: 0 = Empty Floor, 1 = Wall, 2 = Lava, 3 = Goal Portal

// Unbiased Fisher-Yates shuffle.
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function generateMaze(level) {
  const size = 5 + level * 2;
  const grid = Array.from({ length: size }, () => Array(size).fill(1));

  function carve(r, c) {
    grid[r][c] = 0;
    const dirs = shuffle([
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2]
    ]);

    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr > 0 && nr < size - 1 && nc > 0 && nc < size - 1 && grid[nr][nc] === 1) {
        grid[r + dr / 2][c + dc / 2] = 0;
        carve(nr, nc);
      }
    }
  }

  carve(1, 1);

  // Braid the maze by opening only walls that connect two opposite corridors.
  const extraPaths = Math.floor(size * 0.7);
  let braided = 0;
  for (let attempts = 0; attempts < extraPaths * 6 && braided < extraPaths; attempts++) {
    const r = 2 + Math.floor(Math.random() * (size - 4));
    const c = 2 + Math.floor(Math.random() * (size - 4));
    const connectsVertical =
      grid[r - 1][c] === 0 && grid[r + 1][c] === 0 &&
      grid[r][c - 1] === 1 && grid[r][c + 1] === 1;
    const connectsHorizontal =
      grid[r][c - 1] === 0 && grid[r][c + 1] === 0 &&
      grid[r - 1][c] === 1 && grid[r + 1][c] === 1;

    if (grid[r][c] === 1 && (connectsVertical || connectsHorizontal)) {
      grid[r][c] = 0;
      braided++;
    }
  }

  const goalPos = { r: size - 2, c: size - 2 };
  grid[goalPos.r][goalPos.c] = 3;

  const lavaCells = [];
  if (level > 3) {
    const lavaCount = (level - 3) * 4;
    let placed = 0;
    let attempts = 0;
    while (placed < lavaCount && attempts < 300) {
      attempts++;
      const r = 1 + Math.floor(Math.random() * (size - 2));
      const c = 1 + Math.floor(Math.random() * (size - 2));
      const isStart = r <= 2 && c <= 2;
      const isGoal = r === goalPos.r && c === goalPos.c;
      if (grid[r][c] === 0 && !isStart && !isGoal) {
        grid[r][c] = 2;
        lavaCells.push({ r, c });
        placed++;
      }
    }
  }

  const monsterSpawns = [];
  if (level > 5) {
    const monsterCount = level - 5;
    let spawned = 0;
    let attempts = 0;
    while (spawned < monsterCount && attempts < 300) {
      attempts++;
      const r = 1 + Math.floor(Math.random() * (size - 2));
      const c = 1 + Math.floor(Math.random() * (size - 2));
      const distFromStart = Math.hypot(r - 1, c - 1);
      if (grid[r][c] === 0 && distFromStart > 4) {
        monsterSpawns.push({ r, c });
        spawned++;
      }
    }
  }

  return { grid, size, goalPos, lavaCells, monsterSpawns };
}

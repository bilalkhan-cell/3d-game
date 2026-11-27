// Cell Types: 0 = Empty Floor, 1 = Wall, 2 = Lava (Level > 3), 3 = Goal Portal

export function generateMaze(level) {
  // Size starts at 7x7 on Level 1 and grows by 2 rows/cols each level (must be odd)
  const size = 5 + level * 2;
  const grid = Array.from({ length: size }, () => Array(size).fill(1));

  // Depth-First Recursive Backtracker
  function carve(r, c) {
    grid[r][c] = 0;
    const dirs = [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2]
    ].sort(() => Math.random() - 0.5);

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

  // Create extra loops at higher levels so players can dodge lava and monsters
  const extraPaths = Math.floor(size * 0.8);
  for (let i = 0; i < extraPaths; i++) {
    const r = 2 + Math.floor(Math.random() * (size - 4));
    const c = 2 + Math.floor(Math.random() * (size - 4));
    if (grid[r][c] === 1) {
      grid[r][c] = 0;
    }
  }

  // Place exit portal at bottom-right corner
  const goalPos = { r: size - 2, c: size - 2 };
  grid[goalPos.r][goalPos.c] = 3;

  // After Level 3: Add Lava Tiles
  const lavaCells = [];
  if (level > 3) {
    const lavaCount = (level - 3) * 4;
    let placed = 0;
    let attempts = 0;

    while (placed < lavaCount && attempts < 300) {
      attempts++;
      const r = 1 + Math.floor(Math.random() * (size - 2));
      const c = 1 + Math.floor(Math.random() * (size - 2));

      // Keep spawn (1,1) and exit clear
      const isStart = r <= 2 && c <= 2;
      const isGoal = r === goalPos.r && c === goalPos.c;

      if (grid[r][c] === 0 && !isStart && !isGoal) {
        grid[r][c] = 2;
        lavaCells.push({ r, c });
        placed++;
      }
    }
  }

  // After Level 5: Spawn Monsters on valid floor cells away from player spawn
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
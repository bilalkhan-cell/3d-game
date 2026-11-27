import * as THREE from 'three';

export const CELL_SIZE = 2;

export class Player {
  constructor(scene) {
    const geo = new THREE.SphereGeometry(0.55, 24, 24);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
      roughness: 0.2
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.light = new THREE.PointLight(0x38bdf8, 3, 9);
    this.light.position.set(0, 1.4, 0);
    this.mesh.add(this.light);

    this.radius = 0.5;
    this.speed = 6.5;
    this.keys = {};

    window.addEventListener('keydown', (e) => (this.keys[e.code] = true));
    window.addEventListener('keyup', (e) => (this.keys[e.code] = false));
    this.initMobileControls();
  }

  initMobileControls() {
    const buttons = document.querySelectorAll('.d-btn');
    buttons.forEach((btn) => {
      const code = btn.dataset.key;
      const press = (e) => {
        e.preventDefault();
        this.keys[code] = true;
      };
      const release = (e) => {
        e.preventDefault();
        this.keys[code] = false;
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
    });
  }

  resetPosition() {
    this.mesh.position.set(CELL_SIZE, 0.55, CELL_SIZE);
  }

  update(dt, grid, lavaTiles) {
    let dx = 0;
    let dz = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) dz -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) dz += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) dx -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) dx += 1;

    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz);
      dx = (dx / len) * this.speed * dt;
      dz = (dz / len) * this.speed * dt;
      const nextX = this.mesh.position.x + dx;
      const nextZ = this.mesh.position.z + dz;
      if (!this.hitsWall(nextX, this.mesh.position.z, grid)) this.mesh.position.x = nextX;
      if (!this.hitsWall(this.mesh.position.x, nextZ, grid)) this.mesh.position.z = nextZ;
    }

    const r = Math.round(this.mesh.position.z / CELL_SIZE);
    const c = Math.round(this.mesh.position.x / CELL_SIZE);
    const cell = grid[r]?.[c];
    if (cell === 3) return 'GOAL';
    if (cell === 2) {
      const activeLava = lavaTiles.find((tile) => tile.r === r && tile.c === c);
      if (activeLava && activeLava.isHot) return 'LAVA_HIT';
    }
    return 'ALIVE';
  }

  hitsWall(x, z, grid) {
    const offsets = [
      [this.radius, this.radius],
      [-this.radius, this.radius],
      [this.radius, -this.radius],
      [-this.radius, -this.radius]
    ];
    for (const [ox, oz] of offsets) {
      const c = Math.round((x + ox) / CELL_SIZE);
      const r = Math.round((z + oz) / CELL_SIZE);
      if (grid[r]?.[c] === 1 || !grid[r]) return true;
    }
    return false;
  }
}

export class Monster {
  constructor(scene, startR, startC, level) {
    this.group = new THREE.Group();
    this.bodyGeometry = new THREE.ConeGeometry(0.65, 1.5, 8);
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.6,
      roughness: 0.3
    });
    const body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
    body.position.y = 0.75;
    this.group.add(body);

    this.light = new THREE.PointLight(0xef4444, 2, 6);
    this.light.position.y = 1.3;
    this.group.add(this.light);
    this.group.position.set(startC * CELL_SIZE, 0, startR * CELL_SIZE);
    scene.add(this.group);

    this.r = startR;
    this.c = startC;
    this.targetR = startR;
    this.targetC = startC;
    this.lastDir = { dr: 0, dc: 0 };
    this.speed = 3.2 + Math.min(2.5, (level - 5) * 0.3);
  }

  update(dt, grid, playerPos) {
    const targetX = this.targetC * CELL_SIZE;
    const targetZ = this.targetR * CELL_SIZE;
    const dx = targetX - this.group.position.x;
    const dz = targetZ - this.group.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.08) {
      this.group.position.x = targetX;
      this.group.position.z = targetZ;
      this.r = this.targetR;
      this.c = this.targetC;
      this.pickNextTile(grid, playerPos);
    } else {
      this.group.position.x += (dx / dist) * this.speed * dt;
      this.group.position.z += (dz / dist) * this.speed * dt;
    }

    this.group.position.y = Math.sin(performance.now() * 0.008) * 0.15;
    const distToPlayer = Math.hypot(
      playerPos.x - this.group.position.x,
      playerPos.z - this.group.position.z
    );
    return distToPlayer < 0.9;
  }

  // Breadth-first search finds a shortest safe route over floor tiles.
  findPath(grid, targetR, targetC) {
    if (grid[targetR]?.[targetC] !== 0) return null;
    const rows = grid.length;
    const cols = grid[0].length;
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const firstStep = Array.from({ length: rows }, () => Array(cols).fill(null));
    const queue = [[this.r, this.c]];
    let head = 0;
    visited[this.r][this.c] = true;
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    while (head < queue.length) {
      const [r, c] = queue[head++];
      if (r === targetR && c === targetC) return firstStep[r][c];
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (grid[nr]?.[nc] !== 0 || visited[nr][nc]) continue;
        visited[nr][nc] = true;
        firstStep[nr][nc] = r === this.r && c === this.c
          ? { dr, dc }
          : firstStep[r][c];
        queue.push([nr, nc]);
      }
    }
    return null;
  }

  pickNextTile(grid, playerPos) {
    const targetR = Math.round(playerPos.z / CELL_SIZE);
    const targetC = Math.round(playerPos.x / CELL_SIZE);
    const pathStep = this.findPath(grid, targetR, targetC);
    if (pathStep) {
      this.targetR = this.r + pathStep.dr;
      this.targetC = this.c + pathStep.dc;
      this.lastDir = pathStep;
      return;
    }

    // If no safe route exists, wander through connected floor cells only.
    const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
    const valid = dirs.filter(({ dr, dc }) => grid[this.r + dr]?.[this.c + dc] === 0);
    if (!valid.length) return;
    let candidates = valid.filter(d => !(d.dr === -this.lastDir.dr && d.dc === -this.lastDir.dc));
    if (!candidates.length) candidates = valid;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    this.targetR = this.r + chosen.dr;
    this.targetC = this.c + chosen.dc;
    this.lastDir = chosen;
  }

  destroy(scene) {
    scene.remove(this.group);
    this.bodyGeometry.dispose();
    this.bodyMaterial.dispose();
    this.group.clear();
  }
}

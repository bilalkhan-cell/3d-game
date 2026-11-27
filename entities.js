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
  }

  resetPosition() {
    this.mesh.position.set(1 * CELL_SIZE, 0.55, 1 * CELL_SIZE);
  }

  update(dt, grid, lavaTiles) {
    let dx = 0;
    let dz = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) dz -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dz += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;

    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz);
      dx = (dx / len) * this.speed * dt;
      dz = (dz / len) * this.speed * dt;

      const nextX = this.mesh.position.x + dx;
      const nextZ = this.mesh.position.z + dz;

      if (!this.hitsWall(nextX, this.mesh.position.z, grid)) {
        this.mesh.position.x = nextX;
      }
      if (!this.hitsWall(this.mesh.position.x, nextZ, grid)) {
        this.mesh.position.z = nextZ;
      }
    }

    // Check current cell for Lava or Goal
    const r = Math.round(this.mesh.position.z / CELL_SIZE);
    const c = Math.round(this.mesh.position.x / CELL_SIZE);
    const cell = grid[r]?.[c];

    if (cell === 3) return 'GOAL';

    // Check if touching active glowing lava
    if (cell === 2) {
      const activeLava = lavaTiles.find((tile) => tile.r === r && tile.c === c);
      if (activeLava && activeLava.isHot) {
        return 'LAVA_HIT';
      }
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
      if (grid[r]?.[c] === 1) {
        return true;
      }
    }
    return false;
  }
}

export class Monster {
  constructor(scene, startR, startC, level) {
    this.group = new THREE.Group();

    const bodyGeo = new THREE.ConeGeometry(0.65, 1.5, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.6,
      roughness: 0.3
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.75;
    this.group.add(body);

    const light = new THREE.PointLight(0xef4444, 2, 6);
    light.position.y = 1.3;
    this.group.add(light);

    this.group.position.set(startC * CELL_SIZE, 0, startR * CELL_SIZE);
    scene.add(this.group);

    this.r = startR;
    this.c = startC;
    this.targetR = startR;
    this.targetC = startC;
    this.lastDir = { dr: 0, dc: 0 };
    // Monsters move slightly faster as levels climb
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

    // Floating bob animation
    this.group.position.y = Math.sin(performance.now() * 0.008) * 0.15;

    // Collision check with player
    const distToPlayer = Math.hypot(
      playerPos.x - this.group.position.x,
      playerPos.z - this.group.position.z
    );
    return distToPlayer < 0.9;
  }

  pickNextTile(grid, playerPos) {
    const dirs = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 }
    ];

    const valid = dirs.filter(({ dr, dc }) => {
      const nr = this.r + dr;
      const nc = this.c + dc;
      return grid[nr] && grid[nr][nc] !== 1;
    });

    if (valid.length === 0) return;

    // Avoid immediate U-turns unless trapped in a dead end
    let candidates = valid.filter(
      (d) => !(d.dr === -this.lastDir.dr && d.dc === -this.lastDir.dc)
    );
    if (candidates.length === 0) candidates = valid;

    // Bias movement toward the player
    candidates.sort((a, b) => {
      const distA = Math.hypot(
        (this.c + a.dc) * CELL_SIZE - playerPos.x,
        (this.r + a.dr) * CELL_SIZE - playerPos.z
      );
      const distB = Math.hypot(
        (this.c + b.dc) * CELL_SIZE - playerPos.x,
        (this.r + b.dr) * CELL_SIZE - playerPos.z
      );
      return distA - distB;
    });

    const chosen = Math.random() < 0.7 ? candidates[0] : candidates[Math.floor(Math.random() * candidates.length)];
    this.targetR = this.r + chosen.dr;
    this.targetC = this.c + chosen.dc;
    this.lastDir = chosen;
  }

  destroy(scene) {
    scene.remove(this.group);
  }
}
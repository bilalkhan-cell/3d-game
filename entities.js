import * as THREE from 'three';

export const CELL_SIZE = 2;

export class Player {
  constructor(scene) {
    this.mesh = new THREE.Group();
    this.mesh.name = 'player-character';
    this.visual = new THREE.Group();
    this.mesh.add(this.visual);
    const makeMat = (color, roughness = 0.78, metalness = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const skin = makeMat(0xc58f68);
    const jacket = makeMat(0x344b5c);
    const trousers = makeMat(0x202b39);
    const boots = makeMat(0x171d25);
    const hair = makeMat(0x24201d);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.4 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.38, 5, 10), jacket);
    torso.position.y = 0.88; torso.castShadow = true; this.visual.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), skin);
    head.position.y = 1.48; head.castShadow = true; this.visual.add(head);
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.225, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.48), hair);
    hairCap.position.y = 1.53; this.visual.add(hairCap);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyeMat);
      eye.position.set(side * 0.075, 1.49, 0.19); this.visual.add(eye);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.31, 4, 8), jacket);
      arm.position.set(side * 0.31, 0.91, 0); arm.rotation.z = side * -0.12;
      arm.castShadow = true; this.visual.add(arm);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.31, 4, 8), trousers);
      leg.position.set(side * 0.13, 0.34, 0); leg.castShadow = true; this.visual.add(leg);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.27), boots);
      boot.position.set(side * 0.13, 0.1, 0.045); this.visual.add(boot);
    }
    scene.add(this.mesh);
    this.light = new THREE.PointLight(0x9bc9df, 0.65, 5);
    this.light.position.set(0, 1.2, 0); this.mesh.add(this.light);
    this.radius = 0.34; this.speed = 5.2; this.keys = {};
    this.jumpHeight = 0; this.verticalVelocity = 0; this.jumpHeld = false;
    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    const jump = document.getElementById('jump-btn');
    if (jump) {
      const start = e => { e.preventDefault(); this.jump(); };
      jump.addEventListener('pointerdown', start);
      jump.addEventListener('click', start);
    }
  }

  jump() {
    if (this.jumpHeight <= 0.001) this.verticalVelocity = 6.2;
  }

  resetPosition() {
    this.mesh.position.set(CELL_SIZE, 0, CELL_SIZE);
    this.jumpHeight = 0; this.verticalVelocity = 0;
    this.visual.position.y = 0;
  }

  update(dt, grid, lavaTiles) {
    const grounded = this.jumpHeight <= 0.001;
    if ((this.keys.Space || this.keys.KeyJ) && grounded && !this.jumpHeld) this.jump();
    this.jumpHeld = !!(this.keys.Space || this.keys.KeyJ);
    this.verticalVelocity -= 17 * dt;
    this.jumpHeight = Math.max(0, this.jumpHeight + this.verticalVelocity * dt);
    if (this.jumpHeight === 0) this.verticalVelocity = 0;
    this.visual.position.y = this.jumpHeight;
    this.visual.rotation.z = 0;

    let dx = 0, dz = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) dz -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) dz += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) dx -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) dx += 1;
    if (dx || dz) {
      const len = Math.hypot(dx, dz);
      dx = dx / len * this.speed * dt; dz = dz / len * this.speed * dt;
      const nx = this.mesh.position.x + dx, nz = this.mesh.position.z + dz;
      if (!this.hitsWall(nx, this.mesh.position.z, grid)) this.mesh.position.x = nx;
      if (!this.hitsWall(this.mesh.position.x, nz, grid)) this.mesh.position.z = nz;
      this.mesh.rotation.y = Math.atan2(dx, dz);
      this.visual.rotation.z = Math.sin(performance.now() * 0.012) * 0.035;
    }
    const r = Math.round(this.mesh.position.z / CELL_SIZE);
    const c = Math.round(this.mesh.position.x / CELL_SIZE);
    const cell = grid[r]?.[c];
    if (this.jumpHeight < 0.28 && cell === 3) return 'GOAL';
    if (this.jumpHeight < 0.28 && cell === 2) {
      const tile = lavaTiles.find(t => t.r === r && t.c === c);
      if (tile && tile.isHot) return 'LAVA_HIT';
    }
    return 'ALIVE';
  }

  hitsWall(x, z, grid) {
    if (this.jumpHeight > 0.45) return false;
    const offsets = [[this.radius,this.radius],[-this.radius,this.radius],[this.radius,-this.radius],[-this.radius,-this.radius]];
    for (const [ox, oz] of offsets) {
      const c = Math.round((x + ox) / CELL_SIZE), r = Math.round((z + oz) / CELL_SIZE);
      if (grid[r]?.[c] === 1 || !grid[r]) return true;
    }
    return false;
  }
}

export class Monster {
  constructor(scene, startR, startC, level) {
    this.group = new THREE.Group();
    this.bodyGeometry = new THREE.CapsuleGeometry(0.36, 0.62, 5, 10);
    this.bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x7d3434, roughness: 0.82 });
    const body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
    body.position.y = 0.68; body.castShadow = true; this.group.add(body);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xe8c6a0, emissive: 0x5b241b, emissiveIntensity: 0.2 });
    for (const side of [-1,1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
      eye.position.set(side * 0.12, 1.02, 0.29); this.group.add(eye);
    }
    this.light = new THREE.PointLight(0xa45b50, 0.7, 4);
    this.light.position.y = 1.1; this.group.add(this.light);
    this.group.position.set(startC * CELL_SIZE, 0, startR * CELL_SIZE); scene.add(this.group);
    this.r = startR; this.c = startC; this.targetR = startR; this.targetC = startC;
    this.lastDir = { dr: 0, dc: 0 };
    this.speed = 2.7 + Math.min(1.8, (level - 5) * 0.22);
  }
  update(dt, grid, playerPos) {
    const tx = this.targetC * CELL_SIZE, tz = this.targetR * CELL_SIZE;
    const dx = tx - this.group.position.x, dz = tz - this.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) {
      this.group.position.x = tx; this.group.position.z = tz;
      this.r = this.targetR; this.c = this.targetC; this.pickNextTile(grid, playerPos);
    } else {
      this.group.position.x += dx / dist * this.speed * dt;
      this.group.position.z += dz / dist * this.speed * dt;
      this.group.rotation.y = Math.atan2(dx, dz);
    }
    const d = Math.hypot(playerPos.x - this.group.position.x, playerPos.z - this.group.position.z);
    return d < 0.78;
  }
  findPath(grid, tr, tc) {
    if (grid[tr]?.[tc] !== 0) return null;
    const seen = Array.from({length:grid.length},()=>Array(grid[0].length).fill(false));
    const first = Array.from({length:grid.length},()=>Array(grid[0].length).fill(null));
    const queue = [[this.r,this.c]]; let head = 0; seen[this.r][this.c] = true;
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    while (head < queue.length) {
      const [r,c] = queue[head++];
      if (r === tr && c === tc) return first[r][c];
      for (const [dr,dc] of dirs) {
        const nr=r+dr,nc=c+dc;
        if (grid[nr]?.[nc] !== 0 || seen[nr][nc]) continue;
        seen[nr][nc]=true; first[nr][nc]=(r===this.r&&c===this.c)?{dr,dc}:first[r][c];
        queue.push([nr,nc]);
      }
    }
    return null;
  }
  pickNextTile(grid, playerPos) {
    const tr=Math.round(playerPos.z/CELL_SIZE), tc=Math.round(playerPos.x/CELL_SIZE);
    const step=this.findPath(grid,tr,tc);
    if (step) { this.targetR=this.r+step.dr; this.targetC=this.c+step.dc; this.lastDir=step; return; }
    const dirs=[{dr:-1,dc:0},{dr:1,dc:0},{dr:0,dc:-1},{dr:0,dc:1}];
    const valid=dirs.filter(d=>grid[this.r+d.dr]?.[this.c+d.dc]===0);
    let choices=valid.filter(d=>d.dr!==-this.lastDir.dr||d.dc!==-this.lastDir.dc);
    if (!choices.length) choices=valid;
    if (choices.length) { const d=choices[Math.floor(Math.random()*choices.length)]; this.targetR=this.r+d.dr; this.targetC=this.c+d.dc; this.lastDir=d; }
  }
  destroy(scene) {
    scene.remove(this.group); this.bodyGeometry.dispose(); this.bodyMaterial.dispose();
    this.group.traverse(o=>{ if(o.geometry && o.geometry!==this.bodyGeometry) o.geometry.dispose(); if(o.material && o.material!==this.bodyMaterial) o.material.dispose(); });
    this.group.clear();
  }
}
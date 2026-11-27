import * as THREE from 'three';
export const CELL_SIZE = 2;
export class Player {
 constructor(scene){
  this.mesh=new THREE.Group();this.visual=new THREE.Group();this.mesh.add(this.visual);
  const mat=(color,roughness=.78)=>new THREE.MeshStandardMaterial({color,roughness});
  const skin=mat(0xc58f68),jacket=mat(0x344b5c),pants=mat(0x202b39),boots=mat(0x171d25),hair=mat(0x24201d);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.25,.38,6,12),jacket);torso.position.y=.88;torso.castShadow=true;this.visual.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.22,24,18),skin);head.position.y=1.48;head.castShadow=true;this.visual.add(head);
  const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.225,20,12,0,Math.PI*2,0,Math.PI*.48),hair);hairCap.position.y=1.53;this.visual.add(hairCap);
  this.legs=[];this.arms=[];
  for(const side of [-1,1]){
   const eye=new THREE.Mesh(new THREE.SphereGeometry(.025,10,8),mat(0x171717,.4));eye.position.set(side*.075,1.49,.19);this.visual.add(eye);
   const armPivot=new THREE.Group();armPivot.position.set(side*.29,1.04,0);this.visual.add(armPivot);
   const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.31,5,10),jacket);arm.position.y=-.16;arm.castShadow=true;armPivot.add(arm);this.arms.push(armPivot);
   const legPivot=new THREE.Group();legPivot.position.set(side*.13,.48,0);this.visual.add(legPivot);
   const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.09,.31,5,10),pants);leg.position.y=-.17;leg.castShadow=true;legPivot.add(leg);
   const boot=new THREE.Mesh(new THREE.BoxGeometry(.17,.12,.27),boots);boot.position.set(0,-.39,.045);legPivot.add(boot);this.legs.push(legPivot);
  }
  scene.add(this.mesh);this.light=new THREE.PointLight(0x9bb6b0,.35,4);this.light.position.set(0,1.2,0);this.mesh.add(this.light);
  this.radius=.34;this.speed=5.2;this.keys={};this.moveX=0;this.moveZ=0;this.jumpHeight=0;this.verticalVelocity=0;this.jumpHeld=false;this.walkClock=0;
  window.addEventListener('keydown',e=>{this.keys[e.code]=true;if(e.code==='Space')e.preventDefault();});
  window.addEventListener('keyup',e=>{this.keys[e.code]=false;});
  const jump=document.getElementById('jump-btn');if(jump)jump.addEventListener('pointerdown',e=>{e.preventDefault();this.jump();});
 }
 setMoveVector(x,z){this.moveX=x;this.moveZ=z;}
 jump(){if(this.jumpHeight<=.001)this.verticalVelocity=6.5;}
 resetPosition(r=1,c=1){this.mesh.position.set(c*CELL_SIZE,0,r*CELL_SIZE);this.jumpHeight=0;this.verticalVelocity=0;this.visual.position.y=0;}
 update(dt,grid,lavaTiles){
  const grounded=this.jumpHeight<=.001;
  if((this.keys.Space||this.keys.KeyJ)&&grounded&&!this.jumpHeld)this.jump();
  this.jumpHeld=!!(this.keys.Space||this.keys.KeyJ);
  this.verticalVelocity-=18*dt;this.jumpHeight=Math.max(0,this.jumpHeight+this.verticalVelocity*dt);if(this.jumpHeight===0)this.verticalVelocity=0;
  this.visual.position.y=this.jumpHeight;
  let dx=this.moveX,dz=this.moveZ;
  if(!dx&&!dz){if(this.keys.KeyA||this.keys.ArrowLeft)dx-=1;if(this.keys.KeyD||this.keys.ArrowRight)dx+=1;if(this.keys.KeyW||this.keys.ArrowUp)dz-=1;if(this.keys.KeyS||this.keys.ArrowDown)dz+=1;}
  const moving=Math.hypot(dx,dz)>.08;
  if(moving){
   const len=Math.hypot(dx,dz);dx=dx/len*this.speed*dt;dz=dz/len*this.speed*dt;
   const nx=this.mesh.position.x+dx,nz=this.mesh.position.z+dz;
   if(!this.hitsWall(nx,this.mesh.position.z,grid))this.mesh.position.x=nx;
   if(!this.hitsWall(this.mesh.position.x,nz,grid))this.mesh.position.z=nz;
   const target=Math.atan2(dx,dz);let diff=((target-this.mesh.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;
   this.mesh.rotation.y+=diff*Math.min(1,dt*12);
   this.walkClock+=dt*11;const swing=Math.sin(this.walkClock)*.62;
   this.legs[0].rotation.x=swing;this.legs[1].rotation.x=-swing;
   this.arms[0].rotation.x=-swing*.72;this.arms[1].rotation.x=swing*.72;
  }else{
   this.legs.forEach(l=>l.rotation.x=THREE.MathUtils.damp(l.rotation.x,0,10,dt));
   this.arms.forEach(a=>a.rotation.x=THREE.MathUtils.damp(a.rotation.x,0,10,dt));
  }
  this.visual.rotation.z= moving?Math.sin(this.walkClock*2)*.025:0;
  const r=Math.round(this.mesh.position.z/CELL_SIZE),c=Math.round(this.mesh.position.x/CELL_SIZE),cell=grid[r]?.[c];
  if(this.jumpHeight<.3&&cell===3)return 'GOAL';
  if(this.jumpHeight<.3&&cell===2){const lava=lavaTiles.find(t=>t.r===r&&t.c===c);if(lava&&lava.isHot)return 'LAVA_HIT';}
  return 'ALIVE';
 }
 hitsWall(x,z,grid){
  const o=[[this.radius,this.radius],[-this.radius,this.radius],[this.radius,-this.radius],[-this.radius,-this.radius]];
  for(const [ox,oz] of o){const c=Math.round((x+ox)/CELL_SIZE),r=Math.round((z+oz)/CELL_SIZE);if(grid[r]?.[c]===1||!grid[r])return true;}return false;
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
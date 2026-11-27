import * as THREE from 'three';
import { generateMaze } from './maze.js';
import { Player, Monster, CELL_SIZE } from './entities.js';
const $=id=>document.getElementById(id),container=$('game-container');
const scene=new THREE.Scene();scene.background=new THREE.Color(0x171b1d);scene.fog=new THREE.FogExp2(0x171b1d,.022);
const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,220);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;container.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xd9e5e0,0x454039,.85));
const sun=new THREE.DirectionalLight(0xffe6c8,2.0);sun.position.set(12,22,10);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-28;sun.shadow.camera.right=28;sun.shadow.camera.top=28;sun.shadow.camera.bottom=-28;sun.shadow.bias=-.00025;scene.add(sun);
const fill=new THREE.DirectionalLight(0xb8c9d0,.45);fill.position.set(-10,9,-8);scene.add(fill);
const player=new Player(scene);let levelGroup=new THREE.Group();scene.add(levelGroup);
let currentLevel=1,mazeData,lavaTiles=[],monsters=[],heartPickups=[],goalMesh=null,checkpointMesh=null,checkpoint={r:1,c:1},hearts=0,isPaused=false,bannerTimer=null;
const wallMat=new THREE.MeshStandardMaterial({color:0x59605c,roughness:.86,metalness:.04});
const floorMat=new THREE.MeshStandardMaterial({color:0x555b55,roughness:.96});
const goalMat=new THREE.MeshStandardMaterial({color:0x8eb49a,emissive:0x315d42,emissiveIntensity:.4,roughness:.3,metalness:.2});
const lavaCanvas=document.createElement('canvas');lavaCanvas.width=256;lavaCanvas.height=256;const ctx=lavaCanvas.getContext('2d');
const grad=ctx.createLinearGradient(0,0,256,256);grad.addColorStop(0,'#5d170d');grad.addColorStop(.35,'#e64b16');grad.addColorStop(.62,'#ffb33c');grad.addColorStop(1,'#7a190b');ctx.fillStyle=grad;ctx.fillRect(0,0,256,256);
for(let i=0;i<18;i++){ctx.beginPath();ctx.strokeStyle=i%3===0?'#ffd07899':'#ff642b88';ctx.lineWidth=3+(i%3);const y=(i*37)%256;ctx.moveTo(-20,y);ctx.bezierCurveTo(55,y-35,110,y+40,165,y);ctx.bezierCurveTo(205,y-24,235,y+20,280,y-5);ctx.stroke();}
const lavaTexture=new THREE.CanvasTexture(lavaCanvas);lavaTexture.wrapS=THREE.RepeatWrapping;lavaTexture.wrapT=THREE.RepeatWrapping;lavaTexture.colorSpace=THREE.SRGBColorSpace;
const lavaMat=new THREE.MeshStandardMaterial({map:lavaTexture,color:0xffffff,emissive:0x8d2108,emissiveMap:lavaTexture,emissiveIntensity:.8,roughness:.48});
const fovSlider=$('fov'),fovValue=$('fov-value'),sensitivity=$('sensitivity'),graphicsSelect=$('graphics');
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1700);}
function setFov(value){const f=THREE.MathUtils.clamp(Number(value)||60,40,100);camera.fov=f;camera.updateProjectionMatrix();fovSlider.value=String(f);fovValue.value=f+'°';document.querySelectorAll('[data-fov]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.fov)===f));}
fovSlider.addEventListener('input',()=>setFov(fovSlider.value));document.querySelectorAll('[data-fov]').forEach(b=>b.addEventListener('click',()=>setFov(b.dataset.fov)));
function applyGraphics(level){
 const presets={
  low:{ratio:1,shadow:false,map:512,exposure:1.0,ambient:.7,antialias:false},
  medium:{ratio:1.5,shadow:true,map:1536,exposure:1.12,ambient:.85,antialias:true},
  high:{ratio:2,shadow:true,map:3072,exposure:1.28,ambient:1.0,antialias:true}
 };const p=presets[level]||presets.medium;
 renderer.setPixelRatio(Math.min(devicePixelRatio,p.ratio));renderer.shadowMap.enabled=p.shadow;sun.castShadow=p.shadow;sun.shadow.mapSize.set(p.map,p.map);sun.shadow.map?.dispose();sun.shadow.map=null;
 renderer.toneMappingExposure=p.exposure;scene.children.find(o=>o.isHemisphereLight).intensity=p.ambient;
 wallMat.needsUpdate=true;floorMat.needsUpdate=true;lavaMat.needsUpdate=true;
 renderer.setSize(innerWidth,innerHeight);toast('GRAPHICS: '+level.toUpperCase());
}
graphicsSelect.addEventListener('change',()=>applyGraphics(graphicsSelect.value));
function updateHearts(){ $('heart-count').textContent=hearts+' ♥'; }
function cellPosition(r,c){return new THREE.Vector3(c*CELL_SIZE,0,r*CELL_SIZE);}
function chooseCheckpoint(grid,size){
 const seen=Array.from({length:size},()=>Array(size).fill(false)),q=[[1,1]];seen[1][1]=true;let best={r:1,c:1,d:0},head=0;
 const dirs=[[-1,0],[1,0],[0,-1],[0,1]];
 while(head<q.length){const [r,c]=q[head++];const d=Math.abs(r-1)+Math.abs(c-1);if(grid[r]?.[c]===0&&d>best.d)best={r,c,d};
  for(const [dr,dc] of dirs){const nr=r+dr,nc=c+dc;if(grid[nr]?.[nc]===0&&!seen[nr][nc]){seen[nr][nc]=true;q.push([nr,nc]);}}
 }return best;
}
function makeHeart(r,c){
 const shape=new THREE.Shape();shape.moveTo(0,.12);shape.bezierCurveTo(-.62,.55,-.72,-.12,0,-.55);shape.bezierCurveTo(.72,-.12,.62,.55,0,.12);
 const geo=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.035,bevelThickness:.035});
 const mat=new THREE.MeshStandardMaterial({color:0xc96d70,roughness:.32,metalness:.12,emissive:0x401012,emissiveIntensity:.25});
 const mesh=new THREE.Mesh(geo,mat);mesh.position.set(c*CELL_SIZE,.95,r*CELL_SIZE);mesh.rotation.x=0;mesh.scale.set(.62,.62,.62);mesh.castShadow=true;levelGroup.add(mesh);heartPickups.push({r,c,mesh,phase:heartPickups.length*.8,active:true});
}
function buildLevel(level){
 scene.remove(levelGroup);levelGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&!Array.isArray(o.material)&&o.material!==wallMat&&o.material!==floorMat&&o.material!==lavaMat&&o.material!==goalMat)o.material.dispose();});
 levelGroup=new THREE.Group();scene.add(levelGroup);monsters.forEach(m=>m.destroy(scene));monsters=[];lavaTiles=[];heartPickups=[];
 mazeData=generateMaze(level);const {grid,size,goalPos,lavaCells,monsterSpawns}=mazeData;
 $('level-num').textContent=String(level);$('maze-size').textContent=size+'×'+size;$('hazard-status').textContent=level<=3?'NONE':level<=5?'FLOWING LAVA':'LAVA + '+monsterSpawns.length+' MONSTER(S)';
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(size*CELL_SIZE,size*CELL_SIZE),floorMat);floor.rotation.x=-Math.PI/2;floor.position.set((size-1)*CELL_SIZE/2,-.08,(size-1)*CELL_SIZE/2);floor.receiveShadow=true;levelGroup.add(floor);
 const wallGeo=new THREE.BoxGeometry(CELL_SIZE,2.35,CELL_SIZE);
 for(let r=0;r<size;r++)for(let c=0;c<size;c++)if(grid[r][c]===1){const w=new THREE.Mesh(wallGeo,wallMat);w.position.set(c*CELL_SIZE,1.12,r*CELL_SIZE);w.castShadow=true;w.receiveShadow=true;levelGroup.add(w);}
 goalMesh=new THREE.Mesh(new THREE.TorusGeometry(.62,.13,16,40),goalMat);goalMesh.position.set(goalPos.c*CELL_SIZE,1,goalPos.r*CELL_SIZE);goalMesh.rotation.x=Math.PI/2;goalMesh.castShadow=true;levelGroup.add(goalMesh);
 lavaCells.forEach(({r,c},i)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(CELL_SIZE*.94,.14,CELL_SIZE*.94),lavaMat);m.position.set(c*CELL_SIZE,.08,r*CELL_SIZE);m.receiveShadow=true;levelGroup.add(m);const light=new THREE.PointLight(0xff6428,.5,3.2);light.position.set(c*CELL_SIZE,.45,r*CELL_SIZE);levelGroup.add(light);lavaTiles.push({r,c,mesh:m,light,phaseOffset:i*1.17,isHot:true});});
 monstersSpawnsSafe(monsterSpawns,level);
 checkpoint=chooseCheckpoint(grid,size);const cpGeo=new THREE.TorusGeometry(.55,.08,10,28),cpMat=new THREE.MeshStandardMaterial({color:0x9ac8b0,emissive:0x38684f,emissiveIntensity:.45,roughness:.35});checkpointMesh=new THREE.Mesh(cpGeo,cpMat);checkpointMesh.rotation.x=Math.PI/2;checkpointMesh.position.set(checkpoint.c*CELL_SIZE,.16,checkpoint.r*CELL_SIZE);levelGroup.add(checkpointMesh);
 const candidates=[];for(let r=1;r<size-1;r++)for(let c=1;c<size-1;c++)if(grid[r][c]===0&&!(r===1&&c===1)&&!(r===checkpoint.r&&c===checkpoint.c)&&!(r===goalPos.r&&c===goalPos.c))candidates.push({r,c});
 for(let i=candidates.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 const heartCount=Math.min(2+Math.floor(level/4),candidates.length);for(let i=0;i<heartCount;i++)makeHeart(candidates[i].r,candidates[i].c);
 player.resetPosition();yaw=0;pitch=.78;cameraDistance=Math.max(10,Math.min(20,size*.76));$('pause-btn').textContent='Ⅱ PAUSE';
}
function monstersSpawnsSafe(spawns,level){spawns.forEach(({r,c})=>monsters.push(new Monster(scene,r,c,level)));}
function respawn(reason){
 if(hearts>0){hearts--;updateHearts();toast('HEART USED · '+hearts+' LEFT');}
 else toast('NO HEARTS · CHECKPOINT RESPAWN');
 player.resetPosition(checkpoint.r,checkpoint.c);
}
function showBanner(title,subtitle,danger=false,callback=()=>{}){isPaused=true;$('banner-title').textContent=title;$('banner-sub').textContent=subtitle;$('banner').classList.toggle('danger',danger);$('banner').classList.remove('hidden');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>{$('banner').classList.add('hidden');callback();isPaused=false;$('pause-btn').textContent='Ⅱ PAUSE';},1450);}
function togglePause(){if(!$('banner').classList.contains('hidden'))return;isPaused=!isPaused;$('pause-btn').textContent=isPaused?'▶ RESUME':'Ⅱ PAUSE';toast(isPaused?'GAME PAUSED':'GAME RESUMED');}
$('pause-btn').addEventListener('click',togglePause);$('restart-btn').addEventListener('click',()=>{clearTimeout(bannerTimer);$('banner').classList.add('hidden');isPaused=false;currentLevel=1;hearts=0;updateHearts();buildLevel(1);toast('NEW RUN · COLLECT HEARTS TO EARN THEM');});
window.addEventListener('keydown',e=>{if(e.code==='Escape'||e.code==='KeyP')togglePause();});
const settings=$('settings'),settingsToggle=$('settings-toggle');
settingsToggle.addEventListener('click',()=>{const open=settings.classList.toggle('hidden')===false;settingsToggle.setAttribute('aria-expanded',String(open));});
$('close-settings').addEventListener('click',()=>{settings.classList.add('hidden');settingsToggle.setAttribute('aria-expanded','false');});
let toggleDrag=null,toggleMoved=false;
settingsToggle.addEventListener('pointerdown',e=>{toggleDrag={x:e.clientX,y:e.clientY,left:settingsToggle.offsetLeft,top:settingsToggle.offsetTop};toggleMoved=false;settingsToggle.setPointerCapture(e.pointerId);});
settingsToggle.addEventListener('pointermove',e=>{if(!toggleDrag)return;const dx=e.clientX-toggleDrag.x,dy=e.clientY-toggleDrag.y;if(Math.hypot(dx,dy)>5)toggleMoved=true;if(toggleMoved){settingsToggle.style.left=Math.max(0,Math.min(innerWidth-settingsToggle.offsetWidth,toggleDrag.left+dx))+'px';settingsToggle.style.top=Math.max(0,Math.min(innerHeight-settingsToggle.offsetHeight,toggleDrag.top+dy))+'px';settingsToggle.style.right='auto';}});
settingsToggle.addEventListener('pointerup',()=>{toggleDrag=null;});settingsToggle.addEventListener('click',e=>{if(toggleMoved){e.stopImmediatePropagation();toggleMoved=false;}},true);
const canvas=renderer.domElement,activePointers=new Map();let yaw=0,pitch=.78,cameraDistance=12,dragging=false,lastX=0,lastY=0,pinchStartDistance=0,pinchStartZoom=12;
const pointerDistance=()=>{const p=[...activePointers.values()];return p.length<2?0:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);};
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);if(activePointers.size>=2){dragging=false;pinchStartDistance=pointerDistance();pinchStartZoom=cameraDistance;}else{dragging=true;lastX=e.clientX;lastY=e.clientY;}});
canvas.addEventListener('pointermove',e=>{if(!activePointers.has(e.pointerId))return;activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(activePointers.size>=2){const d=pointerDistance();if(pinchStartDistance&&d)cameraDistance=THREE.MathUtils.clamp(pinchStartZoom*pinchStartDistance/d,6,32);return;}if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;const speed=Number(sensitivity.value);yaw-=dx*speed;pitch=THREE.MathUtils.clamp(pitch+dy*speed,.2,1.4);});
function stopDrag(e){activePointers.delete(e.pointerId);dragging=false;if(activePointers.size===1){const p=[...activePointers.values()][0];lastX=p.x;lastY=p.y;pinchStartDistance=0;}}
['pointerup','pointercancel','lostpointercapture'].forEach(t=>canvas.addEventListener(t,stopDrag));
canvas.addEventListener('wheel',e=>{cameraDistance=THREE.MathUtils.clamp(cameraDistance+e.deltaY*.012,6,32);e.preventDefault();},{passive:false});
const joy=$('joystick'),knob=$('joystick-knob');let joyPointer=null;
function joystickMove(e){const rect=joy.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,max=rect.width*.34;let dx=e.clientX-cx,dy=e.clientY-cy;const len=Math.hypot(dx,dy);if(len>max){dx=dx/len*max;dy=dy/len*max;}knob.style.transform='translate(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px))';player.setMoveVector(dx/max,-dy/max);}
joy.addEventListener('pointerdown',e=>{e.preventDefault();joyPointer=e.pointerId;joy.setPointerCapture(e.pointerId);joystickMove(e);});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)joystickMove(e);});
function releaseJoy(e){if(e.pointerId!==joyPointer)return;joyPointer=null;player.setMoveVector(0,0);knob.style.transform='translate(-50%,-50%)';}
['pointerup','pointercancel','lostpointercapture'].forEach(t=>joy.addEventListener(t,releaseJoy));
window.addEventListener('blur',()=>{player.keys={};player.setMoveVector(0,0);dragging=false;});
async function enterImmersive(){try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();if(screen.orientation?.lock)await screen.orientation.lock('landscape');}catch{}}
document.addEventListener('pointerdown',()=>{if(matchMedia('(pointer:coarse)').matches)enterImmersive();},{once:true});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,({low:1,medium:1.5,high:2}[graphicsSelect.value]||1.5)));renderer.setSize(innerWidth,innerHeight);});
buildLevel(1);setFov(60);applyGraphics('medium');updateHearts();
let lastTime=performance.now();
function animate(now){
 requestAnimationFrame(animate);const dt=Math.min((now-lastTime)/1000,.06);lastTime=now;
 lavaTexture.offset.x=(now*.000035)%1;lavaTexture.offset.y=(now*.000018)%1;
 lavaTiles.forEach(t=>{const wave=Math.sin(now*.002+t.phaseOffset)+Math.sin(now*.0012+t.phaseOffset*1.7)*.35;t.isHot=wave>-.65;t.mesh.material=lavaMat;t.mesh.position.y=.08+Math.sin(now*.003+t.phaseOffset)*.025;t.light.intensity=t.isHot?.55+Math.max(0,wave)*.25:.12;});
 if(goalMesh){goalMesh.rotation.z+=dt*.7;goalMesh.rotation.y+=dt*.3;}
 if(checkpointMesh){checkpointMesh.rotation.z+=dt*.7;checkpointMesh.material.emissiveIntensity=.3+Math.sin(now*.003)*.15;}
 heartPickups.forEach(h=>{if(h.active){h.mesh.position.y=.95+Math.sin(now*.003+h.phase)*.13;h.mesh.rotation.y=now*.0015+h.phase;}});
 if(!isPaused){
  const status=player.update(dt,mazeData.grid,lavaTiles),r=Math.round(player.mesh.position.z/CELL_SIZE),c=Math.round(player.mesh.position.x/CELL_SIZE);
  if(r===checkpoint.r&&c===checkpoint.c&&checkpointMesh.visible){checkpointMesh.visible=false;toast('CHECKPOINT REACHED');}
  for(const h of heartPickups){if(h.active&&h.r===r&&h.c===c){h.active=false;levelGroup.remove(h.mesh);h.mesh.geometry.dispose();h.mesh.material.dispose();hearts++;updateHearts();toast('HEART COLLECTED · '+hearts);}}
  if(status==='GOAL'){currentLevel++;showBanner('LEVEL '+(currentLevel-1)+' CLEARED','Entering level '+currentLevel,false,()=>buildLevel(currentLevel));}
  else if(status==='LAVA_HIT'){showBanner('LAVA CONTACT','Returning to your checkpoint.',true,()=>respawn('lava'));}
  for(const monster of monsters){if(monster.update(dt,mazeData.grid,player.mesh.position)&&!isPaused){showBanner('CAUGHT','Returning to your checkpoint.',true,()=>respawn('monster'));break;}}
 }
 const horizontal=Math.cos(pitch)*cameraDistance,vertical=Math.sin(pitch)*cameraDistance;
 const desired=new THREE.Vector3(player.mesh.position.x+Math.sin(yaw)*horizontal,player.mesh.position.y+vertical+1.0,player.mesh.position.z+Math.cos(yaw)*horizontal);
 camera.position.lerp(desired,1-Math.exp(-dt*8));camera.lookAt(player.mesh.position.x,player.mesh.position.y+.78,player.mesh.position.z);renderer.render(scene,camera);
}
requestAnimationFrame(animate);

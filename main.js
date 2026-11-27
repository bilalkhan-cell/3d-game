import * as THREE from 'three';
import { generateMaze } from './maze.js';
import { Player, Monster, CELL_SIZE } from './entities.js';

const $ = (id) => document.getElementById(id);
const container = $('game-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171b1d);
scene.fog = new THREE.FogExp2(0x171b1d, 0.025);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 180);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const graphicsSelect = $('graphics');
function applyGraphics(level) {
  const presets = {
    low: { ratio: 0.85, shadows: false, fog: 0.012, light: 0.85 },
    medium: { ratio: 1.25, shadows: true, fog: 0.025, light: 1.1 },
    high: { ratio: 1.75, shadows: true, fog: 0.032, light: 1.25 }
  };
  const p = presets[level] || presets.medium;
  renderer.setPixelRatio(Math.min(devicePixelRatio, p.ratio));
  renderer.shadowMap.enabled = p.shadows;
  sun.intensity = p.light;
  scene.fog.density = p.fog;
  renderer.setSize(innerWidth, innerHeight);
  toast('GRAPHICS: ' + level.toUpperCase());
}
graphicsSelect.addEventListener('change', () => applyGraphics(graphicsSelect.value));
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xe2d8c7, 1.1);
sun.position.set(15, 30, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const player = new Player(scene);
let levelGroup = new THREE.Group();
scene.add(levelGroup);
let currentLevel = 1, mazeData, lavaTiles = [], monsters = [], goalMesh = null, isPaused = false, bannerTimer = null;
const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a5050, roughness: 0.94 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x303637, roughness: 0.98 });
const lavaMat = new THREE.MeshStandardMaterial({ color: 0xff4500, emissive: 0xff2200, emissiveIntensity: 0.9 });
const goalMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.8 });

let yaw = 0, pitch = 0.78, cameraDistance = 12, dragging = false, lastX = 0, lastY = 0;
const fovSlider = $('fov'), fovValue = $('fov-value'), sensitivity = $('sensitivity');
function setFov(value) {
  const fov = THREE.MathUtils.clamp(Number(value) || 60, 40, 100);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  fovSlider.value = String(fov);
  fovValue.value = fov + '°';
  document.querySelectorAll('[data-fov]').forEach((button) => button.classList.toggle('selected', Number(button.dataset.fov) === fov));
}
fovSlider.addEventListener('input', () => setFov(fovSlider.value));
document.querySelectorAll('[data-fov]').forEach((button) => button.addEventListener('click', () => setFov(button.dataset.fov)));
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 1600);
}

function buildLevel(level) {
  scene.remove(levelGroup);
  levelGroup.traverse((object) => { if (object.geometry) object.geometry.dispose(); });
  levelGroup = new THREE.Group();
  scene.add(levelGroup);
  monsters.forEach((monster) => monster.destroy(scene));
  monsters = [];
  lavaTiles = [];
  mazeData = generateMaze(level);
  const { grid, size, goalPos, lavaCells, monsterSpawns } = mazeData;
  $('level-num').textContent = String(level);
  $('maze-size').textContent = size + '×' + size;
  $('hazard-status').textContent = level <= 3 ? 'NONE' : level <= 5 ? 'PULSING LAVA' : 'LAVA + ' + monsterSpawns.length + ' MONSTER(S)';
  $('hazard-status').style.color = level > 5 ? '#ff7184' : '#8eeaff';

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size * CELL_SIZE, size * CELL_SIZE), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((size - 1) * CELL_SIZE / 2, 0, (size - 1) * CELL_SIZE / 2);
  floor.receiveShadow = true;
  levelGroup.add(floor);
  const wallGeometry = new THREE.BoxGeometry(CELL_SIZE, 2.2, CELL_SIZE);
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (grid[r][c] !== 1) continue;
    const wall = new THREE.Mesh(wallGeometry, wallMat);
    wall.position.set(c * CELL_SIZE, 1.1, r * CELL_SIZE);
    wall.castShadow = true;
    wall.receiveShadow = true;
    levelGroup.add(wall);
  }
  goalMesh = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.13, 12, 32), goalMat);
  goalMesh.position.set(goalPos.c * CELL_SIZE, 1, goalPos.r * CELL_SIZE);
  goalMesh.rotation.x = Math.PI / 2;
  levelGroup.add(goalMesh);
  const lavaGeometry = new THREE.BoxGeometry(CELL_SIZE * 0.92, 0.12, CELL_SIZE * 0.92);
  lavaCells.forEach(({ r, c }, index) => {
    const mesh = new THREE.Mesh(lavaGeometry, lavaMat);
    mesh.position.set(c * CELL_SIZE, 0.06, r * CELL_SIZE);
    levelGroup.add(mesh);
    lavaTiles.push({ r, c, mesh, phaseOffset: index * 1.1, isHot: true });
  });
  monsterSpawns.forEach(({ r, c }) => monsters.push(new Monster(scene, r, c, level)));
  player.resetPosition();
  yaw = 0;
  pitch = 0.78;
  cameraDistance = Math.max(10, Math.min(19, size * 0.72));
}

function showBanner(title, subtitle, danger = false, callback = () => {}) {
  isPaused = true;
  $('banner-title').textContent = title;
  $('banner-sub').textContent = subtitle;
  $('banner').classList.toggle('danger', danger);
  $('banner').classList.remove('hidden');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    $('banner').classList.add('hidden');
    callback();
    isPaused = false;
    $('pause-btn').textContent = 'Ⅱ PAUSE';
  }, 1450);
}
function togglePause() {
  if (!$('banner').classList.contains('hidden')) return;
  isPaused = !isPaused;
  $('pause-btn').textContent = isPaused ? '▶ RESUME' : 'Ⅱ PAUSE';
  toast(isPaused ? 'GAME PAUSED' : 'GAME RESUMED');
}
$('pause-btn').addEventListener('click', togglePause);
$('restart-btn').addEventListener('click', () => {
  clearTimeout(bannerTimer);
  $('banner').classList.add('hidden');
  isPaused = false;
  currentLevel = 1;
  buildLevel(currentLevel);
  $('pause-btn').textContent = 'Ⅱ PAUSE';
  toast('MAZE RESTARTED');
});
window.addEventListener('keydown', (event) => { if (event.code === 'Escape' || event.code === 'KeyP') togglePause(); });

const canvas = renderer.domElement;
const activePointers = new Map();
let pinchStartDistance = 0;
let pinchStartZoom = cameraDistance;
const pointerDistance = () => {
  const points = [...activePointers.values()];
  return points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
};
canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  canvas.setPointerCapture(event.pointerId);
  if (activePointers.size >= 2) {
    dragging = false;
    pinchStartDistance = pointerDistance();
    pinchStartZoom = cameraDistance;
  } else {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  }
});
canvas.addEventListener('pointermove', (event) => {
  if (!activePointers.has(event.pointerId)) return;
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (activePointers.size >= 2) {
    const distance = pointerDistance();
    if (pinchStartDistance > 0 && distance > 0) {
      cameraDistance = THREE.MathUtils.clamp(pinchStartZoom * pinchStartDistance / distance, 6, 30);
    }
    return;
  }
  if (!dragging) return;
  const dx = event.clientX - lastX, dy = event.clientY - lastY;
  lastX = event.clientX; lastY = event.clientY;
  const speed = Number(sensitivity.value);
  yaw -= dx * speed;
  pitch = THREE.MathUtils.clamp(pitch + dy * speed, 0.22, 1.42);
});
function stopDrag(event) {
  activePointers.delete(event.pointerId);
  dragging = false;
  if (activePointers.size === 1) {
    const remaining = [...activePointers.values()][0];
    lastX = remaining.x;
    lastY = remaining.y;
    pinchStartDistance = 0;
  }
}
canvas.addEventListener('pointerup', stopDrag);
canvas.addEventListener('pointercancel', stopDrag);
canvas.addEventListener('lostpointercapture', stopDrag);
canvas.addEventListener('wheel', (event) => {
  cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.012, 6, 30);
  event.preventDefault();
}, { passive: false });

document.querySelectorAll('.d-btn').forEach((button) => {
  const code = button.dataset.key;
  const release = (event) => { event.preventDefault(); player.keys[code] = false; };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault(); player.keys[code] = true; button.setPointerCapture(event.pointerId);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => button.addEventListener(type, release));
});
window.addEventListener('blur', () => { player.keys = {}; dragging = false; });
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, ({low:0.85,medium:1.25,high:1.75}[graphicsSelect.value] || 1.25)));
  renderer.setSize(innerWidth, innerHeight);
});

buildLevel(currentLevel);
setFov(60);
applyGraphics('medium');
let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.08);
  lastTime = now;
  lavaTiles.forEach((tile) => {
    const cycle = Math.sin(now * 0.0025 + tile.phaseOffset);
    tile.isHot = cycle > -0.35;
    tile.mesh.material.color.setHex(tile.isHot ? 0xff4500 : 0x3f3f46);
    tile.mesh.material.emissive.setHex(tile.isHot ? 0xff2200 : 0x000000);
    tile.mesh.material.emissiveIntensity = tile.isHot ? 0.8 + cycle * 0.3 : 0;
  });
  if (goalMesh) { goalMesh.rotation.z += dt * 0.65; goalMesh.rotation.y += dt * 0.25; }
  if (!isPaused) {
    const status = player.update(dt, mazeData.grid, lavaTiles);
    if (status === 'GOAL') {
      currentLevel++;
      showBanner('LEVEL ' + (currentLevel - 1) + ' CLEARED', 'Entering level ' + currentLevel, false, () => buildLevel(currentLevel));
    } else if (status === 'LAVA_HIT') {
      showBanner('LAVA CONTACT', 'Wait for the glowing tile to cool down.', true, () => player.resetPosition());
    }
    for (const monster of monsters) {
      if (monster.update(dt, mazeData.grid, player.mesh.position) && !isPaused) {
        showBanner('YOU WERE CAUGHT', 'Returning to the level start.', true, () => player.resetPosition());
        break;
      }
    }
  }
  const horizontal = Math.cos(pitch) * cameraDistance;
  const vertical = Math.sin(pitch) * cameraDistance;
  const desired = new THREE.Vector3(
    player.mesh.position.x + Math.sin(yaw) * horizontal,
    player.mesh.position.y + vertical,
    player.mesh.position.z + Math.cos(yaw) * horizontal
  );
  camera.position.lerp(desired, 0.13);
  camera.lookAt(player.mesh.position.x, player.mesh.position.y + 0.72, player.mesh.position.z);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

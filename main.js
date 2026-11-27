import * as THREE from 'three';
import { generateMaze } from './maze.js';
import { Player, Monster, CELL_SIZE } from './entities.js';

const container = document.getElementById('game-container');
const levelNumEl = document.getElementById('level-num');
const mazeSizeEl = document.getElementById('maze-size');
const hazardStatusEl = document.getElementById('hazard-status');
const bannerEl = document.getElementById('banner');
const bannerTitleEl = document.getElementById('banner-title');
const bannerSubEl = document.getElementById('banner-sub');

// Scene, Camera & Renderer Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0c10);
scene.fog = new THREE.FogExp2(0x0b0c10, 0.035);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// Ambient & Directional Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(15, 30, 15);
dirLight.castShadow = true;
scene.add(dirLight);

// Game State
let currentLevel = 1;
let mazeData = null;
let levelGroup = new THREE.Group();
scene.add(levelGroup);

let lavaTiles = [];
let monsters = [];
let goalMesh = null;
let isPaused = false;

const player = new Player(scene);

// Shared Materials
const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
const goalMat = new THREE.MeshStandardMaterial({
  color: 0x22c55e,
  emissive: 0x16a34a,
  emissiveIntensity: 0.8
});

function buildLevel(level) {
  // Clear previous level objects
  scene.remove(levelGroup);
  levelGroup = new THREE.Group();
  scene.add(levelGroup);

  monsters.forEach((m) => m.destroy(scene));
  monsters = [];
  lavaTiles = [];

  mazeData = generateMaze(level);
  const { grid, size, goalPos, lavaCells, monsterSpawns } = mazeData;

  // Update HUD
  levelNumEl.textContent = level;
  mazeSizeEl.textContent = `${size}x${size}`;
  if (level <= 3) {
    hazardStatusEl.textContent = 'None';
    hazardStatusEl.style.color = '#38bdf8';
  } else if (level <= 5) {
    hazardStatusEl.textContent = 'Pulsing Lava (Wait for cool down!)';
    hazardStatusEl.style.color = '#fb923c';
  } else {
    hazardStatusEl.textContent = `Lava + ${monsterSpawns.length} Hunting Monster(s)`;
    hazardStatusEl.style.color = '#ef4444';
  }

  // Build Floor Base
  const floorGeo = new THREE.PlaneGeometry(size * CELL_SIZE, size * CELL_SIZE);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(((size - 1) * CELL_SIZE) / 2, 0, ((size - 1) * CELL_SIZE) / 2);
  floorMesh.receiveShadow = true;
  levelGroup.add(floorMesh);

  // Build Maze Walls
  const wallGeo = new THREE.BoxGeometry(CELL_SIZE, 2.2, CELL_SIZE);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === 1) {
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(c * CELL_SIZE, 1.1, r * CELL_SIZE);
        wall.castShadow = true;
        wall.receiveShadow = true;
        levelGroup.add(wall);
      }
    }
  }

  // Build Goal Portal
  const goalGeo = new THREE.CylinderGeometry(0.65, 0.65, 1.8, 24);
  goalMesh = new THREE.Mesh(goalGeo, goalMat);
  goalMesh.position.set(goalPos.c * CELL_SIZE, 0.9, goalPos.r * CELL_SIZE);
  levelGroup.add(goalMesh);

  // Build Lava Traps (Unlocked after Level 3)
  const lavaGeo = new THREE.BoxGeometry(CELL_SIZE * 0.92, 0.12, CELL_SIZE * 0.92);
  lavaCells.forEach(({ r, c }, idx) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff4500,
      emissive: 0xff2200,
      emissiveIntensity: 0.9
    });
    const mesh = new THREE.Mesh(lavaGeo, mat);
    mesh.position.set(c * CELL_SIZE, 0.06, r * CELL_SIZE);
    levelGroup.add(mesh);

    // Offset phases so lava tiles pulse open/closed so the player can cross
    lavaTiles.push({
      r,
      c,
      mesh,
      phaseOffset: idx * 1.1,
      isHot: true
    });
  });

  // Spawn Patrol Monsters (Unlocked after Level 5)
  monsterSpawns.forEach(({ r, c }) => {
    monsters.push(new Monster(scene, r, c, level));
  });

  player.resetPosition();
}

function showBanner(title, subtitle, isDanger = false, callback) {
  isPaused = true;
  bannerTitleEl.textContent = title;
  bannerSubEl.textContent = subtitle;
  bannerEl.classList.toggle('danger', isDanger);
  bannerEl.classList.remove('hidden');

  setTimeout(() => {
    bannerEl.classList.add('hidden');
    callback();
    isPaused = false;
  }, 1500);
}

// Handle Window Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start Game at Level 1
buildLevel(currentLevel);

let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // Pulse Lava Tiles (Hot vs Safe Cooled Crust)
  lavaTiles.forEach((tile) => {
    const cycle = Math.sin(now * 0.0025 + tile.phaseOffset);
    // Lava cools down briefly when cycle drops below -0.35 so no path is ever permanently blocked
    tile.isHot = cycle > -0.35;
    if (tile.isHot) {
      tile.mesh.material.color.setHex(0xff4500);
      tile.mesh.material.emissive.setHex(0xff2200);
      tile.mesh.material.emissiveIntensity = 0.8 + cycle * 0.3;
    } else {
      tile.mesh.material.color.setHex(0x3f3f46);
      tile.mesh.material.emissive.setHex(0x000000);
    }
  });

  if (goalMesh) {
    goalMesh.rotation.y += dt * 2;
  }

  if (!isPaused) {
    const status = player.update(dt, mazeData.grid, lavaTiles);

    if (status === 'GOAL') {
      currentLevel++;
      showBanner(
        `Level ${currentLevel - 1} Cleared!`,
        currentLevel === 4
          ? 'Warning: Lava traps unlocked!'
          : currentLevel === 6
          ? 'Danger: Monsters have entered the maze!'
          : `Advancing to Level ${currentLevel}...`,
        false,
        () => buildLevel(currentLevel)
      );
    } else if (status === 'LAVA_HIT') {
      showBanner('Burned by Lava!', 'Cross when the lava cools dark grey.', true, () =>
        player.resetPosition()
      );
    }

    // Update Monsters
    for (const monster of monsters) {
      const caught = monster.update(dt, mazeData.grid, player.mesh.position);
      if (caught && !isPaused) {
        showBanner('Caught by a Monster!', 'Respawning at level start...', true, () =>
          player.resetPosition()
        );
        break;
      }
    }
  }

  // Smooth top-down angled follow camera
  const targetCamX = player.mesh.position.x;
  const targetCamZ = player.mesh.position.z + 9;
  camera.position.x += (targetCamX - camera.position.x) * 0.1;
  camera.position.z += (targetCamZ - camera.position.z) * 0.1;
  camera.position.y = 13;
  camera.lookAt(player.mesh.position.x, 0, player.mesh.position.z);

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
// --- 1. GLOBAL MAZE GRID ---
window.mazeGrid = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 3, 1],
  [1, 1, 1, 1, 1, 1, 1]
];

// --- 2. BULLETPROOF COLLISION LOGIC ---
AFRAME.registerComponent('player-collider', {
  init: function() {
    this.lastSafePosition = new THREE.Vector3();
    this.lastSafePosition.copy(this.el.object3D.position);
  },
  
  tick: function () {
    // Because this is on the camera, pos is your EXACT absolute location
    let pos = this.el.object3D.position;

    // Convert coordinates to grid row and column
    let col = Math.round(pos.x / 3);
    let row = Math.round(pos.z / 3);

    // Make sure we are inside the map limits
    if (window.mazeGrid[row] !== undefined) {
      let currentTile = window.mazeGrid[row][col];

      if (currentTile === 1) {
        // WALL HIT! We snap your X and Z back to the safe spot.
        // We leave Y alone so you don't fall out of the sky in top-down mode.
        pos.x = this.lastSafePosition.x;
        pos.z = this.lastSafePosition.z;
      } 
      else if (currentTile === 3) {
        // YOU WIN!
        alert("You Escaped the Maze!");
        pos.set(3, 1.6, 3); // Teleport back to start
        this.lastSafePosition.copy(pos);
        if (window.resetToFirstPerson) window.resetToFirstPerson();
      } 
      else {
        // Safe empty path. Remember this exact coordinate.
        this.lastSafePosition.x = pos.x;
        this.lastSafePosition.z = pos.z;
      }
    } else {
      // Prevent walking entirely off the edge of the world
      pos.x = this.lastSafePosition.x;
      pos.z = this.lastSafePosition.z;
    }
  }
});

// --- 3. MAZE BUILDER LOGIC ---
AFRAME.registerComponent('maze-builder', {
  init: function () {
    const sceneEl = this.el; 
    const blockSize = 3;     

    for (let row = 0; row < window.mazeGrid.length; row++) {
      for (let col = 0; col < window.mazeGrid[row].length; col++) {
        
        let tile = window.mazeGrid[row][col];
        let posX = col * blockSize;
        let posY = 1.5; 
        let posZ = row * blockSize;

        if (tile === 1) {
          let wall = document.createElement('a-box');
          wall.setAttribute('position', `${posX} ${posY} ${posZ}`);
          wall.setAttribute('width', blockSize);
          wall.setAttribute('height', '3'); 
          wall.setAttribute('depth', blockSize);
          wall.setAttribute('color', '#4CC3D9');
          sceneEl.appendChild(wall);
        } 
        else if (tile === 3) {
          let exit = document.createElement('a-box');
          exit.setAttribute('position', `${posX} ${posY} ${posZ}`);
          exit.setAttribute('width', blockSize);
          exit.setAttribute('height', '3');
          exit.setAttribute('depth', blockSize);
          exit.setAttribute('color', '#7BC8A4');
          exit.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 3000');
          sceneEl.appendChild(exit);
        }
      }
    }
  }
});

// --- 4. TOP-DOWN CAMERA TOGGLE (Press V) ---
window.addEventListener('load', () => {
  const player = document.getElementById('player');
  const playerBody = document.getElementById('player-body');
  let isFirstPerson = true;

  // Helper function to reset view when you win
  window.resetToFirstPerson = function() {
    isFirstPerson = true;
    player.object3D.position.y = 1.6;
    playerBody.setAttribute('visible', 'false');
  };

  window.addEventListener('keydown', (event) => {
    if (event.key === 'v' || event.key === 'V') {
      isFirstPerson = !isFirstPerson; 

      if (isFirstPerson) {
        // Return to 1st person (Height 1.6m, body hidden)
        player.object3D.position.y = 1.6;
        playerBody.setAttribute('visible', 'false');
      } else {
        // TOP-DOWN MODE: Float the camera up 8 meters into the air!
        player.object3D.position.y = 8;
        
        // Make body visible, push it 7.5 meters down (to touch the floor) 
        // and 2 meters forward so it sits perfectly in your camera's view
        playerBody.setAttribute('visible', 'true');
        playerBody.setAttribute('position', '0 -7.5 -2');
      }
    }
  });
});
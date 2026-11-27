# 3D Dungeon Maze

A browser-based 3D maze survival game built with JavaScript and Three.js.

## Features
- Procedurally generated maze levels with lava and monsters.
- Three graphics presets: Low, Medium and High.
- Moving, textured lava with animated heat cycles.
- A detailed player character with walking, turning and jumping animations.
- Collectible hearts. Hearts are earned only by collecting them; taking damage consumes one.
- Checkpoints save your respawn location. Respawning never grants free hearts.
- Mobile landscape layout with an on-screen analog joystick and jump control.
- Draggable settings button, adjustable FOV, camera drag and zoom.
- Pause and restart controls.

## Controls
| Action | Desktop | Mobile |
|---|---|---|
| Move | WASD / Arrow keys | On-screen joystick |
| Jump | Space | JUMP button |
| Look | Drag mouse | Drag screen |
| Zoom | Mouse wheel | Pinch |
| Settings | Draggable Settings button | Draggable Settings button |

On phones, rotate to landscape. The game requests fullscreen and landscape orientation where the browser supports it.

## Run locally
Run through a local web server because the game uses ES modules:

    python -m http.server 8000

Then open http://localhost:8000.

## Technologies
- HTML, CSS, JavaScript ES modules
- Three.js

Made by **Bilal Khan**.

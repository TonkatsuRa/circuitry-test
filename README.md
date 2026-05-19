# CIRCUIT::GRID

An interactive 3D cyberpunk motherboard. Click any component — RAM, GPU, SSD, or
BIOS — and watch the cyan data trace flow from the central CPU out to that chip,
then open a diagnostic readout.

Built with [Three.js](https://threejs.org/) via ES module imports (no build step).

## Running

> **You cannot just double-click `index.html`.** Modern browsers block ES module
> loading from `file://` URLs for security. The page will appear stuck on the
> boot screen — it now shows a clear error explaining this. Use one of the
> options below.

### Option A — GitHub Pages (recommended)

1. Push this folder to a repo.
2. Repo → **Settings** → **Pages** → deploy from the `main` branch root.
3. Open the URL GitHub gives you. Done.

### Option B — Local HTTP server

From inside the `circuit-grid/` folder, pick any of these:

```bash
# Python 3 (built into macOS and most Linux distros)
python3 -m http.server 8000

# Node (no install needed if you have npx)
npx serve .

# PHP
php -S localhost:8000
```

Then open <http://localhost:8000> in your browser.

## File layout

```
index.html        — shell, HUD overlay, popup markup, boot screen
styles.css        — cyberpunk styling, scanlines, popup
js/
  lib/three.js    — Three.js re-export (change CDN/version here)
  config.js       — ★ all chips, paths, popup data (edit me)
  scene.js        — renderer, isometric camera, lights, PCB
  components.js   — CPU + chip mesh builders (visual types)
  paths.js        — trace builder + glow shader
  ui.js           — raycaster, popup, HUD clock
  main.js         — wires everything together
```

## Adding a new component

Open `js/config.js` and append a new entry to `COMPONENTS`:

```js
{
  id: 'nic',
  label: 'NET_INTERFACE',
  type: 'gpu',                       // reuse an existing visual type, or...
  position: { x: 0, z: -9 },         // anywhere on the PCB
  size: { w: 3, h: 0.8, d: 1.5 },
  path: [                            // waypoints from CPU edge to chip
    { x: 0, z: -2 },
    { x: 1, z: -4 },
    { x: 0, z: -6 },
    { x: 0, z: -8 },
  ],
  popup: {
    id:       'NODE-NIC-0x10',
    title:    'NETWORK INTERFACE',
    subtitle: 'TCP.STACK.OK',
    lines: [
      { k: 'SPEED', v: '10 Gbps', status: 'ok' },
      { k: 'IPv6',  v: 'ENABLED', status: 'ok' },
    ],
  },
},
```

That's it — the scene auto-builds the mesh, trace, and click handler.

### Adding a brand-new visual type

If you want a chip that doesn't look like RAM/GPU/SSD/BIOS, add a builder
function in `js/components.js` and register it in the `buildChip()` switch.

## Console hooks

For tinkering, the dev hook on `window.__circuit` gives you live access:

```js
__circuit.selectChip('ssd');   // programmatically trigger a chip
__circuit.clear();             // reset everything
__circuit.scene;               // the THREE.Scene
```

## Tweaks worth knowing

In `js/config.js` → `SCENE_CONFIG`:

| key | what it does |
|---|---|
| `fillDuration`        | seconds for the cyan glow to travel CPU→chip |
| `cameraZoom`          | bigger = more zoomed out |
| `traceWidth` / `traceHeight` | trace dimensions |
| `enableAmbientPulse`  | soft pulse on unlit traces |
| `popupDelay`          | beat between fill complete and popup open |

In `styles.css` → `:root`:
The `--c-cyan`, `--c-magenta` etc. CSS variables drive the entire UI palette.
Change them once at the top and every element follows.

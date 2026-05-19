/**
 * CIRCUIT::GRID — entry point.
 * Orchestrates the scene, components, paths, and UI.
 */

import * as THREE from './lib/three.js';
import { COMPONENTS } from './config.js';
import { createScene } from './scene.js';
import { buildCPU, buildChip } from './components.js';
import { TracePath } from './paths.js';
import { buildAmbientCircuitry } from './circuitry.js';
import {
  InteractionController, PopupController, startHUDClock
} from './ui.js';

const mount = document.getElementById('scene-root');
const { renderer, scene, camera } = createScene(mount);

/* ─── BUILD CPU ───────────────────────────────────────── */
const cpu = buildCPU();
scene.add(cpu);

/* ─── AMBIENT CIRCUITRY ───────────────────────────────── */
// Decorative dense PCB detail underneath the interactive main paths.
const ambient = buildAmbientCircuitry();
scene.add(ambient);

/* ─── BUILD CHIPS + PATHS ─────────────────────────────── */
const chipMeshes     = {};
const paths          = {};
const componentsById = {};

for (const comp of COMPONENTS) {
  // Chip mesh
  const chip = buildChip(comp);
  scene.add(chip);
  chipMeshes[comp.id]     = chip;
  componentsById[comp.id] = comp;

  // Trace path
  const path = new TracePath(comp);
  scene.add(path.mesh);
  paths[comp.id] = path;
}

/* ─── UI WIRING ───────────────────────────────────────── */
const popup = new PopupController(componentsById);
const interaction = new InteractionController({
  scene, camera, renderer,
  chipMeshes, paths,
  onChipSelected: (id) => popup.show(id),
});
popup.onClose = () => interaction.clear();

startHUDClock();

/* ─── CPU CORE BREATHING ──────────────────────────────── */
const coreMats = cpu.userData.coreMaterials;
const coreBaseColor = new THREE.Color(0xff2bd2);

/* ─── RENDER LOOP ─────────────────────────────────────── */
let lastT = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt  = (now - lastT) / 1000;
  lastT = now;

  // Pulse the CPU core
  const breath = 0.7 + 0.3 * Math.sin(now * 0.002);
  coreMats.forEach(m => {
    m.color.copy(coreBaseColor).multiplyScalar(breath);
  });

  // Update all path animations + ambient pulse
  Object.values(paths).forEach(p => p.update(now));

  renderer.render(scene, camera);
}
animate();

/* ─── HIDE BOOT SCREEN AFTER A BEAT ──────────────────── */
window.__circuitBooted = true;
setTimeout(() => {
  const boot = document.getElementById('boot');
  if (!boot || boot.classList.contains('boot-error')) return;
  boot.classList.add('fade');
  setTimeout(() => boot.remove(), 700);
}, 1500);

/* ─── DEV HOOK ─────────────────────────────────────────
   Exposed for debugging / future expansion. Open the console
   and call e.g. `__circuit.selectChip('gpu')`
   ────────────────────────────────────────────────────── */
window.__circuit = {
  scene, camera, renderer,
  chipMeshes, paths, cpu,
  selectChip: (id) => interaction.selectChip(id),
  clear:      ()   => { popup.hide(); interaction.clear(); },
};

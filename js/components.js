/**
 * Component meshes: central CPU + four corner chip types.
 * Each builder returns a THREE.Group with .userData.componentId set
 * so the raycaster can identify clicks.
 *
 * Adding a new visual type? Add a new case in `buildChip()`.
 */

import * as THREE from './lib/three.js';
import { PALETTE } from './config.js';

/* ─── CENTRAL CPU ────────────────────────────────────── */
export function buildCPU() {
  const g = new THREE.Group();
  g.userData.componentId = 'cpu';
  g.userData.coreMaterials = [];

  // Heat-spreader base (square 4x4)
  const baseGeo = new THREE.BoxGeometry(4, 0.4, 4);
  const baseMat = new THREE.MeshStandardMaterial({
    color: PALETTE.cpuBody, roughness: 0.4, metalness: 0.8,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.2;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  // Raised inner plate
  const plateGeo = new THREE.BoxGeometry(3.2, 0.18, 3.2);
  const plateMat = new THREE.MeshStandardMaterial({
    color: PALETTE.cpuPlate, roughness: 0.25, metalness: 0.95,
  });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.y = 0.49;
  plate.castShadow = true;
  g.add(plate);

  // Etched cross channel on plate (creates the classic CPU "X" partition)
  const channelMat = new THREE.MeshBasicMaterial({ color: PALETTE.chipDark });
  const ch1 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.02, 0.12), channelMat);
  ch1.position.set(0, 0.59, 0);
  g.add(ch1);
  const ch2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 3.2), channelMat);
  ch2.position.set(0, 0.59, 0);
  g.add(ch2);

  // Recessed center core (magenta glow — animated)
  const coreGeo = new THREE.BoxGeometry(0.9, 0.04, 0.9);
  const coreMat = new THREE.MeshBasicMaterial({
    color: PALETTE.cpuCore, toneMapped: false,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = 0.60;
  g.add(core);
  g.userData.coreMaterials.push(coreMat);

  // Four corner-notch indicators (small cyan dots)
  const notchGeo = new THREE.BoxGeometry(0.18, 0.03, 0.18);
  const notchMat = new THREE.MeshBasicMaterial({
    color: PALETTE.traceLit, toneMapped: false,
  });
  [[-1.3, -1.3], [1.3, -1.3], [1.3, 1.3], [-1.3, 1.3]].forEach(([x, z]) => {
    const n = new THREE.Mesh(notchGeo, notchMat);
    n.position.set(x, 0.60, z);
    g.add(n);
  });

  // Label text bars (small magenta line - decorative)
  const labelGeo = new THREE.BoxGeometry(1.6, 0.025, 0.1);
  const labelMat = new THREE.MeshBasicMaterial({
    color: PALETTE.cpuCore, toneMapped: false, transparent: true, opacity: 0.7,
  });
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.set(0, 0.60, 1.0);
  g.add(label);

  // Underside contact ring — thin metallic strip peeking out from beneath
  // the heat spreader. Adds visible "chip" detail without obscuring the top.
  const ringGeo = new THREE.BoxGeometry(4.2, 0.06, 4.2);
  const ringMat = new THREE.MeshStandardMaterial({
    color: PALETTE.goldPin, metalness: 0.9, roughness: 0.3,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.03;
  g.add(ring);

  return g;
}

/* ─── DISPATCH FOR CHIP TYPES ────────────────────────── */
export function buildChip(component) {
  let mesh;
  switch (component.type) {
    case 'ram':  mesh = buildRAM(component);  break;
    case 'gpu':  mesh = buildGPU(component);  break;
    case 'ssd':  mesh = buildSSD(component);  break;
    case 'bios': mesh = buildBIOS(component); break;
    default:     mesh = buildGenericChip(component);
  }
  mesh.position.set(component.position.x, 0, component.position.z);
  mesh.userData.componentId = component.id;
  mesh.userData.litMaterials = mesh.userData.litMaterials || [];
  return mesh;
}

/* ─── RAM MODULE ─────────────────────────────────────── */
function buildRAM({ size }) {
  const g = new THREE.Group();
  // PCB stick base
  const pcbGeo = new THREE.BoxGeometry(size.w, 0.15, size.d);
  const pcbMat = new THREE.MeshStandardMaterial({
    color: PALETTE.chipMid, roughness: 0.7, metalness: 0.3,
  });
  const pcb = new THREE.Mesh(pcbGeo, pcbMat);
  pcb.position.y = 0.075;
  pcb.castShadow = true;
  pcb.receiveShadow = true;
  g.add(pcb);

  // Row of memory chips on top
  const chipGeo = new THREE.BoxGeometry(0.55, 0.25, 0.8);
  const chipMat = new THREE.MeshStandardMaterial({
    color: PALETTE.chipDark, roughness: 0.4, metalness: 0.6,
  });
  const count = 6;
  const span = size.w - 0.8;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = -span / 2 + t * span;
    const c = new THREE.Mesh(chipGeo, chipMat);
    c.position.set(x, 0.275, 0);
    c.castShadow = true;
    g.add(c);
  }

  // Tiny status LED — lights up on activation
  const led = makeLED();
  led.mesh.position.set(size.w / 2 - 0.4, 0.2, size.d / 2 - 0.15);
  g.add(led.mesh);
  g.userData.litMaterials = [led.material];

  // Gold contact strip along the bottom
  const stripGeo = new THREE.BoxGeometry(size.w - 0.4, 0.04, 0.18);
  const stripMat = new THREE.MeshStandardMaterial({
    color: PALETTE.goldPin, metalness: 0.9, roughness: 0.2,
  });
  const strip = new THREE.Mesh(stripGeo, stripMat);
  strip.position.set(0, 0.05, -size.d / 2 + 0.1);
  g.add(strip);

  // Hover/click hit box — invisible, ensures the whole component is clickable
  g.userData.hitMesh = addHitMesh(g, size);
  return g;
}

/* ─── GPU (large board, multiple chips) ──────────────── */
function buildGPU({ size }) {
  const g = new THREE.Group();
  // Main board
  const boardGeo = new THREE.BoxGeometry(size.w, 0.18, size.d);
  const boardMat = new THREE.MeshStandardMaterial({
    color: PALETTE.chipMid, roughness: 0.6, metalness: 0.4,
  });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.y = 0.09;
  board.castShadow = true;
  board.receiveShadow = true;
  g.add(board);

  // Big central GPU die
  const dieGeo = new THREE.BoxGeometry(size.w * 0.45, 0.35, size.d * 0.55);
  const dieMat = new THREE.MeshStandardMaterial({
    color: PALETTE.chipDark, roughness: 0.3, metalness: 0.7,
  });
  const die = new THREE.Mesh(dieGeo, dieMat);
  die.position.y = 0.355;
  die.castShadow = true;
  g.add(die);

  // Silicon detail on the die (small inset square)
  const sil = new THREE.Mesh(
    new THREE.BoxGeometry(size.w * 0.32, 0.02, size.d * 0.4),
    new THREE.MeshStandardMaterial({
      color: PALETTE.silicon, roughness: 0.2, metalness: 0.9,
    })
  );
  sil.position.y = 0.54;
  g.add(sil);

  // Surrounding VRAM chips
  const vramGeo = new THREE.BoxGeometry(0.55, 0.22, 0.55);
  const vramMat = new THREE.MeshStandardMaterial({
    color: PALETTE.chipDark, roughness: 0.5, metalness: 0.5,
  });
  const vramPositions = [
    [-size.w / 2 + 0.5,  size.d / 2 - 0.5],
    [-size.w / 2 + 0.5, -size.d / 2 + 0.5],
    [ size.w / 2 - 0.5,  size.d / 2 - 0.5],
    [ size.w / 2 - 0.5, -size.d / 2 + 0.5],
    [-size.w / 2 + 0.5,  0],
    [ size.w / 2 - 0.5,  0],
  ];
  vramPositions.forEach(([x, z]) => {
    const v = new THREE.Mesh(vramGeo, vramMat);
    v.position.set(x, 0.26, z);
    v.castShadow = true;
    g.add(v);
  });

  // Status LED
  const led = makeLED();
  led.mesh.position.set(size.w / 2 - 0.3, 0.2, -size.d / 2 + 0.3);
  g.add(led.mesh);
  g.userData.litMaterials = [led.material];

  g.userData.hitMesh = addHitMesh(g, size);
  return g;
}

/* ─── SSD (NAND chip grid) ───────────────────────────── */
function buildSSD({ size }) {
  const g = new THREE.Group();
  const boardGeo = new THREE.BoxGeometry(size.w, 0.12, size.d);
  const boardMat = new THREE.MeshStandardMaterial({
    color: PALETTE.chipMid, roughness: 0.7, metalness: 0.3,
  });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.y = 0.06;
  board.castShadow = true;
  board.receiveShadow = true;
  g.add(board);

  // 3x2 NAND chip grid
  const nandGeo = new THREE.BoxGeometry(0.9, 0.2, 0.7);
  const nandMat = new THREE.MeshStandardMaterial({
    color: PALETTE.chipDark, roughness: 0.4, metalness: 0.6,
  });
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const x = -size.w / 2 + 0.7 + i * 1.3;
      const z = -size.d / 2 + 0.55 + j * 1.1;
      const n = new THREE.Mesh(nandGeo, nandMat);
      n.position.set(x, 0.22, z);
      n.castShadow = true;
      g.add(n);
    }
  }

  // Controller chip (slightly different)
  const ctrlGeo = new THREE.BoxGeometry(0.5, 0.25, 0.5);
  const ctrl = new THREE.Mesh(ctrlGeo, new THREE.MeshStandardMaterial({
    color: PALETTE.silicon, roughness: 0.3, metalness: 0.8,
  }));
  ctrl.position.set(size.w / 2 - 0.45, 0.245, size.d / 2 - 0.35);
  ctrl.castShadow = true;
  g.add(ctrl);

  // Status LED
  const led = makeLED();
  led.mesh.position.set(-size.w / 2 + 0.3, 0.14, -size.d / 2 + 0.3);
  g.add(led.mesh);
  g.userData.litMaterials = [led.material];

  g.userData.hitMesh = addHitMesh(g, size);
  return g;
}

/* ─── BIOS (small chip with single recess) ───────────── */
function buildBIOS({ size }) {
  const g = new THREE.Group();
  const baseGeo = new THREE.BoxGeometry(size.w, 0.4, size.d);
  const baseMat = new THREE.MeshStandardMaterial({
    color: PALETTE.chipDark, roughness: 0.3, metalness: 0.7,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.2;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  // Recessed circle dot indicating pin 1
  const dotGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.03, 16);
  const dotMat = new THREE.MeshStandardMaterial({
    color: PALETTE.silicon, roughness: 0.4, metalness: 0.5,
  });
  const dot = new THREE.Mesh(dotGeo, dotMat);
  dot.position.set(-size.w / 2 + 0.3, 0.41, -size.d / 2 + 0.3);
  g.add(dot);

  // Etched lines on top (decorative)
  const etchMat = new THREE.MeshBasicMaterial({
    color: PALETTE.traceBase, transparent: true, opacity: 0.6,
  });
  for (let i = 0; i < 3; i++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(size.w * 0.7, 0.01, 0.04),
      etchMat
    );
    line.position.set(0, 0.41, -0.4 + i * 0.4);
    g.add(line);
  }

  // Status LED
  const led = makeLED();
  led.mesh.position.set(size.w / 2 - 0.25, 0.41, size.d / 2 - 0.25);
  g.add(led.mesh);
  g.userData.litMaterials = [led.material];

  g.userData.hitMesh = addHitMesh(g, size);
  return g;
}

/* ─── GENERIC FALLBACK ───────────────────────────────── */
function buildGenericChip({ size }) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(size.w, size.h, size.d),
    new THREE.MeshStandardMaterial({
      color: PALETTE.chipMid, roughness: 0.5, metalness: 0.5,
    })
  );
  m.position.y = size.h / 2;
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  const led = makeLED();
  led.mesh.position.set(size.w / 2 - 0.3, size.h, size.d / 2 - 0.3);
  g.add(led.mesh);
  g.userData.litMaterials = [led.material];
  g.userData.hitMesh = addHitMesh(g, size);
  return g;
}

/* ─── HELPER: LED ────────────────────────────────────── */
function makeLED() {
  const mat = new THREE.MeshBasicMaterial({
    color: PALETTE.traceBase, toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), mat);
  return { mesh, material: mat };
}

/* ─── HELPER: invisible hitbox covering the whole chip ─ */
function addHitMesh(group, size) {
  // Bigger than component itself so it's easy to tap on mobile
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(size.w + 0.6, size.h + 1.5, size.d + 0.6),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = (size.h + 1.5) / 2;
  hit.userData.isHitMesh = true;
  group.add(hit);
  return hit;
}

/**
 * Ambient PCB circuitry — decorative traces that don't animate.
 *
 * Generates a dense web of dim traces around the four main paths so the board
 * looks like real cyberpunk PCB art rather than four lonely wires. The output
 * is one THREE.Group that can be dropped into the scene; nothing here is
 * interactive.
 *
 * Layers (all deterministic — seeded RNG, same layout every load):
 *   1. Parallel "bus" traces flanking each component's main path
 *   2. Perpendicular branch stubs spurring off main segments, capped with vias
 *   3. Isolated L-shaped trace fragments scattered across empty PCB area
 *   4. Small surface-mount component pads (resistors, caps, tiny chips)
 *   5. Glowing via dots at junctions and stub endpoints
 *
 * Performance: ~300 small meshes total, all sharing 3–4 materials. Fine on
 * modern mobile. If perf becomes an issue, the geometries here are all
 * trivially merge-able with BufferGeometry.merge or InstancedMesh.
 */

import * as THREE from './lib/three.js';
import { PALETTE, SCENE_CONFIG, COMPONENTS } from './config.js';

const SEED = 1337;          // change for a different but still deterministic layout
const TRACE_Y   = 0.018;    // ambient traces sit just above PCB surface
const VIA_Y     = 0.045;    // vias sit slightly higher
const TRACE_H   = 0.04;
const TRACE_W   = 0.09;
const THIN_W    = 0.07;

export function buildAmbientCircuitry() {
  const group = new THREE.Group();
  const rng = makeRng(SEED);

  // Shared materials — all opaque so render order is irrelevant
  const mats = {
    bright: new THREE.MeshBasicMaterial({ color: PALETTE.traceBase }),
    dim:    new THREE.MeshBasicMaterial({ color: PALETTE.traceDim  }),
    via:    new THREE.MeshBasicMaterial({ color: PALETTE.viaDim    }),
    smd:    new THREE.MeshStandardMaterial({
      color: PALETTE.chipDark, roughness: 0.4, metalness: 0.6,
    }),
    smdLight: new THREE.MeshStandardMaterial({
      color: PALETTE.chipMid, roughness: 0.5, metalness: 0.4,
    }),
  };

  // 1 — parallel bus traces
  for (const comp of COMPONENTS) {
    addBusTraces(group, comp.path, mats.bright);
  }

  // 2 — branch stubs with via caps
  for (const comp of COMPONENTS) {
    addBranchStubs(group, comp.path, mats.bright, mats.via, rng);
  }

  // 3 — isolated trace fragments
  addIsolatedTraces(group, mats.dim, mats.via, rng);

  // 4 — surface-mount components
  addSurfaceMountComps(group, mats.smd, mats.smdLight, rng);

  // 5 — extra vias at every main-path waypoint, makes corners feel intentional
  addMainPathVias(group, mats.via);

  return group;
}

/* ───────────────────────────────────────────────────────
   1 — BUS TRACES
   Two parallel ghosts on each side of every main path,
   skipping the first segment near the CPU so buses don't
   pile up around the chip socket.
   ─────────────────────────────────────────────────────── */
function addBusTraces(group, waypoints, mat) {
  const offsets = [-0.95, -0.5, 0.5, 0.95]; // 4 parallels = 5-wide bus with main

  for (const off of offsets) {
    for (let i = 1; i < waypoints.length - 1; i++) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.6) continue;

      // Perpendicular unit vector
      const nx = -dz / len, nz = dx / len;

      // Trim segment ends so corners read as gaps (looks intentional, not buggy)
      const trim = 0.18;
      const tA = trim / len;
      const tB = 1 - tA;
      const ax = a.x + dx * tA + nx * off;
      const az = a.z + dz * tA + nz * off;
      const bx = a.x + dx * tB + nx * off;
      const bz = a.z + dz * tB + nz * off;
      const segLen = Math.hypot(bx - ax, bz - az);
      if (segLen < 0.3) continue;

      const m = new THREE.Mesh(
        new THREE.BoxGeometry(segLen, TRACE_H, TRACE_W), mat
      );
      m.position.set((ax + bx) / 2, TRACE_Y, (az + bz) / 2);
      m.rotation.y = -Math.atan2(bz - az, bx - ax);
      group.add(m);
    }
  }
}

/* ───────────────────────────────────────────────────────
   2 — BRANCH STUBS
   Short perpendicular spurs sticking off main-path
   segments. Each ends in a glowing via dot.
   ─────────────────────────────────────────────────────── */
function addBranchStubs(group, waypoints, traceMat, viaMat, rng) {
  const pcbHalf = SCENE_CONFIG.pcbSize / 2 - 0.6;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1.4) continue;

    const numStubs = 1 + Math.floor(rng() * 2);
    for (let s = 0; s < numStubs; s++) {
      const t = 0.25 + rng() * 0.5;
      const px = a.x + dx * t, pz = a.z + dz * t;
      const nx = -dz / len, nz = dx / len;
      const side = rng() < 0.5 ? -1 : 1;
      const stubLen = 1.3 + rng() * 1.6;
      const ex = px + nx * side * stubLen;
      const ez = pz + nz * side * stubLen;
      if (Math.abs(ex) > pcbHalf || Math.abs(ez) > pcbHalf) continue;

      const m = new THREE.Mesh(
        new THREE.BoxGeometry(stubLen, TRACE_H, TRACE_W), traceMat
      );
      m.position.set((px + ex) / 2, TRACE_Y, (pz + ez) / 2);
      m.rotation.y = -Math.atan2(ez - pz, ex - px);
      group.add(m);

      // Via cap on the far end
      const via = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.05, 12), viaMat
      );
      via.position.set(ex, VIA_Y, ez);
      group.add(via);
    }
  }
}

/* ───────────────────────────────────────────────────────
   3 — ISOLATED TRACE FRAGMENTS
   Random short L-shapes scattered across the PCB to fill
   empty areas. Avoids the CPU and all chip footprints.
   ─────────────────────────────────────────────────────── */
function addIsolatedTraces(group, mat, viaMat, rng) {
  const pcbHalf = SCENE_CONFIG.pcbSize / 2 - 0.6;
  const exclusions = buildExclusions(2.8, 0.6);
  const NUM = 55;

  for (let i = 0; i < NUM; i++) {
    let x, z, tries = 0;
    do {
      x = (rng() - 0.5) * 2 * pcbHalf;
      z = (rng() - 0.5) * 2 * pcbHalf;
      if (++tries > 20) break;
    } while (inExclusion(x, z, exclusions));
    if (tries > 20) continue;

    // 60% L-shape, 40% single segment
    const isL = rng() < 0.6;
    const horizFirst = rng() < 0.5;
    const len1 = 0.7 + rng() * 1.9;
    const dir1 = horizFirst
      ? (rng() < 0.5 ? 'x' : '-x')
      : (rng() < 0.5 ? 'z' : '-z');

    const end1 = drawAxisSegment(group, mat, x, z, dir1, len1);

    if (isL) {
      const len2 = 0.6 + rng() * 1.5;
      const dir2 = horizFirst
        ? (rng() < 0.5 ? 'z' : '-z')
        : (rng() < 0.5 ? 'x' : '-x');
      drawAxisSegment(group, mat, end1.x, end1.z, dir2, len2);
    }

    // Via at start, sometimes at end
    addVia(group, viaMat, x, z, 0.10);
    if (rng() < 0.4) addVia(group, viaMat, end1.x, end1.z, 0.10);
  }
}

/* ───────────────────────────────────────────────────────
   4 — SURFACE-MOUNT COMPONENTS
   Small 3D box "components" sitting on the PCB. Includes
   resistor-style rectangles, square chips, and longer ICs.
   ─────────────────────────────────────────────────────── */
function addSurfaceMountComps(group, dark, light, rng) {
  const pcbHalf = SCENE_CONFIG.pcbSize / 2 - 1.2;
  const exclusions = buildExclusions(3.2, 1.0);
  const NUM = 28;

  for (let i = 0; i < NUM; i++) {
    let x, z, tries = 0;
    do {
      x = (rng() - 0.5) * 2 * pcbHalf;
      z = (rng() - 0.5) * 2 * pcbHalf;
      if (++tries > 20) break;
    } while (inExclusion(x, z, exclusions));
    if (tries > 20) continue;

    const kind = rng();
    let w, d, h, mat;
    if (kind < 0.45) {
      // Resistor / capacitor
      w = 0.45 + rng() * 0.35;
      d = 0.2;
      h = 0.09;
      mat = dark;
    } else if (kind < 0.78) {
      // Small square IC
      w = d = 0.4 + rng() * 0.35;
      h = 0.14;
      mat = light;
    } else {
      // Longer IC package
      w = 0.9 + rng() * 0.7;
      d = 0.32;
      h = 0.11;
      mat = dark;
    }

    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h / 2 + 0.01, z);
    if (rng() < 0.5) m.rotation.y = Math.PI / 2;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
}

/* ───────────────────────────────────────────────────────
   5 — VIAS at main-path waypoints
   Small glowing dots at each turn make the corners read
   as deliberate via points rather than awkward mesh joins.
   ─────────────────────────────────────────────────────── */
function addMainPathVias(group, mat) {
  for (const comp of COMPONENTS) {
    for (let i = 1; i < comp.path.length - 1; i++) {
      const w = comp.path[i];
      addVia(group, mat, w.x, w.z, 0.13);
    }
  }
}

/* ───────────────────────────────────────────────────────
   HELPERS
   ─────────────────────────────────────────────────────── */
function drawAxisSegment(group, mat, sx, sz, dir, len) {
  let ex = sx, ez = sz, horiz;
  switch (dir) {
    case 'x':  ex = sx + len; horiz = true;  break;
    case '-x': ex = sx - len; horiz = true;  break;
    case 'z':  ez = sz + len; horiz = false; break;
    case '-z': ez = sz - len; horiz = false; break;
  }
  const geo = new THREE.BoxGeometry(
    horiz ? len : THIN_W,
    TRACE_H * 0.85,
    horiz ? THIN_W : len
  );
  const m = new THREE.Mesh(geo, mat);
  m.position.set((sx + ex) / 2, TRACE_Y - 0.003, (sz + ez) / 2);
  group.add(m);
  return { x: ex, z: ez };
}

function addVia(group, mat, x, z, radius) {
  const v = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.04, 12), mat
  );
  v.position.set(x, VIA_Y, z);
  group.add(v);
}

/**
 * Build a list of {x, z, w, d} exclusion zones (w/d are half-extents)
 * covering the CPU and all chip footprints, expanded by `margin`.
 */
function buildExclusions(cpuHalfExtent, chipMargin) {
  return [
    { x: 0, z: 0, w: cpuHalfExtent, d: cpuHalfExtent },
    ...COMPONENTS.map(c => ({
      x: c.position.x,
      z: c.position.z,
      w: c.size.w / 2 + chipMargin,
      d: c.size.d / 2 + chipMargin,
    })),
  ];
}

function inExclusion(x, z, zones) {
  return zones.some(zone =>
    Math.abs(x - zone.x) < zone.w &&
    Math.abs(z - zone.z) < zone.d
  );
}

/** Linear-congruential RNG — small, fast, deterministic. */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

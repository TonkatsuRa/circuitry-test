/**
 * Scene setup: renderer, isometric orthographic camera, lights, PCB substrate.
 * Exposes `createScene()` returning everything `main.js` needs to run the loop.
 */

import * as THREE from './lib/three.js';
import { PALETTE, SCENE_CONFIG } from './config.js';

export function createScene(mountEl) {
  // ─── RENDERER ──────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(PALETTE.pcb, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mountEl.appendChild(renderer.domElement);

  // ─── SCENE ─────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.pcb);
  scene.fog = new THREE.Fog(PALETTE.pcb, 25, 55);

  // ─── ISOMETRIC ORTHOGRAPHIC CAMERA ─────────────────────
  // Classic isometric: equal X/Y/Z position gives ~35° elevation.
  // The frustum is sized so the PCB always fits regardless of aspect ratio
  // (portrait mobile included). `cameraZoom` is the half-extent in whichever
  // screen dimension is shorter.
  const frustum = computeFrustum(window.innerWidth / window.innerHeight);
  const camera = new THREE.OrthographicCamera(
    -frustum.halfW, frustum.halfW,
     frustum.halfH, -frustum.halfH,
     0.1, 200
  );
  camera.position.set(20, 22, 20);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  // ─── LIGHTING ──────────────────────────────────────────
  // Dim ambient so the cyan glows pop visually
  const ambient = new THREE.AmbientLight(0x223344, 0.4);
  scene.add(ambient);

  // Key light from above-front
  const key = new THREE.DirectionalLight(0xc0e8ff, 0.55);
  key.position.set(12, 20, 8);
  key.castShadow = true;
  key.shadow.camera.left   = -20;
  key.shadow.camera.right  =  20;
  key.shadow.camera.top    =  20;
  key.shadow.camera.bottom = -20;
  key.shadow.camera.near   = 0.5;
  key.shadow.camera.far    = 60;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0005;
  scene.add(key);

  // Magenta rim light for cyberpunk feel
  const rim = new THREE.DirectionalLight(0xff2bd2, 0.25);
  rim.position.set(-15, 6, -8);
  scene.add(rim);

  // Subtle cyan fill from below to give the underside of components some glow
  const fill = new THREE.DirectionalLight(0x00ffe5, 0.08);
  fill.position.set(0, -5, 0);
  scene.add(fill);

  // ─── PCB SUBSTRATE ─────────────────────────────────────
  const pcbGroup = buildPCB();
  scene.add(pcbGroup);

  // ─── RESIZE HANDLER ────────────────────────────────────
  window.addEventListener('resize', () => {
    const f = computeFrustum(window.innerWidth / window.innerHeight);
    camera.left   = -f.halfW;
    camera.right  =  f.halfW;
    camera.top    =  f.halfH;
    camera.bottom = -f.halfH;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, pcbGroup };
}

/**
 * Pick a frustum that always shows a square area of at least
 * `2 * SCENE_CONFIG.cameraZoom` in the shorter screen dimension.
 */
function computeFrustum(aspect) {
  const half = SCENE_CONFIG.cameraZoom;
  if (aspect >= 1) {
    return { halfW: half * aspect, halfH: half };
  } else {
    return { halfW: half, halfH: half / aspect };
  }
}

/* ─── PCB SUBSTRATE WITH ETCHED DETAIL ─────────────────── */
function buildPCB() {
  const group = new THREE.Group();
  const size = SCENE_CONFIG.pcbSize;
  const thick = SCENE_CONFIG.pcbThickness;

  // Main PCB slab
  const pcbGeo = new THREE.BoxGeometry(size, thick, size);
  const pcbMat = new THREE.MeshStandardMaterial({
    color:     PALETTE.pcb,
    roughness: 0.85,
    metalness: 0.2,
  });
  const pcb = new THREE.Mesh(pcbGeo, pcbMat);
  pcb.position.y = -thick / 2;
  pcb.receiveShadow = true;
  group.add(pcb);

  // Edge bevel rim — slightly raised border for depth
  const rimGeo = new THREE.BoxGeometry(size + 0.4, 0.12, 0.4);
  const rimMat = new THREE.MeshStandardMaterial({
    color: PALETTE.pcbAccent, roughness: 0.5, metalness: 0.4,
  });
  for (let i = 0; i < 4; i++) {
    const r = new THREE.Mesh(rimGeo, rimMat);
    r.position.y = 0.02;
    if (i === 0) r.position.z =  size / 2;
    if (i === 1) r.position.z = -size / 2;
    if (i === 2) { r.position.x =  size / 2; r.rotation.y = Math.PI / 2; }
    if (i === 3) { r.position.x = -size / 2; r.rotation.y = Math.PI / 2; }
    r.receiveShadow = true;
    group.add(r);
  }

  // Faint reference grid etched on PCB surface (purely decorative)
  const gridGeo = new THREE.BufferGeometry();
  const verts = [];
  const step = 1.0;
  for (let x = -size / 2; x <= size / 2; x += step) {
    verts.push(x, 0.005, -size / 2,  x, 0.005, size / 2);
  }
  for (let z = -size / 2; z <= size / 2; z += step) {
    verts.push(-size / 2, 0.005, z,  size / 2, 0.005, z);
  }
  gridGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(verts, 3)
  );
  const gridMat = new THREE.LineBasicMaterial({
    color: PALETTE.pcbAccent, transparent: true, opacity: 0.35,
  });
  group.add(new THREE.LineSegments(gridGeo, gridMat));

  // Corner markers (small phosphor dots) — purely decorative
  const dotGeo = new THREE.CircleGeometry(0.15, 16);
  const dotMat = new THREE.MeshBasicMaterial({ color: PALETTE.traceLit });
  const half = size / 2 - 0.6;
  [[half, half], [-half, half], [half, -half], [-half, -half]].forEach(([x, z]) => {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(x, 0.04, z);
    group.add(dot);
  });

  return group;
}

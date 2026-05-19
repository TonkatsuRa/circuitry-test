/**
 * Trace paths: each component has waypoints from CPU edge to its corner.
 *
 * Each path is rendered as a THREE.Group containing one Mesh per segment
 * (and per corner node), all sharing a single ShaderMaterial. The vertices
 * of each mesh carry an `aDistance` attribute giving their cumulative
 * distance along the path. A `uProgress` uniform (0..1) controls how far
 * the cyan glow has travelled from the CPU.
 *
 * Using individual meshes rather than a merged geometry avoids any
 * dependency on BufferGeometryUtils — fewer things that can fail.
 */

import * as THREE from 'three';
import { PALETTE, SCENE_CONFIG } from './config.js';

/* ─── SHADERS ────────────────────────────────────────── */
const vertexShader = /* glsl */`
  attribute float aDistance;
  varying float vDistance;
  void main() {
    vDistance = aDistance;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform float uProgress;       // 0..1 — fraction of path lit
  uniform float uTotalLength;
  uniform float uTime;
  uniform vec3  uColorBase;
  uniform vec3  uColorLit;
  uniform float uAmbientPulse;
  varying float vDistance;

  void main() {
    float fillPos = uProgress * uTotalLength;
    float lit     = step(vDistance, fillPos);

    // Bright "head" at the leading edge of the fill
    float headDist = fillPos - vDistance;
    float head     = (headDist > 0.0 && headDist < 0.6)
                      ? (1.0 - headDist / 0.6) : 0.0;

    // Subtle pulse along unlit traces (ambient idle effect)
    float pulse = 0.0;
    if (uAmbientPulse > 0.5) {
      float wave = sin(vDistance * 1.4 - uTime * 2.2);
      pulse = smoothstep(0.85, 1.0, wave) * 0.35;
    }

    vec3 color = mix(uColorBase, uColorLit, lit);
    color    += uColorLit * head * 1.5;
    color    += uColorLit * pulse * (1.0 - lit);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/* ─── PUBLIC CLASS ────────────────────────────────────── */
export class TracePath {
  constructor(component) {
    this.component   = component;
    this.id          = component.id;
    this.waypoints   = component.path;
    this.totalLength = computePathLength(this.waypoints);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uProgress:     { value: 0 },
        uTotalLength:  { value: this.totalLength },
        uTime:         { value: 0 },
        uColorBase:    { value: new THREE.Color(PALETTE.traceBase) },
        uColorLit:     { value: new THREE.Color(PALETTE.traceLit) },
        uAmbientPulse: {
          value: SCENE_CONFIG.enableAmbientPulse ? 1.0 : 0.0,
        },
      },
      vertexShader,
      fragmentShader,
    });

    this.mesh = buildPathGroup(this.waypoints, this.material);
    this.mesh.position.y = 0.001;

    this.progress = 0;
    this._anim    = null;
  }

  /**
   * Trigger fill animation.
   * @param {number} target  0..1 — 1 = fully lit, 0 = unlit
   * @param {function} [onComplete]
   */
  trigger(target, onComplete) {
    this._anim = {
      startTime: performance.now(),
      from:      this.progress,
      to:        target,
      onComplete,
    };
  }

  reset() {
    this.progress = 0;
    this.material.uniforms.uProgress.value = 0;
    this._anim = null;
  }

  update(now) {
    this.material.uniforms.uTime.value = now * 0.001;
    if (!this._anim) return;

    const ms      = SCENE_CONFIG.fillDuration * 1000;
    const elapsed = now - this._anim.startTime;
    const t       = Math.min(1, elapsed / ms);
    const eased   = 1 - Math.pow(1 - t, 2.2);
    this.progress = this._anim.from + (this._anim.to - this._anim.from) * eased;
    this.material.uniforms.uProgress.value = this.progress;

    if (t >= 1) {
      const cb = this._anim.onComplete;
      this._anim = null;
      if (cb) cb();
    }
  }
}

/* ─── GEOMETRY HELPERS ────────────────────────────────── */
function computePathLength(waypoints) {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += dist2D(waypoints[i], waypoints[i + 1]);
  }
  return total;
}

function dist2D(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function buildPathGroup(waypoints, material) {
  const group  = new THREE.Group();
  const traceH = SCENE_CONFIG.traceHeight;
  const traceW = SCENE_CONFIG.traceWidth;

  let cumDist = 0;

  // ── SEGMENTS ──
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a   = waypoints[i];
    const b   = waypoints[i + 1];
    const len = dist2D(a, b);
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const ang = Math.atan2(b.z - a.z, b.x - a.x);

    const geo = new THREE.BoxGeometry(len, traceH, traceW);

    // Per-vertex distance along the path
    const positions = geo.attributes.position;
    const distArr   = new Float32Array(positions.count);
    for (let v = 0; v < positions.count; v++) {
      const localX = positions.getX(v);
      const tSeg   = (localX + len / 2) / len; // 0..1 along segment
      distArr[v]   = cumDist + tSeg * len;
    }
    geo.setAttribute('aDistance', new THREE.BufferAttribute(distArr, 1));

    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(mid.x, traceH / 2, mid.z);
    mesh.rotation.y = -ang;
    group.add(mesh);

    cumDist += len;
  }

  // ── CORNER NODES ──
  // Small raised square at each interior waypoint, lit when fill reaches it
  let nodeDist = 0;
  for (let i = 0; i < waypoints.length; i++) {
    if (i > 0) nodeDist += dist2D(waypoints[i - 1], waypoints[i]);
    if (i === 0 || i === waypoints.length - 1) continue;

    const w   = waypoints[i];
    const nG  = new THREE.BoxGeometry(traceW * 1.6, traceH * 1.2, traceW * 1.6);
    const arr = new Float32Array(nG.attributes.position.count);
    arr.fill(nodeDist);
    nG.setAttribute('aDistance', new THREE.BufferAttribute(arr, 1));

    const nM  = new THREE.Mesh(nG, material);
    nM.position.set(w.x, traceH * 0.6, w.z);
    group.add(nM);
  }

  return group;
}

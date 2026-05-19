/**
 * Trace paths: each component has waypoints from CPU edge to its corner.
 * Each path is built as a merged BufferGeometry whose vertices carry a
 * per-vertex `aDistance` attribute (cumulative distance from path start).
 *
 * A custom ShaderMaterial uses a single `uProgress` uniform (0..totalLength)
 * to light up the path progressively, creating the "data flowing from CPU
 * to chip" effect when the user taps a component.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE, SCENE_CONFIG } from './config.js';

/* ─── SHADERS ────────────────────────────────────────── */
const vertexShader = /* glsl */`
  attribute float aDistance;
  varying float vDistance;
  varying vec3  vWorldPos;
  void main() {
    vDistance = aDistance;
    vec4 wp   = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform float uProgress;       // 0..1 — fraction of path lit
  uniform float uTotalLength;
  uniform float uTime;
  uniform vec3  uColorBase;      // dim color when unlit
  uniform vec3  uColorLit;       // bright cyan when lit
  uniform float uAmbientPulse;   // 0 or 1 - enable idle pulse
  varying float vDistance;

  void main() {
    float fillPos = uProgress * uTotalLength;
    float lit     = step(vDistance, fillPos);

    // "Head" — bright leading edge where the fill is right now
    float headDist = fillPos - vDistance;
    float head     = (headDist > 0.0 && headDist < 0.6)
                      ? (1.0 - headDist / 0.6) : 0.0;

    // Subtle ambient pulse running along the unlit trace (idle decoration)
    float pulse = 0.0;
    if (uAmbientPulse > 0.5) {
      float wave = sin(vDistance * 1.4 - uTime * 2.2);
      pulse = smoothstep(0.85, 1.0, wave) * 0.35;
    }

    vec3 color = mix(uColorBase, uColorLit, lit);
    color    += uColorLit * head * 1.5;        // bright head
    color    += uColorLit * pulse * (1.0 - lit); // idle pulse only on unlit part

    gl_FragColor = vec4(color, 1.0);
  }
`;

/* ─── PUBLIC API ─────────────────────────────────────── */
export class TracePath {
  constructor(component) {
    this.component   = component;
    this.id          = component.id;
    this.waypoints   = component.path;
    this.totalLength = computePathLength(this.waypoints);

    const { geometry, material } = buildPathMesh(
      this.waypoints, this.totalLength
    );
    this.mesh     = new THREE.Mesh(geometry, material);
    this.mesh.position.y = 0.001; // hover just above PCB
    this.material = material;

    this.progress     = 0;
    this._anim        = null;
  }

  /**
   * Trigger the fill animation.
   * @param {number} target  0..1, where 1 = fully lit
   * @param {function} onComplete  optional callback when fill reaches target
   */
  trigger(target, onComplete) {
    this._anim = {
      startTime: performance.now(),
      from:      this.progress,
      to:        target,
      onComplete,
    };
  }

  /** Hard reset to dim state. */
  reset() {
    this.progress = 0;
    this.material.uniforms.uProgress.value = 0;
    this._anim = null;
  }

  /** Called every frame from the main loop. */
  update(now) {
    this.material.uniforms.uTime.value = now * 0.001;

    if (!this._anim) return;
    const ms      = (SCENE_CONFIG.fillDuration * 1000);
    const elapsed = now - this._anim.startTime;
    const t       = Math.min(1, elapsed / ms);
    // Ease-out for snappy start, gentle landing
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

/* ─── GEOMETRY CONSTRUCTION ──────────────────────────── */
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

function buildPathMesh(waypoints, totalLength) {
  const segmentGeos = [];
  const nodeGeos    = [];
  const traceH      = SCENE_CONFIG.traceHeight;
  const traceW      = SCENE_CONFIG.traceWidth;

  let cumDist = 0;

  // Segments
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a   = waypoints[i];
    const b   = waypoints[i + 1];
    const len = dist2D(a, b);
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const ang = Math.atan2(b.z - a.z, b.x - a.x);

    // Build a thin box along the X axis (length axis), then rotate + translate
    const geo = new THREE.BoxGeometry(len, traceH, traceW);

    // Per-vertex distance: vertices at x = -len/2 are segment START,
    // at x = +len/2 are segment END.
    const positions = geo.attributes.position;
    const distArr   = new Float32Array(positions.count);
    for (let v = 0; v < positions.count; v++) {
      const localX = positions.getX(v);
      const tSeg   = (localX + len / 2) / len; // 0..1 along segment
      distArr[v]   = cumDist + tSeg * len;
    }
    geo.setAttribute('aDistance', new THREE.BufferAttribute(distArr, 1));

    geo.rotateY(-ang);
    geo.translate(mid.x, traceH / 2, mid.z);
    segmentGeos.push(geo);

    cumDist += len;
  }

  // Corner nodes — small raised squares at each bend, lit when fill reaches them
  let nodeDist = 0;
  for (let i = 0; i < waypoints.length; i++) {
    const w = waypoints[i];
    if (i > 0) nodeDist += dist2D(waypoints[i - 1], w);

    // Skip the very first node (inside CPU) and the very last (under chip)
    if (i === 0 || i === waypoints.length - 1) continue;

    const nGeo = new THREE.BoxGeometry(
      traceW * 1.6, traceH * 1.2, traceW * 1.6
    );
    const dArr = new Float32Array(nGeo.attributes.position.count);
    dArr.fill(nodeDist);
    nGeo.setAttribute('aDistance', new THREE.BufferAttribute(dArr, 1));
    nGeo.translate(w.x, traceH * 0.6, w.z);
    nodeGeos.push(nGeo);
  }

  const allGeos = [...segmentGeos, ...nodeGeos];
  const merged  = mergeGeometries(allGeos, false);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uProgress:     { value: 0 },
      uTotalLength:  { value: totalLength },
      uTime:         { value: 0 },
      uColorBase:    { value: new THREE.Color(PALETTE.traceBase) },
      uColorLit:     { value: new THREE.Color(PALETTE.traceLit) },
      uAmbientPulse: {
        value: SCENE_CONFIG.enableAmbientPulse ? 1.0 : 0.0,
      },
    },
    vertexShader,
    fragmentShader,
    transparent: false,
  });

  return { geometry: merged, material };
}

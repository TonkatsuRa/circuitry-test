/**
 * UI: raycaster + popup management.
 * Wire it once and it handles the whole interaction lifecycle.
 */

import * as THREE from 'three';

export class InteractionController {
  constructor({ scene, camera, renderer, chipMeshes, paths, onChipSelected }) {
    this.scene          = scene;
    this.camera         = camera;
    this.renderer       = renderer;
    this.chipMeshes     = chipMeshes;   // { id: Group }
    this.paths          = paths;        // { id: TracePath }
    this.onChipSelected = onChipSelected;

    this.raycaster      = new THREE.Raycaster();
    this.pointer        = new THREE.Vector2();
    this.activeId       = null;
    this.busy           = false;        // ignore clicks during animation

    this._attach();
  }

  _attach() {
    const el = this.renderer.domElement;
    // Use pointer events for unified mouse/touch handling
    el.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    el.addEventListener('pointermove', (e) => this._onPointerMove(e));
  }

  _setPointer(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _hitTest() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // Collect all hit meshes
    const targets = Object.values(this.chipMeshes).map(g => g.userData.hitMesh);
    const hits    = this.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return null;
    // Walk up to find the group with componentId
    let obj = hits[0].object;
    while (obj && !obj.userData.componentId) obj = obj.parent;
    return obj ? obj.userData.componentId : null;
  }

  _onPointerMove(event) {
    this._setPointer(event);
    const id = this._hitTest();
    this.renderer.domElement.style.cursor = id ? 'pointer' : 'crosshair';
  }

  _onPointerDown(event) {
    if (this.busy) return;
    this._setPointer(event);
    const id = this._hitTest();
    if (!id) return;
    this.selectChip(id);
  }

  selectChip(id) {
    if (this.busy) return;
    this.busy = true;
    this.activeId = id;

    setHUDStatus(`PROBING::${id.toUpperCase()}`);

    // Light up only this path; reset others
    Object.entries(this.paths).forEach(([pid, path]) => {
      if (pid === id) {
        path.trigger(1, () => {
          // path finished filling — show popup after a beat
          this._lightChip(id, true);
          setTimeout(() => {
            this.onChipSelected(id);
            setHUDStatus(`LINKED::${id.toUpperCase()}`);
          }, 150);
        });
      } else {
        path.trigger(0);
        this._lightChip(pid, false);
      }
    });
  }

  _lightChip(id, lit) {
    const chip = this.chipMeshes[id];
    if (!chip) return;
    const litColor   = new THREE.Color(0x00ffe5);
    const dimColor   = new THREE.Color(0x0a3b34);
    (chip.userData.litMaterials || []).forEach(m => {
      m.color.copy(lit ? litColor : dimColor);
    });
  }

  /** Called when popup is dismissed — unlight everything. */
  clear() {
    Object.values(this.paths).forEach(p => p.trigger(0));
    Object.keys(this.chipMeshes).forEach(id => this._lightChip(id, false));
    this.activeId = null;
    this.busy = false;
    setHUDStatus('IDLE');
  }
}

/* ─── POPUP CONTROLLER ──────────────────────────────── */
export class PopupController {
  constructor(componentsById) {
    this.componentsById = componentsById;
    this.backdrop = document.getElementById('popup-backdrop');
    this.title    = document.getElementById('popup-title');
    this.subtitle = document.getElementById('popup-subtitle');
    this.idEl     = document.getElementById('popup-id');
    this.body     = document.getElementById('popup-body');
    this.closeBtn = document.getElementById('popup-close');

    this.onClose = null;

    this.closeBtn.addEventListener('click', () => this.hide());
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.hide();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
  }

  show(componentId) {
    const data = this.componentsById[componentId]?.popup;
    if (!data) return;
    this.idEl.textContent       = data.id;
    this.title.textContent      = data.title;
    this.subtitle.textContent   = data.subtitle;

    // Build body lines
    this.body.innerHTML = '';
    data.lines.forEach((line, i) => {
      const row = document.createElement('div');
      row.className = 'popup-line' + (line.status === 'alert' ? ' alert' : '');
      row.style.animationDelay = `${i * 60}ms`;
      row.innerHTML = `<span class="k">${escapeHTML(line.k)}</span>` +
                      `<span class="v">${escapeHTML(line.v)}</span>`;
      this.body.appendChild(row);
    });

    this.backdrop.classList.add('active');
    this.backdrop.setAttribute('aria-hidden', 'false');
  }

  hide() {
    if (!this.backdrop.classList.contains('active')) return;
    this.backdrop.classList.remove('active');
    this.backdrop.setAttribute('aria-hidden', 'true');
    if (this.onClose) this.onClose();
  }
}

/* ─── HUD STATUS HELPER ─────────────────────────────── */
export function setHUDStatus(text) {
  const el = document.getElementById('hud-status');
  if (el) el.textContent = text;
}

export function startHUDClock() {
  const el = document.getElementById('hud-clock');
  if (!el) return;
  const tick = () => {
    const d = new Date();
    el.textContent = d.toISOString().slice(11, 19);
  };
  tick();
  setInterval(tick, 1000);
}

function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

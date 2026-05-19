/**
 * ============================================================
 *  CIRCUIT::GRID — Configuration
 * ============================================================
 *  This file is the SINGLE SOURCE OF TRUTH for the scene.
 *  To add a new component, append an entry to COMPONENTS with:
 *    - id, label, position (x, z), type (visual style preset)
 *    - path: ordered list of waypoints from CPU edge to chip
 *    - popup: data shown when the chip is selected
 *
 *  Coordinate system (top-down view):
 *    +X = right, -X = left, +Z = south, -Z = north
 *    The PCB plane is at y = 0; components sit on top.
 *  CPU sits at origin and spans (-2..+2) on both X and Z.
 * ============================================================
 */

export const PALETTE = {
  pcb:        0x081512,   // dark green-black PCB substrate
  pcbAccent:  0x0d2a25,   // slightly lighter for surface detail
  traceBase:  0x0a3b34,   // dim trace color (unlit)
  traceLit:   0x00ffe5,   // cyan when active
  cpuBody:    0x14181c,
  cpuPlate:   0x202830,
  cpuCore:    0xff2bd2,   // magenta core glow
  chipDark:   0x0a0e10,
  chipMid:    0x1a2228,
  goldPin:    0xc99b3a,
  silicon:    0x0e1014,
  amber:      0xffb000,
};

export const SCENE_CONFIG = {
  pcbSize:        24,           // PCB extends -12 to +12
  pcbThickness:   0.3,
  traceHeight:    0.08,         // how thick traces are
  traceWidth:     0.18,
  cameraZoom:     18,           // ortho half-extent in the shorter screen dim
  fillDuration:   1.4,          // seconds for full path to light up
  popupDelay:     0.15,         // seconds after fill completes
  enableScanlines:true,
  enableAmbientPulse: true,     // soft pulse on idle traces
};

/**
 * Components placed at the 4 corners.
 * To add more: just append. The renderer auto-builds everything from this list.
 */
export const COMPONENTS = [
  /* ─── TOP-LEFT — RAM ───────────────────────────────────── */
  {
    id: 'ram',
    label: 'MEM_MODULE',
    type: 'ram',
    position: { x: -8.5, z: -7 },
    size:     { w: 4.5, h: 1.2, d: 1.4 },
    path: [
      { x: -2,    z: -1.5 },
      { x: -4,    z: -1.5 },
      { x: -4,    z: -3   },
      { x: -6,    z: -3   },
      { x: -6,    z: -5   },
      { x: -7.5,  z: -5   },
      { x: -7.5,  z: -7   },
    ],
    popup: {
      id:       'NODE-RAM-0x04',
      title:    'MEMORY MODULE',
      subtitle: 'DDR-7 / SYNC.OK',
      lines: [
        { k: 'CAPACITY',  v: '64.0 GB',     status: 'ok' },
        { k: 'FREQUENCY', v: '8400 MT/s',   status: 'ok' },
        { k: 'LATENCY',   v: 'CL 36',       status: 'ok' },
        { k: 'TEMP',      v: '42° C',       status: 'ok' },
        { k: 'ECC',       v: 'ENABLED',     status: 'ok' },
        { k: 'INTEGRITY', v: '99.997 %',    status: 'ok' },
      ],
    },
  },

  /* ─── TOP-RIGHT — GPU ──────────────────────────────────── */
  {
    id: 'gpu',
    label: 'GFX_PROC',
    type: 'gpu',
    position: { x: 8, z: -7 },
    size:     { w: 4.5, h: 1.0, d: 3.0 },
    path: [
      { x:  2,    z: -1.5 },
      { x:  4,    z: -1.5 },
      { x:  4,    z: -3   },
      { x:  5.5,  z: -3   },
      { x:  5.5,  z: -4.5 },
      { x:  7,    z: -4.5 },
      { x:  7,    z: -7   },
    ],
    popup: {
      id:       'NODE-GPU-0x02',
      title:    'GRAPHICS PROCESSOR',
      subtitle: 'PARALLEL.SHADER.ARRAY',
      lines: [
        { k: 'CORES',     v: '16,384',      status: 'ok' },
        { k: 'V-RAM',     v: '24.0 GB',     status: 'ok' },
        { k: 'CLOCK',     v: '2.65 GHz',    status: 'ok' },
        { k: 'TEMP',      v: '71° C',       status: 'alert' },
        { k: 'TDP',       v: '320 W',       status: 'ok' },
        { k: 'RENDER',    v: 'ACTIVE',      status: 'ok' },
      ],
    },
  },

  /* ─── BOTTOM-RIGHT — SSD ───────────────────────────────── */
  {
    id: 'ssd',
    label: 'STORAGE',
    type: 'ssd',
    position: { x: 8, z: 7 },
    size:     { w: 4.0, h: 0.6, d: 2.2 },
    path: [
      { x:  2,    z:  1.5 },
      { x:  3.5,  z:  1.5 },
      { x:  3.5,  z:  3   },
      { x:  5,    z:  3   },
      { x:  5,    z:  5   },
      { x:  7,    z:  5   },
      { x:  7,    z:  7   },
    ],
    popup: {
      id:       'NODE-SSD-0x08',
      title:    'STORAGE ARRAY',
      subtitle: 'NVME // SECTOR_MAP_OK',
      lines: [
        { k: 'CAPACITY',  v: '4.0 TB',      status: 'ok' },
        { k: 'READ',      v: '14.2 GB/s',   status: 'ok' },
        { k: 'WRITE',     v: '12.8 GB/s',   status: 'ok' },
        { k: 'WEAR',      v: '3 %',         status: 'ok' },
        { k: 'TEMP',      v: '48° C',       status: 'ok' },
        { k: 'ENCRYPTION',v: 'AES-256',     status: 'ok' },
      ],
    },
  },

  /* ─── BOTTOM-LEFT — BIOS ───────────────────────────────── */
  {
    id: 'bios',
    label: 'FIRMWARE',
    type: 'bios',
    position: { x: -8, z: 7 },
    size:     { w: 2.0, h: 0.5, d: 2.0 },
    path: [
      { x: -2,    z:  1.5 },
      { x: -4,    z:  1.5 },
      { x: -4,    z:  3   },
      { x: -5.5,  z:  3   },
      { x: -5.5,  z:  5   },
      { x: -7,    z:  5   },
      { x: -7,    z:  7   },
    ],
    popup: {
      id:       'NODE-BIOS-0x01',
      title:    'BIOS / FIRMWARE',
      subtitle: 'SECURE.BOOT.VERIFIED',
      lines: [
        { k: 'VERSION',   v: 'v3.14.159',   status: 'ok' },
        { k: 'BUILD',     v: '2076.04.21',  status: 'ok' },
        { k: 'SIGNATURE', v: 'TRUSTED',     status: 'ok' },
        { k: 'TPM',       v: 'BOUND',       status: 'ok' },
        { k: 'BOOT.TIME', v: '1.3 s',       status: 'ok' },
        { k: 'INTRUSION', v: 'NONE',        status: 'ok' },
      ],
    },
  },
];

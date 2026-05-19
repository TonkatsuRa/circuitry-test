/**
 * Single source of truth for Three.js.
 *
 * All other files import Three.js through this shim instead of using bare
 * specifiers + import maps. That keeps the project working in every browser
 * that supports ES modules (effectively all modern browsers since 2018),
 * without depending on import map support (Safari < 16.4, older mobile).
 *
 * To upgrade Three.js, change the version number in the URL below — this
 * is the only place it appears.
 */

export * from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

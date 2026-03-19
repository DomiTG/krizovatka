'use strict';

/* ─── Entry point ─────────────────────────────────────────────────────────────
 * Initialises the Simulation and UI, then starts the requestAnimationFrame loop.
 * ─────────────────────────────────────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('simulation-canvas');
  canvas.width  = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // Create simulation with default settings
  const sim = new Simulation(canvas);

  // Wire the control panel (store on window for optional debugging access)
  window._sim = sim;
  window._ui  = new UI(sim);

  // ── Game loop ──────────────────────────────────────────────────────────────
  let lastTime = 0;

  function loop(timestamp) {
    // Delta time in seconds, capped at 50 ms to avoid spiral-of-death on
    // tab switch / slow frames
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime  = timestamp;

    sim.update(dt);
    sim.draw();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
});

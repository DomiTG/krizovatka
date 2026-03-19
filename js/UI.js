'use strict';

/**
 * UI
 *
 * Wires the HTML control panel to the Simulation instance.
 * All DOM queries happen here so the rest of the code stays DOM-free.
 */
class UI {
  /** @param {Simulation} sim */
  constructor(sim) {
    this.sim = sim;
    this._bind();
    this._tick();  // start stats refresh
  }

  // ── Bind all controls ──────────────────────────────────────────────────────

  _bind() {
    const s = this.sim;

    // ── Traffic light durations ────────────────────────────────────────────

    this._slider('ns-green', v => {
      s.settings.greenDuration = v;
      s.lights.greenDuration   = v;
    });
    this._slider('ew-green', v => {
      s.settings.greenDuration = v;
      s.lights.greenDuration   = v;
    });
    this._slider('ns-yellow', v => {
      s.settings.yellowDuration = v;
      s.lights.yellowDuration   = v;
    });
    this._slider('ew-yellow', v => {
      s.settings.yellowDuration = v;
      s.lights.yellowDuration   = v;
    });

    // Keep the two green sliders in sync (they share a single greenDuration)
    this._syncSliders('ns-green', 'ew-green');
    this._syncSliders('ns-yellow', 'ew-yellow');

    // ── Simulation knobs ───────────────────────────────────────────────────

    this._slider('spawn-rate', v => { s.settings.spawnRate = v; });
    this._slider('car-speed',  v => { s.settings.carSpeed  = v; });

    // Turn probabilities – normalise on change
    this._slider('straight-prob', () => this._normaliseTurnProbs());
    this._slider('left-prob',     () => this._normaliseTurnProbs());
    this._slider('right-prob',    () => this._normaliseTurnProbs());

    // ── Buttons ────────────────────────────────────────────────────────────

    this._btn('btn-pause', () => {
      s.paused = !s.paused;
      document.getElementById('btn-pause').textContent = s.paused ? '▶ Resume' : '⏸ Pause';
    });

    this._btn('btn-reset', () => {
      s.reset();
      s.paused = false;
      document.getElementById('btn-pause').textContent = '⏸ Pause';
      this._resetStats();
    });

    // ── Manual traffic light control ───────────────────────────────────────

    const manualToggle = document.getElementById('manual-toggle');
    const manualPanel  = document.getElementById('manual-panel');
    if (manualToggle) {
      manualToggle.addEventListener('change', () => {
        s.lights.manual = manualToggle.checked;
        manualPanel.style.display = manualToggle.checked ? 'flex' : 'none';
      });
    }

    this._btn('btn-ns-green', () => s.lights.setNSGreen());
    this._btn('btn-ew-green', () => s.lights.setEWGreen());
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Bind a range input; call `cb(numericValue)` on input events.
   * Also updates the adjacent <output> element.
   */
  _slider(id, cb) {
    const el = document.getElementById(id);
    if (!el) return;
    const out = document.getElementById(id + '-val');

    const update = () => {
      const v = parseFloat(el.value);
      if (out) out.textContent = el.dataset.unit ? v + el.dataset.unit : v;
      cb(v);
    };
    el.addEventListener('input', update);
    update();   // initialise display
  }

  /** Keep two sliders with the same value. */
  _syncSliders(idA, idB) {
    const a = document.getElementById(idA);
    const b = document.getElementById(idB);
    if (!a || !b) return;
    // Use flags to prevent infinite mutual-trigger loop
    let syncing = false;
    a.addEventListener('input', () => {
      if (syncing) return;
      syncing = true;
      b.value = a.value;
      b.dispatchEvent(new Event('input'));
      syncing = false;
    });
    b.addEventListener('input', () => {
      if (syncing) return;
      syncing = true;
      a.value = b.value;
      a.dispatchEvent(new Event('input'));
      syncing = false;
    });
  }

  _btn(id, cb) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', cb);
  }

  /** Normalise turn probabilities so they always sum to 1. */
  _normaliseTurnProbs() {
    const straight = parseFloat(document.getElementById('straight-prob')?.value ?? DEFAULT_STRAIGHT_PROB);
    const left     = parseFloat(document.getElementById('left-prob')?.value     ?? DEFAULT_LEFT_PROB);
    const right    = parseFloat(document.getElementById('right-prob')?.value    ?? DEFAULT_RIGHT_PROB);
    const total    = straight + left + right || 1;
    this.sim.settings.straightProb = straight / total;
    this.sim.settings.leftProb     = left     / total;
    this.sim.settings.rightProb    = right    / total;
  }

  // ── Statistics display ─────────────────────────────────────────────────────

  _resetStats() {
    this._setText('stat-passed',   '0');
    this._setText('stat-waiting',  '0');
    this._setText('stat-active',   '0');
    this._setText('stat-avg-wait', '0.0s');
    this._setText('stat-max-wait', '0.0s');
    this._setText('stat-time',     '0:00');
  }

  /** Refresh the stats panel; called at ~10 Hz via setInterval. */
  _updateStats() {
    const s = this.sim;
    this._setText('stat-passed',   s.stats.carsPassed);
    this._setText('stat-waiting',  s.carsWaiting);
    this._setText('stat-active',   s.carsActive);
    this._setText('stat-avg-wait', formatTime(s.avgWaitTime));
    this._setText('stat-max-wait', formatTime(s.stats.maxWaitTime));
    this._setText('stat-time',     formatTime(s.time));

    // Also update the traffic-light indicator dots in the panel
    this._updateLightIndicators();
  }

  _updateLightIndicators() {
    const { NS, EW } = this.sim.lights;
    this._setLightDot('dot-ns', NS);
    this._setLightDot('dot-ew', EW);
  }

  _setLightDot(id, state) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'light-dot ' + state.toLowerCase();
  }

  _setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  _tick() {
    setInterval(() => this._updateStats(), 100);
  }
}

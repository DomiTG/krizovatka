'use strict';

/**
 * TrafficLightController
 *
 * Manages two grouped signal phases:
 *   • NS phase – controls NORTH and SOUTH approaches
 *   • EW phase – controls EAST  and WEST  approaches
 *
 * Cycle: [NS GREEN → NS YELLOW → EW GREEN → EW YELLOW → repeat]
 * Manual mode lets the user freeze or switch phases via the UI.
 */
class TrafficLightController {
  /**
   * @param {object} cfg
   * @param {number} cfg.greenDuration   seconds per green phase
   * @param {number} cfg.yellowDuration  seconds per yellow phase
   */
  constructor(cfg = {}) {
    this.greenDuration  = cfg.greenDuration  ?? DEFAULT_GREEN_DURATION;
    this.yellowDuration = cfg.yellowDuration ?? DEFAULT_YELLOW_DURATION;

    // Current active phase ('NS' | 'EW') and its state ('GREEN' | 'YELLOW')
    this._phase      = 'NS';
    this._phaseState = LIGHT.GREEN;
    this._timer      = 0;

    // Per-group signal states
    this.NS = LIGHT.GREEN;
    this.EW = LIGHT.RED;

    // Manual override – when true the timer stops and the user drives the lights
    this.manual = false;
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /** Returns true when the given approach direction has a green signal. */
  isGreen(approach) {
    const grp = (approach === DIR.NORTH || approach === DIR.SOUTH) ? this.NS : this.EW;
    return grp === LIGHT.GREEN;
  }

  /** Returns true when the given approach has green OR yellow (still moving). */
  canPass(approach) {
    const grp = (approach === DIR.NORTH || approach === DIR.SOUTH) ? this.NS : this.EW;
    return grp === LIGHT.GREEN || grp === LIGHT.YELLOW;
  }

  /** Return the raw state string for a group ('NS' | 'EW'). */
  groupState(group) {
    return group === 'NS' ? this.NS : this.EW;
  }

  // ── Manual control ─────────────────────────────────────────────────────────

  /** Switch to NS green immediately (manual mode only). */
  setNSGreen() {
    if (!this.manual) return;
    this.NS = LIGHT.GREEN;
    this.EW = LIGHT.RED;
    this._phase      = 'NS';
    this._phaseState = LIGHT.GREEN;
    this._timer      = 0;
  }

  /** Switch to EW green immediately (manual mode only). */
  setEWGreen() {
    if (!this.manual) return;
    this.EW = LIGHT.GREEN;
    this.NS = LIGHT.RED;
    this._phase      = 'EW';
    this._phaseState = LIGHT.GREEN;
    this._timer      = 0;
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  /** @param {number} dt  delta time in seconds */
  update(dt) {
    if (this.manual) return;

    this._timer += dt;

    if (this._phaseState === LIGHT.GREEN && this._timer >= this.greenDuration) {
      // Transition active phase to yellow
      this._phaseState = LIGHT.YELLOW;
      this._timer      = 0;
      if (this._phase === 'NS') this.NS = LIGHT.YELLOW;
      else                      this.EW = LIGHT.YELLOW;

    } else if (this._phaseState === LIGHT.YELLOW && this._timer >= this.yellowDuration) {
      // Switch to the other phase
      if (this._phase === 'NS') {
        this.NS     = LIGHT.RED;
        this.EW     = LIGHT.GREEN;
        this._phase = 'EW';
      } else {
        this.EW     = LIGHT.RED;
        this.NS     = LIGHT.GREEN;
        this._phase = 'NS';
      }
      this._phaseState = LIGHT.GREEN;
      this._timer      = 0;
    }
  }

  // ── Progress within the current green phase (0..1) ────────────────────────

  /** Fraction of the current green (or yellow) period that has elapsed. */
  phaseProgress() {
    const dur = this._phaseState === LIGHT.GREEN ? this.greenDuration : this.yellowDuration;
    return clamp(this._timer / dur, 0, 1);
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  /**
   * Draw a small 3-lamp traffic light box at (x, y).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x   centre x of the housing
   * @param {number} y   centre y of the housing
   * @param {string} state  LIGHT.GREEN / YELLOW / RED
   */
  static drawLamp(ctx, x, y, state) {
    const W = 12, H = 32, R = 4;

    // Housing
    ctx.fillStyle = '#222';
    roundRect(ctx, x - W/2, y - H/2, W, H, 3);
    ctx.fill();

    // Lamps (top = red, middle = yellow, bottom = green)
    const lamps = [
      { cy: y - H/2 + 5,  color: state === LIGHT.RED    ? '#ff3b30' : '#550000' },
      { cy: y,             color: state === LIGHT.YELLOW ? '#ffcc00' : '#554400' },
      { cy: y + H/2 - 5,  color: state === LIGHT.GREEN  ? '#34c759' : '#004400' },
    ];
    for (const lamp of lamps) {
      // Glow effect for active lamp
      if (lamp.color[1] !== '5') {
        ctx.shadowColor = lamp.color;
        ctx.shadowBlur  = 8;
      }
      ctx.fillStyle = lamp.color;
      ctx.beginPath();
      ctx.arc(x, lamp.cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  /**
   * Draw all four traffic lights around the intersection corners.
   * @param {CanvasRenderingContext2D} ctx
   */
  drawAll(ctx) {
    // Positions: just outside each corner of the intersection box
    // Each approach gets a light visible from that direction
    const offset = 8;

    // North approach (SB cars) – lamp on right side of lane, above intersection
    TrafficLightController.drawLamp(ctx,
      SB_LANE_X + 14,
      INT_TOP - offset - 16,
      this.NS);

    // South approach (NB cars) – lamp on right side of lane, below intersection
    TrafficLightController.drawLamp(ctx,
      NB_LANE_X - 14,
      INT_BOTTOM + offset + 16,
      this.NS);

    // East approach (WB cars) – lamp above lane, right of intersection
    TrafficLightController.drawLamp(ctx,
      INT_RIGHT + offset + 16,
      WB_LANE_Y - 14,
      this.EW);

    // West approach (EB cars) – lamp below lane, left of intersection
    TrafficLightController.drawLamp(ctx,
      INT_LEFT - offset - 16,
      EB_LANE_Y + 14,
      this.EW);
  }

  // ── Serialise / reset ──────────────────────────────────────────────────────

  reset() {
    this._phase      = 'NS';
    this._phaseState = LIGHT.GREEN;
    this._timer      = 0;
    this.NS          = LIGHT.GREEN;
    this.EW          = LIGHT.RED;
    this.manual      = false;
  }
}

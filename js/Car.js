'use strict';

let _carIdCounter = 0;

/** Reset the global car ID counter. Called by Simulation.reset(). */
function resetCarIdCounter() { _carIdCounter = 0; }

/**
 * Car
 *
 * A single vehicle that travels from one edge of the canvas to the other,
 * obeying traffic lights and queuing behind other vehicles.
 *
 * State machine:
 *   APPROACHING → (red light or car ahead) → WAITING
 *   WAITING     → (green + clear)          → TRAVERSING
 *   TRAVERSING  → (t reaches 1)            → EXITING
 *   EXITING     → (off-screen)             → done = true
 */
class Car {
  /**
   * @param {string} origin  DIR.*
   * @param {object} settings  simulation settings reference
   */
  constructor(origin, settings) {
    this.id     = _carIdCounter++;
    this.origin = origin;
    this.color  = randomFrom(CAR_COLORS);
    this.state  = CAR_STATE.APPROACHING;

    // Physics
    this.baseSpeed    = settings.carSpeed;
    this.currentSpeed = this.baseSpeed;

    // Turn decision and bezier traversal (set when entering intersection)
    this.turn       = null;
    this.path       = null;   // array of bezier control points
    this.pathLength = 0;
    this.pathT      = 0;

    // Stats
    this.waitTime  = 0;
    this.spawnedAt = 0;   // set by Simulation

    // Removal flag
    this.done = false;

    // Place car at the edge it enters from
    this._initPosition();
  }

  // ── Initialisation ─────────────────────────────────────────────────────────

  _initPosition() {
    switch (this.origin) {
      case DIR.NORTH:
        this.x     = SB_LANE_X;
        this.y     = -CAR_LENGTH;
        this.angle = Math.PI / 2;   // facing south (down)
        break;
      case DIR.SOUTH:
        this.x     = NB_LANE_X;
        this.y     = CANVAS_HEIGHT + CAR_LENGTH;
        this.angle = -Math.PI / 2;  // facing north (up)
        break;
      case DIR.EAST:
        this.x     = CANVAS_WIDTH + CAR_LENGTH;
        this.y     = WB_LANE_Y;
        this.angle = Math.PI;       // facing west (left)
        break;
      case DIR.WEST:
        this.x     = -CAR_LENGTH;
        this.y     = EB_LANE_Y;
        this.angle = 0;             // facing east (right)
        break;
    }
  }

  // ── Stop-line helpers ──────────────────────────────────────────────────────

  /** Signed distance from the car's front to the stop line (positive = not yet there). */
  distToStopLine() {
    switch (this.origin) {
      case DIR.NORTH: return STOP_LINE.NORTH - this.y;   // stop line is at higher y
      case DIR.SOUTH: return this.y - STOP_LINE.SOUTH;   // stop line is at lower  y
      case DIR.EAST:  return this.x - STOP_LINE.EAST;    // stop line is at lower  x
      case DIR.WEST:  return STOP_LINE.WEST - this.x;    // stop line is at higher x
    }
  }

  /** Snap the car precisely to the stop line. */
  _snapToStopLine() {
    switch (this.origin) {
      case DIR.NORTH: this.y = STOP_LINE.NORTH; break;
      case DIR.SOUTH: this.y = STOP_LINE.SOUTH; break;
      case DIR.EAST:  this.x = STOP_LINE.EAST;  break;
      case DIR.WEST:  this.x = STOP_LINE.WEST;  break;
    }
  }

  // ── Queue helpers ──────────────────────────────────────────────────────────

  /**
   * Returns true if `other` is in the same approach lane AND
   * is between this car and the stop line.
   */
  _isAheadInLane(other) {
    if (other.id === this.id)     return false;
    if (other.origin !== this.origin) return false;
    if (other.state !== CAR_STATE.APPROACHING &&
        other.state !== CAR_STATE.WAITING) return false;

    switch (this.origin) {
      case DIR.NORTH: return other.y > this.y;   // closer to stop line (higher y)
      case DIR.SOUTH: return other.y < this.y;
      case DIR.EAST:  return other.x < this.x;
      case DIR.WEST:  return other.x > this.x;
    }
    return false;
  }

  /**
   * Distance to the nearest car ahead in the same lane.
   * Returns Infinity if no car is close enough to matter.
   */
  _gapToCarAhead(allCars) {
    let minGap = Infinity;
    for (const other of allCars) {
      if (!this._isAheadInLane(other)) continue;
      const d = dist(this.x, this.y, other.x, other.y);
      if (d < minGap) minGap = d;
    }
    return minGap;
  }

  /**
   * True when no other car from the same approach is:
   *   a) waiting at the stop line ahead of this one, OR
   *   b) in the very early part of the intersection traversal
   *      (pathT < 0.25 means they just entered and haven't cleared)
   */
  _canEnterIntersection(allCars) {
    for (const other of allCars) {
      if (other.id === this.id) continue;
      if (other.origin !== this.origin) continue;

      // Another car from same approach is closer to the stop line
      if (other.state === CAR_STATE.WAITING ||
          other.state === CAR_STATE.APPROACHING) {
        if (this._isAheadInLane(other)) return false;
      }

      // A car just entered from the same approach
      if (other.state === CAR_STATE.TRAVERSING && other.pathT < 0.25) {
        return false;
      }
    }
    return true;
  }

  // ── Intersection traversal ─────────────────────────────────────────────────

  _chooseTurn(settings) {
    return weightedRandom(
      [TURN.STRAIGHT, TURN.LEFT, TURN.RIGHT],
      [settings.straightProb, settings.leftProb, settings.rightProb]
    );
  }

  _enterIntersection(settings) {
    this.turn       = this._chooseTurn(settings);
    const key       = `${this.origin}-${this.turn}`;
    this.path       = INTERSECTION_PATHS[key];
    this.pathLength = bezierLength(this.path);
    this.pathT      = 0;
    this.state      = CAR_STATE.TRAVERSING;

    // Snap to exact entry point
    const p = bezierPoint(0, this.path);
    this.x = p.x;
    this.y = p.y;
  }

  // ── Movement helpers ───────────────────────────────────────────────────────

  _moveForward(speed) {
    this.x += Math.cos(this.angle) * speed;
    this.y += Math.sin(this.angle) * speed;
  }

  _setAngleForDir(dir) {
    switch (dir) {
      case DIR.NORTH: this.angle = -Math.PI / 2; break;
      case DIR.SOUTH: this.angle =  Math.PI / 2; break;
      case DIR.EAST:  this.angle =  0;            break;
      case DIR.WEST:  this.angle =  Math.PI;      break;
    }
  }

  // ── State updates ──────────────────────────────────────────────────────────

  _updateApproaching(lightCtrl, allCars, settings) {
    const gap         = this._gapToCarAhead(allCars);
    const distToStop  = this.distToStopLine();

    // Slow down if car ahead is close
    let targetSpeed = this.baseSpeed;
    if (gap < CAR_SAFE_DISTANCE) {
      targetSpeed = 0;
    } else if (gap < CAR_SAFE_DISTANCE * 2) {
      targetSpeed = this.baseSpeed * (gap - CAR_SAFE_DISTANCE) / CAR_SAFE_DISTANCE;
    }

    // Slow to stop for red light as we approach the stop line
    if (distToStop <= CAR_SAFE_DISTANCE && !lightCtrl.canPass(this.origin)) {
      targetSpeed = 0;
    }

    // Smooth speed change
    this.currentSpeed += (targetSpeed - this.currentSpeed) * 0.15;

    // Stop precisely at the line; don't overshoot
    const move = Math.min(this.currentSpeed, Math.max(0, distToStop));
    if (distToStop > 1) {
      this._moveForward(move);
    }

    // Reached stop line?
    if (distToStop <= 1) {
      this._snapToStopLine();
      if (lightCtrl.canPass(this.origin) && this._canEnterIntersection(allCars)) {
        this._enterIntersection(settings);
      } else {
        this.state        = CAR_STATE.WAITING;
        this.currentSpeed = 0;
      }
    }
  }

  _updateWaiting(dt, lightCtrl, allCars, settings) {
    this.waitTime += dt;
    if (lightCtrl.canPass(this.origin) && this._canEnterIntersection(allCars)) {
      this._enterIntersection(settings);
    }
  }

  _updateTraversing() {
    // Advance t so that arc-speed ≈ baseSpeed px/frame
    this.pathT = Math.min(1, this.pathT + this.baseSpeed / this.pathLength);

    const pos = bezierPoint(this.pathT, this.path);
    this.x = pos.x;
    this.y = pos.y;

    // Update heading from bezier tangent
    const tan = bezierTangent(this.pathT, this.path);
    if (tan.x !== 0 || tan.y !== 0) {
      this.angle = Math.atan2(tan.y, tan.x);
    }

    if (this.pathT >= 1) {
      this.state = CAR_STATE.EXITING;
      const exitInfo = EXIT_DIRECTIONS[`${this.origin}-${this.turn}`];
      this._setAngleForDir(exitInfo.dir);
    }
  }

  _updateExiting() {
    this._moveForward(this.baseSpeed);
    // Remove once fully off-screen
    if (this.x < -60 || this.x > CANVAS_WIDTH + 60 ||
        this.y < -60 || this.y > CANVAS_HEIGHT + 60) {
      this.done = true;
    }
  }

  // ── Public update ──────────────────────────────────────────────────────────

  /**
   * @param {number}                   dt          delta time in seconds
   * @param {TrafficLightController}   lightCtrl
   * @param {Car[]}                    allCars
   * @param {object}                   settings    simulation settings
   */
  update(dt, lightCtrl, allCars, settings) {
    switch (this.state) {
      case CAR_STATE.APPROACHING: this._updateApproaching(lightCtrl, allCars, settings); break;
      case CAR_STATE.WAITING:     this._updateWaiting(dt, lightCtrl, allCars, settings); break;
      case CAR_STATE.TRAVERSING:  this._updateTraversing(); break;
      case CAR_STATE.EXITING:     this._updateExiting();    break;
    }
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const L = CAR_LENGTH, W = CAR_WIDTH;

    // Shadow
    ctx.shadowColor   = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur    = 4;
    ctx.shadowOffsetY = 2;

    // Body
    ctx.fillStyle = this.color;
    roundRect(ctx, -L / 2, -W / 2, L, W, 3);
    ctx.fill();

    ctx.shadowBlur    = 0;
    ctx.shadowOffsetY = 0;

    // Roof / windshields (dark tint)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -L / 2 + 3, -W / 2 + 2, L - 8, W - 4, 2);
    ctx.fill();

    // Front windshield highlight
    ctx.fillStyle = 'rgba(180,220,255,0.55)';
    roundRect(ctx, L / 2 - 6, -W / 2 + 2, 4, W - 4, 1);
    ctx.fill();

    // Headlights
    ctx.fillStyle = '#ffffcc';
    ctx.beginPath(); ctx.arc(L / 2 - 1, -W / 2 + 2, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(L / 2 - 1,  W / 2 - 2, 1.5, 0, Math.PI * 2); ctx.fill();

    // Tail lights
    ctx.fillStyle = '#ff4444';
    ctx.beginPath(); ctx.arc(-L / 2 + 1, -W / 2 + 2, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-L / 2 + 1,  W / 2 - 2, 1.5, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }
}

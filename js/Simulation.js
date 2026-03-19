'use strict';

/**
 * Simulation
 *
 * Owns the canvas, all Cars, Pedestrians, the TrafficLightController,
 * and the statistics counters.
 */
class Simulation {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [initialSettings]  override defaults
   */
  constructor(canvas, initialSettings = {}) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    // ── Settings (all values the UI can change) ────────────────────────────
    this.settings = {
      greenDuration:  DEFAULT_GREEN_DURATION,
      yellowDuration: DEFAULT_YELLOW_DURATION,
      spawnRate:      DEFAULT_SPAWN_RATE,
      carSpeed:       DEFAULT_CAR_SPEED,
      straightProb:   DEFAULT_STRAIGHT_PROB,
      leftProb:       DEFAULT_LEFT_PROB,
      rightProb:      DEFAULT_RIGHT_PROB,
      ...initialSettings,
    };

    // ── Sub-systems ────────────────────────────────────────────────────────
    this.lights = new TrafficLightController({
      greenDuration:  this.settings.greenDuration,
      yellowDuration: this.settings.yellowDuration,
    });

    this.cars        = [];
    this.pedestrians = [];

    // ── State ──────────────────────────────────────────────────────────────
    this.paused = false;
    this.time   = 0;   // total elapsed simulation time (seconds)

    // Per-approach spawn accumulators (fractional cars owed)
    this._spawnAccum = { NORTH: 0, SOUTH: 0, EAST: 0, WEST: 0 };

    // Pedestrian spawn accumulator
    this._pedAccum = 0;

    // ── Statistics ─────────────────────────────────────────────────────────
    this.stats = {
      carsPassed:      0,
      totalWaitTime:   0,
      carsWaited:      0,   // cars that waited (for avg calculation)
      maxWaitTime:     0,
    };
  }

  // ── Spawning ───────────────────────────────────────────────────────────────

  /** Spawn a single car from the given approach direction. */
  _spawnCar(origin) {
    // Don't spawn if there's already a car very close to the spawn point
    for (const c of this.cars) {
      if (c.origin !== origin) continue;
      if (c.state !== CAR_STATE.APPROACHING) continue;
      const spawnDist = this._spawnDistForOrigin(origin, c);
      if (spawnDist < CAR_SAFE_DISTANCE * 2) return;
    }
    const car     = new Car(origin, this.settings);
    car.spawnedAt = this.time;
    this.cars.push(car);
  }

  _spawnDistForOrigin(origin, car) {
    switch (origin) {
      case DIR.NORTH: return Math.abs(car.y - (-CAR_LENGTH));
      case DIR.SOUTH: return Math.abs(car.y - (CANVAS_HEIGHT + CAR_LENGTH));
      case DIR.EAST:  return Math.abs(car.x - (CANVAS_WIDTH + CAR_LENGTH));
      case DIR.WEST:  return Math.abs(car.x - (-CAR_LENGTH));
    }
    return Infinity;
  }

  _spawnPedestrian() {
    const crossings = [DIR.NORTH, DIR.SOUTH, DIR.EAST, DIR.WEST];
    const crossing  = randomFrom(crossings);
    // Limit active pedestrians to keep it tidy
    const activePeds = this.pedestrians.filter(p => p.crossing === crossing).length;
    if (activePeds >= 2) return;
    this.pedestrians.push(new Pedestrian(crossing));
  }

  // ── Update loop ────────────────────────────────────────────────────────────

  /**
   * Advance simulation by dt seconds.
   * @param {number} dt
   */
  update(dt) {
    if (this.paused) return;

    this.time += dt;

    // Update traffic lights
    this.lights.update(dt);

    // Sync light settings in case UI changed them
    this.lights.greenDuration  = this.settings.greenDuration;
    this.lights.yellowDuration = this.settings.yellowDuration;

    // ── Spawn cars ───────────────────────────────────────────────────────
    for (const dir of [DIR.NORTH, DIR.SOUTH, DIR.EAST, DIR.WEST]) {
      this._spawnAccum[dir] += this.settings.spawnRate * dt;
      while (this._spawnAccum[dir] >= 1) {
        this._spawnCar(dir);
        this._spawnAccum[dir] -= 1;
      }
    }

    // ── Spawn pedestrians ────────────────────────────────────────────────
    this._pedAccum += 0.3 * dt;  // roughly one pedestrian every 3 seconds across all crossings
    while (this._pedAccum >= 1) {
      this._spawnPedestrian();
      this._pedAccum -= 1;
    }

    // ── Update cars ──────────────────────────────────────────────────────
    // Snapshot the list so we can check _canEnterIntersection against the
    // list as it stood at the START of this frame.
    const snapshot = this.cars.slice();

    for (const car of snapshot) {
      car.update(dt, this.lights, snapshot, this.settings);
    }

    // Collect finished cars and record stats
    this.cars = this.cars.filter(car => {
      if (car.done) {
        this.stats.carsPassed++;
        if (car.waitTime > 0) {
          this.stats.totalWaitTime += car.waitTime;
          this.stats.carsWaited++;
          if (car.waitTime > this.stats.maxWaitTime) {
            this.stats.maxWaitTime = car.waitTime;
          }
        }
        return false;
      }
      return true;
    });

    // ── Update pedestrians ───────────────────────────────────────────────
    for (const ped of this.pedestrians) {
      ped.update(this.lights);
    }
    this.pedestrians = this.pedestrians.filter(p => !p.done);
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

  get avgWaitTime() {
    return this.stats.carsWaited > 0
      ? this.stats.totalWaitTime / this.stats.carsWaited
      : 0;
  }

  get carsWaiting() {
    return this.cars.filter(c => c.state === CAR_STATE.WAITING).length;
  }

  get carsActive() {
    return this.cars.length;
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  reset() {
    this.cars            = [];
    this.pedestrians     = [];
    this.time            = 0;
    this._spawnAccum     = { NORTH: 0, SOUTH: 0, EAST: 0, WEST: 0 };
    this._pedAccum       = 0;
    this.stats           = { carsPassed: 0, totalWaitTime: 0, carsWaited: 0, maxWaitTime: 0 };
    this.lights.reset();
    this.lights.greenDuration  = this.settings.greenDuration;
    this.lights.yellowDuration = this.settings.yellowDuration;
    resetCarIdCounter();
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  draw() {
    const { ctx } = this;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this._drawBackground(ctx);
    this._drawRoads(ctx);
    this._drawLaneMarkings(ctx);
    this._drawPedestrianCrossings(ctx);
    this._drawStopLines(ctx);
    this._drawIntersectionBox(ctx);
    this.lights.drawAll(ctx);

    // Pedestrians behind cars
    for (const ped of this.pedestrians) ped.draw(ctx);

    // Cars on top
    for (const car of this.cars) car.draw(ctx);

    this._drawDirectionLabels(ctx);
  }

  // ── Background (grass / environment) ──────────────────────────────────────

  _drawBackground(ctx) {
    ctx.fillStyle = '#2d4a1e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle grid / texture on grass
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth   = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke();
    }
  }

  // ── Road surfaces ──────────────────────────────────────────────────────────

  _drawRoads(ctx) {
    ctx.fillStyle = '#4a4a4a';

    // Vertical road (NS)
    ctx.fillRect(CENTER_X - ROAD_HALF_WIDTH, 0, ROAD_HALF_WIDTH * 2, CANVAS_HEIGHT);

    // Horizontal road (EW)
    ctx.fillRect(0, CENTER_Y - ROAD_HALF_WIDTH, CANVAS_WIDTH, ROAD_HALF_WIDTH * 2);

    // Kerb lines
    ctx.strokeStyle = '#666';
    ctx.lineWidth   = 1;
    // NS kerbs
    ctx.strokeRect(CENTER_X - ROAD_HALF_WIDTH, 0, ROAD_HALF_WIDTH * 2, CANVAS_HEIGHT);
    // EW kerbs
    ctx.strokeRect(0, CENTER_Y - ROAD_HALF_WIDTH, CANVAS_WIDTH, ROAD_HALF_WIDTH * 2);
  }

  // ── Dashed lane centre lines ───────────────────────────────────────────────

  _drawLaneMarkings(ctx) {
    ctx.strokeStyle = '#888';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([12, 10]);

    // Centre line of NS road (between northbound and southbound lanes)
    ctx.beginPath();
    ctx.moveTo(CENTER_X, 0);
    ctx.lineTo(CENTER_X, INT_TOP - 4);
    ctx.moveTo(CENTER_X, INT_BOTTOM + 4);
    ctx.lineTo(CENTER_X, CANVAS_HEIGHT);
    ctx.stroke();

    // Centre line of EW road
    ctx.beginPath();
    ctx.moveTo(0, CENTER_Y);
    ctx.lineTo(INT_LEFT - 4, CENTER_Y);
    ctx.moveTo(INT_RIGHT + 4, CENTER_Y);
    ctx.lineTo(CANVAS_WIDTH, CENTER_Y);
    ctx.stroke();

    ctx.setLineDash([]);
  }

  // ── Pedestrian crossings (zebra stripes) ───────────────────────────────────

  _drawPedestrianCrossings(ctx) {
    const stripeW = 6, stripeGap = 4;
    const roadHalf = ROAD_HALF_WIDTH;

    // North crossing: horizontal stripes across the NS road
    this._drawZebra(ctx,
      CENTER_X - roadHalf, PED_CROSS.NORTH - 6,
      roadHalf * 2, 12,
      'horizontal', stripeW, stripeGap);

    // South crossing
    this._drawZebra(ctx,
      CENTER_X - roadHalf, PED_CROSS.SOUTH - 6,
      roadHalf * 2, 12,
      'horizontal', stripeW, stripeGap);

    // East crossing: vertical stripes across the EW road
    this._drawZebra(ctx,
      PED_CROSS.EAST - 6, CENTER_Y - roadHalf,
      12, roadHalf * 2,
      'vertical', stripeW, stripeGap);

    // West crossing
    this._drawZebra(ctx,
      PED_CROSS.WEST - 6, CENTER_Y - roadHalf,
      12, roadHalf * 2,
      'vertical', stripeW, stripeGap);
  }

  _drawZebra(ctx, x, y, w, h, dir, stripeW, stripeGap) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const step = stripeW + stripeGap;
    if (dir === 'horizontal') {
      for (let sx = x; sx < x + w; sx += step) {
        ctx.fillRect(sx, y, stripeW, h);
      }
    } else {
      for (let sy = y; sy < y + h; sy += step) {
        ctx.fillRect(x, sy, w, stripeW);
      }
    }
  }

  // ── Stop lines ─────────────────────────────────────────────────────────────

  _drawStopLines(ctx) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 3;

    // North approach (SB lane) – white line at top of intersection
    ctx.beginPath();
    ctx.moveTo(CENTER_X, INT_TOP);
    ctx.lineTo(CENTER_X + ROAD_HALF_WIDTH, INT_TOP);
    ctx.stroke();

    // South approach (NB lane)
    ctx.beginPath();
    ctx.moveTo(CENTER_X - ROAD_HALF_WIDTH, INT_BOTTOM);
    ctx.lineTo(CENTER_X, INT_BOTTOM);
    ctx.stroke();

    // East approach (WB lane)
    ctx.beginPath();
    ctx.moveTo(INT_RIGHT, CENTER_Y - ROAD_HALF_WIDTH);
    ctx.lineTo(INT_RIGHT, CENTER_Y);
    ctx.stroke();

    // West approach (EB lane)
    ctx.beginPath();
    ctx.moveTo(INT_LEFT, CENTER_Y);
    ctx.lineTo(INT_LEFT, CENTER_Y + ROAD_HALF_WIDTH);
    ctx.stroke();
  }

  // ── Intersection box (slightly lighter tarmac) ─────────────────────────────

  _drawIntersectionBox(ctx) {
    ctx.fillStyle = '#555';
    ctx.fillRect(INT_LEFT, INT_TOP, INT_RIGHT - INT_LEFT, INT_BOTTOM - INT_TOP);

    // Subtle cross-hatch overlay to show box boundaries
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(INT_LEFT, INT_TOP, INT_RIGHT - INT_LEFT, INT_BOTTOM - INT_TOP);
  }

  // ── Direction labels at road ends ──────────────────────────────────────────

  _drawDirectionLabels(ctx) {
    ctx.fillStyle  = 'rgba(255,255,255,0.5)';
    ctx.font       = 'bold 13px sans-serif';
    ctx.textAlign  = 'center';

    ctx.fillText('N', CENTER_X, 18);
    ctx.fillText('S', CENTER_X, CANVAS_HEIGHT - 8);
    ctx.textAlign = 'left';
    ctx.fillText('W', 6, CENTER_Y + 5);
    ctx.textAlign = 'right';
    ctx.fillText('E', CANVAS_WIDTH - 6, CENTER_Y + 5);
    ctx.textAlign = 'center';
  }
}

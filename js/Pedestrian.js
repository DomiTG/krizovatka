'use strict';

/**
 * Pedestrian
 *
 * A simple pedestrian that waits at a kerb and crosses the road when
 * the perpendicular traffic is stopped (i.e., when their crossing is safe).
 *
 * NS crossings (top/bottom of intersection) are safe when NS = RED (EW phase).
 * EW crossings (left/right of intersection) are safe when EW = RED (NS phase).
 */
class Pedestrian {
  /**
   * @param {'NORTH'|'SOUTH'|'EAST'|'WEST'} crossing  which crossing
   */
  constructor(crossing) {
    this.crossing = crossing;  // which pedestrian crossing
    this.done     = false;
    this.color    = `hsl(${Math.random() * 360 | 0}, 70%, 65%)`;

    // Place the pedestrian at one kerb of the crossing
    this._initPosition();

    this.waiting    = true;   // waiting at kerb
    this.speed      = 0.8 + Math.random() * 0.4;  // px/frame
  }

  _initPosition() {
    // Each crossing straddles the road; pedestrians start on one side
    const side = Math.random() < 0.5 ? -1 : 1;

    switch (this.crossing) {
      case DIR.NORTH:
        // Crossing runs EW across the NS road, positioned above intersection
        this.x     = CENTER_X + side * (ROAD_HALF_WIDTH + 8);
        this.y     = PED_CROSS.NORTH;
        this.destX = CENTER_X - side * (ROAD_HALF_WIDTH + 8);
        this.destY = PED_CROSS.NORTH;
        break;
      case DIR.SOUTH:
        this.x     = CENTER_X + side * (ROAD_HALF_WIDTH + 8);
        this.y     = PED_CROSS.SOUTH;
        this.destX = CENTER_X - side * (ROAD_HALF_WIDTH + 8);
        this.destY = PED_CROSS.SOUTH;
        break;
      case DIR.EAST:
        // Crossing runs NS across the EW road, positioned right of intersection
        this.x     = PED_CROSS.EAST;
        this.y     = CENTER_Y + side * (ROAD_HALF_WIDTH + 8);
        this.destX = PED_CROSS.EAST;
        this.destY = CENTER_Y - side * (ROAD_HALF_WIDTH + 8);
        break;
      case DIR.WEST:
        this.x     = PED_CROSS.WEST;
        this.y     = CENTER_Y + side * (ROAD_HALF_WIDTH + 8);
        this.destX = PED_CROSS.WEST;
        this.destY = CENTER_Y - side * (ROAD_HALF_WIDTH + 8);
        break;
    }
  }

  /** Returns true if this pedestrian crossing is currently safe to use. */
  _isSafe(lightCtrl) {
    // NS crossings are safe when NS group = RED
    if (this.crossing === DIR.NORTH || this.crossing === DIR.SOUTH) {
      return lightCtrl.NS === LIGHT.RED;
    }
    // EW crossings are safe when EW group = RED
    return lightCtrl.EW === LIGHT.RED;
  }

  update(lightCtrl) {
    if (this.waiting) {
      if (this._isSafe(lightCtrl)) this.waiting = false;
      return;
    }

    // Walk toward destination
    const dx   = this.destX - this.x;
    const dy   = this.destY - this.y;
    const d    = Math.hypot(dx, dy);
    if (d < this.speed) {
      this.done = true;
    } else {
      this.x += (dx / d) * this.speed;
      this.y += (dy / d) * this.speed;
    }
  }

  draw(ctx) {
    ctx.save();

    // Simple dot-and-stick figure
    const r = 4;

    // Body shadow
    ctx.shadowColor  = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur   = 3;
    ctx.shadowOffsetY = 1;

    // Head
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y - r - 2, r, 0, Math.PI * 2);
    ctx.fill();

    // Body line
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - 2);
    ctx.lineTo(this.x, this.y + 5);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

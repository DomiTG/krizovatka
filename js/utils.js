'use strict';

// ─── Basic math helpers ───────────────────────────────────────────────────────

/** Linear interpolation */
function lerp(a, b, t) { return a + (b - a) * t; }

/** Euclidean distance */
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

/** Clamp value between min and max */
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ─── Bezier evaluation ────────────────────────────────────────────────────────

/**
 * Evaluate a bezier curve at parameter t (0..1).
 * @param {number} t
 * @param {{x:number,y:number}[]} pts  2 = linear, 3 = quadratic, 4 = cubic
 */
function bezierPoint(t, pts) {
  const mt = 1 - t;
  if (pts.length === 2) {
    return {
      x: lerp(pts[0].x, pts[1].x, t),
      y: lerp(pts[0].y, pts[1].y, t),
    };
  }
  if (pts.length === 3) {
    const [p0, p1, p2] = pts;
    return {
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    };
  }
  if (pts.length === 4) {
    const [p0, p1, p2, p3] = pts;
    return {
      x: mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
      y: mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y,
    };
  }
  throw new Error('bezierPoint: unsupported point count ' + pts.length);
}

/**
 * Tangent (derivative) of a bezier curve at t.
 * Returns an un-normalised direction vector {x, y}.
 */
function bezierTangent(t, pts) {
  const mt = 1 - t;
  if (pts.length === 2) {
    return { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y };
  }
  if (pts.length === 3) {
    const [p0, p1, p2] = pts;
    return {
      x: 2 * (mt * (p1.x - p0.x) + t * (p2.x - p1.x)),
      y: 2 * (mt * (p1.y - p0.y) + t * (p2.y - p1.y)),
    };
  }
  if (pts.length === 4) {
    const [p0, p1, p2, p3] = pts;
    return {
      x: 3 * (mt*mt*(p1.x-p0.x) + 2*mt*t*(p2.x-p1.x) + t*t*(p3.x-p2.x)),
      y: 3 * (mt*mt*(p1.y-p0.y) + 2*mt*t*(p2.y-p1.y) + t*t*(p3.y-p2.y)),
    };
  }
  throw new Error('bezierTangent: unsupported point count ' + pts.length);
}

/**
 * Approximate arc length of a bezier curve by sampling.
 * @param {{x:number,y:number}[]} pts
 * @param {number} [samples=24]
 */
function bezierLength(pts, samples = 24) {
  let len = 0;
  let prev = bezierPoint(0, pts);
  for (let i = 1; i <= samples; i++) {
    const curr = bezierPoint(i / samples, pts);
    len += dist(prev.x, prev.y, curr.x, curr.y);
    prev = curr;
  }
  return len;
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

/**
 * Draw a rounded rectangle path (no fill/stroke – caller does that).
 */
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,       y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y,         x + r,   y,         r);
  ctx.closePath();
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

/** Pick a random element from an array. */
function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/** Weighted random pick: weights must sum to 1. */
function weightedRandom(choices, weights) {
  let r = Math.random();
  for (let i = 0; i < choices.length; i++) {
    r -= weights[i];
    if (r <= 0) return choices[i];
  }
  return choices[choices.length - 1];
}

/** Format seconds as "m:ss" or "Xs" */
function formatTime(seconds) {
  if (seconds < 60) return seconds.toFixed(1) + 's';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

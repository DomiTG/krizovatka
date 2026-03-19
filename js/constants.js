'use strict';

// ─── Canvas ───────────────────────────────────────────────────────────────────
const CANVAS_WIDTH  = 700;
const CANVAS_HEIGHT = 700;

// ─── Road geometry ────────────────────────────────────────────────────────────
const CENTER_X        = 350;
const CENTER_Y        = 350;
const LANE_WIDTH      = 40;   // one lane wide
const ROAD_HALF_WIDTH = 40;   // half the total 2-lane road (= LANE_WIDTH)
const LANE_OFFSET     = 20;   // lane centreline offset from road centreline

// Lane centrelines (which x or y a car follows)
// Right-hand traffic: each driver keeps to the right, so SB is on the WEST (left)
// side of the NS road (lower x) and NB is on the EAST (right) side.
const SB_LANE_X = CENTER_X - LANE_OFFSET;  // 330 – southbound  (west/left of NS road)
const NB_LANE_X = CENTER_X + LANE_OFFSET;  // 370 – northbound  (east/right of NS road)
const EB_LANE_Y = CENTER_Y + LANE_OFFSET;  // 370 – eastbound   (bottom of EW road)
const WB_LANE_Y = CENTER_Y - LANE_OFFSET;  // 330 – westbound   (top    of EW road)

// Intersection bounding box
const INT_LEFT   = CENTER_X - ROAD_HALF_WIDTH;  // 310
const INT_RIGHT  = CENTER_X + ROAD_HALF_WIDTH;  // 390
const INT_TOP    = CENTER_Y - ROAD_HALF_WIDTH;  // 310
const INT_BOTTOM = CENTER_Y + ROAD_HALF_WIDTH;  // 390

// Where each approaching car enters the intersection box
const ENTRY = {
  NORTH: { x: SB_LANE_X, y: INT_TOP    },  // (330,310) southbound car enters from top
  SOUTH: { x: NB_LANE_X, y: INT_BOTTOM },  // (370,390) northbound car enters from bottom
  EAST:  { x: INT_RIGHT,  y: WB_LANE_Y },  // (390,330) westbound  car enters from right
  WEST:  { x: INT_LEFT,   y: EB_LANE_Y },  // (310,370) eastbound  car enters from left
};

// Where cars exit the intersection box for each exit direction
const EXIT = {
  SOUTH: { x: SB_LANE_X, y: INT_BOTTOM },  // (330,390)
  NORTH: { x: NB_LANE_X, y: INT_TOP    },  // (370,310)
  EAST:  { x: INT_RIGHT,  y: EB_LANE_Y },  // (390,370)
  WEST:  { x: INT_LEFT,   y: WB_LANE_Y },  // (310,330)
};

// Stop-line positions (the coordinate at which a car waits for red)
const STOP_LINE = {
  NORTH: INT_TOP,     // y = 310  (southbound cars stop before INT_TOP)
  SOUTH: INT_BOTTOM,  // y = 390
  EAST:  INT_RIGHT,   // x = 390
  WEST:  INT_LEFT,    // x = 310
};

// ─── Car ──────────────────────────────────────────────────────────────────────
const CAR_LENGTH        = 18;
const CAR_WIDTH         = 10;
const CAR_BASE_SPEED    = 2.5;  // px per frame at 60 fps
const CAR_SAFE_DISTANCE = 32;   // min gap between car fronts in a queue

// ─── Traffic light defaults (seconds) ─────────────────────────────────────────
const DEFAULT_GREEN_DURATION  = 15;
const DEFAULT_YELLOW_DURATION = 3;

// ─── Simulation defaults ──────────────────────────────────────────────────────
const DEFAULT_SPAWN_RATE  = 0.4;  // cars / second / approach
const DEFAULT_CAR_SPEED   = 2.5;
const DEFAULT_STRAIGHT_PROB = 0.60;
const DEFAULT_LEFT_PROB     = 0.20;
const DEFAULT_RIGHT_PROB    = 0.20;

// Max traversing cars allowed simultaneously in the intersection
const MAX_IN_INTERSECTION = 6;

// ─── Direction / state enums ──────────────────────────────────────────────────
const DIR = Object.freeze({ NORTH:'NORTH', SOUTH:'SOUTH', EAST:'EAST', WEST:'WEST' });
const TURN = Object.freeze({ STRAIGHT:'STRAIGHT', LEFT:'LEFT', RIGHT:'RIGHT' });
const CAR_STATE = Object.freeze({
  APPROACHING: 'APPROACHING',
  WAITING:     'WAITING',
  TRAVERSING:  'TRAVERSING',
  EXITING:     'EXITING',
});
const LIGHT = Object.freeze({ GREEN:'GREEN', YELLOW:'YELLOW', RED:'RED' });

// ─── Bezier paths through the intersection ────────────────────────────────────
// Each path is an array of points fed to bezierPoint():
//   2 points → linear,  3 points → quadratic,  4 points → cubic
//
// Convention (standard right-hand traffic):
//   Facing SOUTH  → RIGHT = WEST,  LEFT = EAST
//   Facing NORTH  → RIGHT = EAST,  LEFT = WEST
//   Facing EAST   → RIGHT = SOUTH, LEFT = NORTH
//   Facing WEST   → RIGHT = NORTH, LEFT = SOUTH
const INTERSECTION_PATHS = {
  // ── FROM NORTH  (car going south, enters at (330,310)) ──────────────────
  'NORTH-STRAIGHT': [
    { x: SB_LANE_X, y: INT_TOP    },   // entry  (330,310)
    { x: SB_LANE_X, y: INT_BOTTOM },   // exit S (330,390)
  ],
  'NORTH-RIGHT': [   // turn west
    { x: SB_LANE_X, y: INT_TOP    },   // (330,310)
    { x: SB_LANE_X, y: WB_LANE_Y  },   // CP  (330,330) – go slightly south first
    { x: INT_LEFT,  y: WB_LANE_Y  },   // exit W (310,330)
  ],
  'NORTH-LEFT': [    // turn east – quadratic arc: start heading south, exit heading east
    { x: SB_LANE_X, y: INT_TOP    },   // entry (330,310)
    { x: SB_LANE_X, y: EB_LANE_Y  },   // CP    (330,370) – anchors south-then-east curve
    { x: INT_RIGHT, y: EB_LANE_Y  },   // exit E (390,370)
  ],

  // ── FROM SOUTH  (car going north, enters at (370,390)) ──────────────────
  'SOUTH-STRAIGHT': [
    { x: NB_LANE_X, y: INT_BOTTOM },
    { x: NB_LANE_X, y: INT_TOP    },
  ],
  'SOUTH-RIGHT': [   // turn east
    { x: NB_LANE_X, y: INT_BOTTOM },   // (370,390)
    { x: NB_LANE_X, y: EB_LANE_Y  },   // CP  (370,370)
    { x: INT_RIGHT, y: EB_LANE_Y  },   // exit E (390,370)
  ],
  'SOUTH-LEFT': [    // turn west – quadratic arc: start heading north, exit heading west
    { x: NB_LANE_X, y: INT_BOTTOM },   // entry (370,390)
    { x: NB_LANE_X, y: WB_LANE_Y  },   // CP    (370,330) – anchors north-then-west curve
    { x: INT_LEFT,  y: WB_LANE_Y  },   // exit W (310,330)
  ],

  // ── FROM EAST   (car going west, enters at (390,330)) ───────────────────
  'EAST-STRAIGHT': [
    { x: INT_RIGHT, y: WB_LANE_Y  },
    { x: INT_LEFT,  y: WB_LANE_Y  },
  ],
  'EAST-RIGHT': [    // turn north
    { x: INT_RIGHT,  y: WB_LANE_Y  },   // (390,330)
    { x: NB_LANE_X,  y: WB_LANE_Y  },   // CP  (330,330)
    { x: NB_LANE_X,  y: INT_TOP    },   // exit N (330,310)
  ],
  'EAST-LEFT': [     // turn south – quadratic arc: start heading west, exit heading south
    { x: INT_RIGHT, y: WB_LANE_Y  },   // entry (390,330)
    { x: SB_LANE_X, y: WB_LANE_Y  },   // CP    (370,330) – anchors west-then-south curve
    { x: SB_LANE_X, y: INT_BOTTOM },   // exit S (370,390)
  ],

  // ── FROM WEST   (car going east, enters at (310,370)) ───────────────────
  'WEST-STRAIGHT': [
    { x: INT_LEFT,  y: EB_LANE_Y  },
    { x: INT_RIGHT, y: EB_LANE_Y  },
  ],
  'WEST-RIGHT': [    // turn south
    { x: INT_LEFT,  y: EB_LANE_Y  },    // (310,370)
    { x: SB_LANE_X, y: EB_LANE_Y  },    // CP  (370,370)
    { x: SB_LANE_X, y: INT_BOTTOM },    // exit S (370,390)
  ],
  'WEST-LEFT': [     // turn north – quadratic arc: start heading east, exit heading north
    { x: INT_LEFT,  y: EB_LANE_Y  },   // entry (310,370)
    { x: NB_LANE_X, y: EB_LANE_Y  },   // CP    (330,370) – anchors east-then-north curve
    { x: NB_LANE_X, y: INT_TOP    },   // exit N (330,310)
  ],
};

// After exiting the intersection, where the car heads (off-screen endpoint)
const EXIT_DIRECTIONS = {
  'NORTH-STRAIGHT': { dir: DIR.SOUTH, endX: SB_LANE_X,          endY: CANVAS_HEIGHT + 40 },
  'NORTH-RIGHT':    { dir: DIR.WEST,  endX: -40,                 endY: WB_LANE_Y          },
  'NORTH-LEFT':     { dir: DIR.EAST,  endX: CANVAS_WIDTH  + 40,  endY: EB_LANE_Y          },

  'SOUTH-STRAIGHT': { dir: DIR.NORTH, endX: NB_LANE_X,          endY: -40                },
  'SOUTH-RIGHT':    { dir: DIR.EAST,  endX: CANVAS_WIDTH  + 40,  endY: EB_LANE_Y          },
  'SOUTH-LEFT':     { dir: DIR.WEST,  endX: -40,                 endY: WB_LANE_Y          },

  'EAST-STRAIGHT':  { dir: DIR.WEST,  endX: -40,                 endY: WB_LANE_Y          },
  'EAST-RIGHT':     { dir: DIR.NORTH, endX: NB_LANE_X,           endY: -40                },
  'EAST-LEFT':      { dir: DIR.SOUTH, endX: SB_LANE_X,           endY: CANVAS_HEIGHT + 40 },

  'WEST-STRAIGHT':  { dir: DIR.EAST,  endX: CANVAS_WIDTH  + 40,  endY: EB_LANE_Y          },
  'WEST-RIGHT':     { dir: DIR.SOUTH, endX: SB_LANE_X,           endY: CANVAS_HEIGHT + 40 },
  'WEST-LEFT':      { dir: DIR.NORTH, endX: NB_LANE_X,           endY: -40                },
};

// Car colours palette
const CAR_COLORS = [
  '#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c',
  '#3498db','#9b59b6','#e91e63','#00bcd4','#ff5722',
  '#8bc34a','#ff9800','#607d8b','#795548','#673ab7',
];

// Pedestrian crossing stripe positions (y for NS road, x for EW road)
const PED_CROSS = {
  NORTH: INT_TOP    - 18,   // crossing above intersection on NS road
  SOUTH: INT_BOTTOM + 18,   // crossing below
  EAST:  INT_RIGHT  + 18,   // crossing right of intersection on EW road
  WEST:  INT_LEFT   - 18,   // crossing left
};

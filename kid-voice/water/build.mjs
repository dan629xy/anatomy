import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import { checkNarration, loadNarration } from "./check-narration.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const narration = loadNarration();
const errors = checkNarration(narration);
if (errors.length) {
  console.error("narration check failed:");
  for (const line of errors) console.error("  " + line);
  process.exit(1);
}

function maybeVoice() {
  if (process.env.MIMO_API_KEY) {
    console.log("MIMO_API_KEY is set; this sample still skips mimo-v2.5-tts (subtitles stand in).");
    return;
  }
  console.log("no MIMO_API_KEY: skip voice preview; page still works offline with subtitles.");
}

const WIDTH = 600;
const HEIGHT = 430;

const PLATE = { x: -142, y: -80, w: 298, d: 172, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const FLOOR = { x: -46, y: -40, w: 92, d: 74, r: 3 };
const FLOOR_H = 7;
const BACK = { x: -54, y: -50, w: 108, d: 10, r: 2 };
const LEFT = { x: -54, y: -40, w: 10, d: 84, r: 2 };
const RIGHT = { x: 44, y: -40, w: 10, d: 84, r: 2 };
const FRONT = { x: -54, y: 34, w: 108, d: 10, r: 2 };
const WALL_H = 54;
const FRONT_H = 22;

const MACHINES = [
  { x: -36, y: -22, w: 24, d: 20, r: 1.6, h: 18 },
  { x: -6, y: -26, w: 22, d: 24, r: 1.6, h: 24 },
  { x: 20, y: -18, w: 20, d: 18, r: 1.6, h: 16 },
];

const HOP = [0, -8];
const POST_L = [-60, -8];
const POST_R = [60, -8];
const POST_TOP = 92;
const BEAM = { x: -64, y: -12, w: 128, d: 8, r: 2 };
const BEAM_Z = 86;

const RAIL = { x: -32, y: 26, w: 64, d: 8, r: 1.2 };
const RAIL_Z = FRONT_H;
const RAIL_H = 4;
const TANK_Y = 30;
const TANK_Z = RAIL_Z + RAIL_H;

const TROUGH = { x: -42, y: 48, w: 84, d: 22, r: 3 };
const TROUGH_H = 9;
const PAN = { x: 90, y: 14, w: 44, d: 44, r: 4 };
const PAN_H = 8;
const BEAKER = [-114, 2];
const VENT = [-40, -28];

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [POST_L[0], POST_L[1], POST_TOP + 8],
    [POST_R[0], POST_R[1], POST_TOP + 8],
    [HOP[0], HOP[1], 108],
    [VENT[0], VENT[1], WALL_H + 50],
    [PAN.x + PAN.w, PAN.y + PAN.d, PAN_H],
    [BEAKER[0] - 14, BEAKER[1] - 14, 36],
    [TROUGH.x + TROUGH.w, TROUGH.y + TROUGH.d, TROUGH_H],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 48, elevation: 34 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const piece = (id, svg) => `<g class="it" data-piece="${id}">${svg}</g>`;
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function screws(plan, z, inset = 8, size = 0.45) {
  const pts = k.corners(plan, inset);
  return L(pts.map(([x, y]) => k.ring(x, y, 2.1, z, P, 14)).join(""), { tone: "lo" }) + D(pts.map(([x, y]) => at([x, y, z])), { size });
}

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  out.push(screws(PLATE, 0, 10, 0.5));
  const strip = { x: -120, y: PLATE.y + PLATE.d - 14, w: 236, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  const label = { x: -128, y: -66, w: 36, d: 16, r: 1.4 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }));
  out.push(L([k.lineOnTop([label.x + 4, label.y + 5], [label.x + 28, label.y + 5], 0.8, P), k.lineOnTop([label.x + 4, label.y + 8.2], [label.x + 24, label.y + 8.2], 0.8, P), k.lineOnTop([label.x + 4, label.y + 11.4], [label.x + 18, label.y + 11.4], 0.8, P)].join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 4, label.y + 3, 0.8]), at([label.x + label.w - 4, label.y + 3, 0.8])], { size: 0.4 }));
  const grid = [];
  for (let x = -96; x <= 96; x += 24) grid.push(k.lineOnTop([x, -52], [x, 28], 0, P));
  for (let y = -52; y <= 28; y += 20) grid.push(k.lineOnTop([-96, y], [96, y], 0, P));
  out.push(L(grid.join(""), { tone: "faint" }));
  return out.join("");
}

function beaker() {
  const [x, y] = BEAKER;
  const out = [];
  const stand = { x: x - 16, y: y - 16, w: 32, d: 32, r: 3 };
  out.push(S(k.slabOf(stand, 0, 3, P, 5, 0.5), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(stand, 3), 3, P), { tone: "faint" }));
  out.push(D(k.corners(stand, 6).map(([px, py]) => at([px, py, 3])), { size: 0.4 }));
  out.push(S(k.cylinder(x, y, 13, 3, 2.4, P, 28), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 11, 5.4, 24, P, 32, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.sideArc(x, y, 11, 14, P, 18), { tone: "faint" }));
  out.push(L(k.sideArc(x, y, 11, 22, P, 18), { tone: "faint" }));
  out.push(S(k.cylinder(x, y, 7, 29.4, 6, P, 24), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, 9, 35.4, 3, P, 24, 0.4), { tone: "hi" }));
  out.push(L(k.ring(x, y, 7.4, 35.4, P, 24), { tone: "lo" }));
  const ticks = k.sideTicks(y - 7, y + 7, 3.5, 2, x + 11, 26, [1.4, 2.6], P, "y");
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

function feed() {
  const out = [];
  const pipe = { x: BEAKER[0] + 11, y: BEAKER[1] - 2.2, w: HOP[0] - 18 - (BEAKER[0] + 11), d: 4.4, r: 2 };
  out.push(S(k.cylinder(BEAKER[0] + 11, BEAKER[1], 3.2, 16, 6, P, 16), { tone: "mid" }));
  out.push(S(k.slabOf(pipe, 17, 4.4, P, 4, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(-18, HOP[1], 3.2, 18, 38, P, 16), { tone: "mid", crease: "none" }));
  out.push(L(k.sideArc(-18, HOP[1], 3.2, 36, P, 12), { tone: "faint" }));
  out.push(k.wireSvg(at([BEAKER[0] + 11, BEAKER[1], 19]), at([-18, HOP[1], 19]), { tone: "lo", flow: true, ends: "both", size: 1.1 }));
  return out.join("");
}

function vatBack() {
  const out = [];
  out.push(S(k.slabOf(BACK, 0, WALL_H, P, 5, 0.7), { tone: "mid" }));
  out.push(L(k.sideSeam(BACK, 18, P, 5), { tone: "faint" }));
  out.push(L(k.sideSeam(BACK, 36, P, 5), { tone: "faint" }));
  out.push(screws(BACK, WALL_H, 6, 0.4));
  const cap = { x: BACK.x + 4, y: BACK.y + 1, w: BACK.w - 8, d: BACK.d - 2, r: 1.2 };
  out.push(S(k.slabOf(cap, WALL_H, 2.4, P, 4, 0.3), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf(LEFT, 0, WALL_H, P, 5, 0.7), { tone: "mid" }));
  out.push(L(k.sideSeam(LEFT, 18, P, 5), { tone: "faint" }));
  out.push(L(k.sideSeam(LEFT, 36, P, 5), { tone: "faint" }));
  out.push(D([-32, -12, 8].map((y) => at([LEFT.x + 5, y, WALL_H])), { size: 0.4, tone: "lo" }));
  return out.join("");
}

function vent() {
  const [x, y] = VENT;
  const out = [];
  out.push(S(k.cylinder(x, y, 8, WALL_H, 3.2, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 5.6, WALL_H + 3.2, 26, P, 24, 0.4), { tone: "hi", crease: "none" }));
  out.push(L([WALL_H + 10, WALL_H + 18, WALL_H + 24].map((z) => k.sideArc(x, y, 5.6, z, P, 14)).join(""), { tone: "faint" }));
  out.push(S(k.cylinder(x, y, 8.2, WALL_H + 29.2, 3.4, P, 24, 0.4), { tone: "mid" }));
  out.push(L(k.knurl(x, y, 8.2, WALL_H + 29.2, WALL_H + 32.6, 24, P, 0.3), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 2.4, WALL_H + 32.6, 5, P, 14), { tone: "hi", crease: "none" }));
  out.push(D([at([x, y, WALL_H + 37.6])], { size: 0.6, tone: "hi", pulse: true }));
  out.push(k.wireSvg(at([x, y, WALL_H + 37.6]), at([x - 8, y - 10, WALL_H + 48]), { via: [at([x - 4, y - 6, WALL_H + 44])], tone: "faint", dotted: true, ends: "to", size: 0.9 }));
  out.push(k.wireSvg(at([x, y, WALL_H + 37.6]), at([x + 6, y - 12, WALL_H + 46]), { via: [at([x + 3, y - 7, WALL_H + 43])], tone: "faint", dotted: true, ends: "to", size: 0.8 }));
  return out.join("");
}

function floorAndMachines() {
  const out = [];
  out.push(S(k.slabOf(FLOOR, 0, FLOOR_H, P, 5, 0.6), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(FLOOR, 4), FLOOR_H, P), { tone: "faint" }));
  out.push(D(k.dotGrid(FLOOR.x + 8, FLOOR.y + 8, 6, 4, 12, FLOOR_H, P), { size: 0.35, tone: "lo" }));
  MACHINES.forEach((plan, index) => {
    const box = { x: plan.x, y: plan.y, w: plan.w, d: plan.d, r: plan.r };
    out.push(S(k.slabOf(box, FLOOR_H, plan.h, P, 4, 0.5), { tone: "hi", crease: "lo" }));
    out.push(L(k.planOutline(k.insetPlan(box, 2), FLOOR_H + plan.h, P, 3), { tone: "faint" }));
    const cx = plan.x + plan.w / 2;
    const cy = plan.y + plan.d / 2;
    out.push(S(k.cylinder(cx, cy, 4.2, FLOOR_H + plan.h, 5, P, 18), { tone: "mid" }));
    out.push(L(k.knurl(cx, cy, 4.2, FLOOR_H + plan.h, FLOOR_H + plan.h + 5, 16, P), { tone: "lo" }));
    out.push(D(k.dotGrid(plan.x + 4, plan.y + 4, 3, 2, 5.5, FLOOR_H + plan.h, P), { size: 0.42, tone: "hi", pulse: true }));
    out.push(D([at([plan.x + 3, plan.y + 3, FLOOR_H + plan.h]), at([plan.x + plan.w - 3, plan.y + 3, FLOOR_H + plan.h])], { size: 0.4 }));
    if (index === 1) {
      out.push(S(k.slabOf({ x: cx - 2, y: plan.y + plan.d - 1, w: 4, d: 5, r: 1 }, FLOOR_H + 6, 4, P, 2), { tone: "mid", crease: "none" }));
    }
  });
  return out.join("");
}

function gantryBack() {
  const out = [];
  out.push(S(k.cylinder(POST_L[0], POST_L[1], 6, 0, 4, P, 20), { tone: "lo" }));
  out.push(S(k.cylinder(POST_L[0], POST_L[1], 4.2, 4, POST_TOP - 4, P, 20), { tone: "mid", crease: "none" }));
  out.push(L([28, 52, 74].map((z) => k.sideArc(POST_L[0], POST_L[1], 4.2, z, P, 12)).join(""), { tone: "faint" }));
  const clamp = { x: POST_L[0] - 7, y: POST_L[1] - 7, w: 14, d: 14, r: 2 };
  out.push(S(k.slabOf(clamp, BEAM_Z - 4, 10, P, 4, 0.5), { tone: "mid" }));
  out.push(screws(clamp, BEAM_Z + 6, 4, 0.35));
  out.push(S(k.slabOf(BEAM, BEAM_Z, 6, P, 5, 0.5), { tone: "mid" }));
  out.push(L(k.lineOnTop([BEAM.x + 8, BEAM.y + 4], [BEAM.x + BEAM.w - 8, BEAM.y + 4], BEAM_Z + 6, P), { tone: "faint" }));
  out.push(D([-40, -16, 16, 40].map((x) => at([x, BEAM.y + 4, BEAM_Z + 6])), { size: 0.4, tone: "lo" }));
  return out.join("");
}

function hopper() {
  const [x, y] = HOP;
  const out = [];
  out.push(S(k.cylinder(x, y, 6, 54, 4, P, 20), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 4.4, 58, 22, P, 20), { tone: "hi", crease: "none" }));
  out.push(L(k.sideArc(x, y, 4.4, 68, P, 12), { tone: "faint" }));
  out.push(S(k.cylinder(x, y, 15, 78, 16, P, 32, 0.7), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, 15, 90, 94, 40, P, 0.35), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, 15, 90, P, 22), { tone: "faint" }));
  out.push(L(k.ring(x, y, 12.6, 94, P, 32), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 17, 94, 3.2, P, 32, 0.4), { tone: "mid" }));
  out.push(L(k.ring(x, y, 13, 97.2, P, 28), { tone: "hi" }));
  const handle = { x: x + 14, y: y - 2.2, w: 10, d: 4.4, r: 1.4 };
  out.push(S(k.slabOf(handle, 84, 4, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: x + 20, y: y - 2.2, w: 4, d: 4.4, r: 1.2 }, 78, 10, P, 3, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 3.4, 97.2, 5, P, 16), { tone: "mid" }));
  out.push(L(k.knurl(x, y, 3.4, 97.2, 102.2, 14, P), { tone: "lo" }));
  out.push(D([at([x, y, 102.2])], { size: 0.5, tone: "hi" }));
  return `<g data-part="hopper">${out.join("")}</g>`;
}

function gantryFront() {
  const out = [];
  out.push(S(k.cylinder(POST_R[0], POST_R[1], 6, 0, 4, P, 20), { tone: "lo" }));
  out.push(S(k.cylinder(POST_R[0], POST_R[1], 4.2, 4, POST_TOP - 4, P, 20), { tone: "mid", crease: "none" }));
  out.push(L([28, 52, 74].map((z) => k.sideArc(POST_R[0], POST_R[1], 4.2, z, P, 12)).join(""), { tone: "faint" }));
  const clamp = { x: POST_R[0] - 7, y: POST_R[1] - 7, w: 14, d: 14, r: 2 };
  out.push(S(k.slabOf(clamp, BEAM_Z - 4, 10, P, 4, 0.5), { tone: "mid" }));
  const thumb = [clamp.x + 7, clamp.y + clamp.d + 3];
  out.push(S(k.slabOf({ x: thumb[0] - 1.4, y: clamp.y + clamp.d, w: 2.8, d: 3, r: 0.8 }, BEAM_Z + 1, 4, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(thumb[0], thumb[1] + 1.2, 2.6, BEAM_Z, 6, P, 16), { tone: "mid" }));
  out.push(L(k.knurl(thumb[0], thumb[1] + 1.2, 2.6, BEAM_Z, BEAM_Z + 6, 14, P), { tone: "lo" }));
  return out.join("");
}

function tankAt(originX) {
  const y = TANK_Y;
  const z = TANK_Z;
  const chassis = { x: originX - 9, y: y - 5, w: 18, d: 10, r: 1.4 };
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(chassis, 2), z, 0.1, P)}" style="filter:blur(3px)"/>`];
  out.push(S(k.slabOf(chassis, z, 3.2, P, 3, 0.4), { tone: "mid" }));
  out.push(D([-5, 5].map((dx) => at([originX + dx, y + 4.2, z])), { size: 0.35, tone: "lo" }));
  out.push(S(k.cylinder(originX, y, 7.2, z + 3.2, 13, P, 24, 0.5), { tone: "hi", crease: "lo" }));
  out.push(L(k.sideArc(originX, y, 7.2, z + 10, P, 14), { tone: "faint" }));
  out.push(S(k.cylinder(originX, y, 5.2, z + 16.2, 3.2, P, 18), { tone: "mid" }));
  out.push(L(k.ring(originX, y, 3.6, z + 19.4, P, 16), { tone: "hi" }));
  out.push(D([at([originX, y, z + 19.4])], { size: 0.5, tone: "hi", pulse: true }));
  return out.join("");
}

function courier() {
  const out = [];
  out.push(S(k.slabOf(RAIL, RAIL_Z, RAIL_H, P, 3, 0.4), { tone: "mid" }));
  out.push(D([RAIL.x + 6, RAIL.x + RAIL.w - 6].map((x) => at([x, RAIL.y + 3.5, RAIL_Z + RAIL_H])), { size: 0.4 }));
  for (const x of [RAIL.x - 4, RAIL.x + RAIL.w]) {
    out.push(S(k.slabOf({ x, y: RAIL.y - 2, w: 4, d: 11, r: 1 }, RAIL_Z, 7, P, 3, 0.3), { tone: "mid" }));
  }
  out.push(`<g data-part="drop-a">${tankAt(-12)}</g>`);
  out.push(`<g data-part="drop-b">${tankAt(12)}</g>`);
  return out.join("");
}

function vatFront() {
  const out = [];
  out.push(S(k.slabOf(RIGHT, 0, WALL_H, P, 5, 0.7), { tone: "mid" }));
  out.push(L(k.sideSeam(RIGHT, 18, P, 5), { tone: "faint" }));
  out.push(L(k.sideSeam(RIGHT, 36, P, 5), { tone: "faint" }));
  const glass = { x: 45.2, y: -10, w: 3.2, d: 12, r: 0.8 };
  out.push(S(k.slabOf(glass, 14, 28, P, 3, 0.3), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf({ x: 45.5, y: -9, w: 2.6, d: 10, r: 0.6 }, 14, 16, P, 3), { tone: "hi", flat: true }));
  out.push(L(k.planOutline(k.insetPlan(glass, 0.4), 42, P, 3), { tone: "lo" }));
  const dial = [49, 16];
  out.push(S(k.cylinder(dial[0], dial[1], 7.5, 28, 4, P, 28, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(dial[0], dial[1], 6, 32, P, 24), { tone: "lo" }));
  const ticks = k.radialTicks(dial[0], dial[1], 5.6, 12, 3, 32, [1, 2.1], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.lineOnTop([dial[0], dial[1]], [dial[0] + 3.2, dial[1] - 2.4], 32.2, P), { tone: "hi" }));
  out.push(S(k.slabOf(FRONT, 0, FRONT_H, P, 5, 0.7), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(FRONT, 2), FRONT_H, P), { tone: "faint" }));
  out.push(screws(FRONT, FRONT_H, 8, 0.4));
  const sill = { x: FRONT.x + 8, y: FRONT.y + 2, w: FRONT.w - 16, d: 6, r: 1 };
  out.push(S(k.slabOf(sill, FRONT_H, 2, P, 4, 0.3), { tone: "lo", crease: "none" }));
  return out.join("");
}

function trough() {
  const out = [];
  out.push(S(k.slabOf(TROUGH, 0, TROUGH_H, P, 5, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(TROUGH, 3), TROUGH_H, P), { tone: "faint" }));
  const inner = k.insetPlan(TROUGH, 4);
  out.push(S(k.slabOf(inner, 2, 4, P, 4), { tone: "lo", flat: true }));
  const bars = [];
  for (let x = TROUGH.x + 10; x < TROUGH.x + TROUGH.w - 8; x += 6) {
    bars.push(k.lineOnTop([x, TROUGH.y + 4], [x, TROUGH.y + TROUGH.d - 4], TROUGH_H, P));
  }
  out.push(L(bars.join(""), { tone: "mid" }));
  const flow = [
    k.lineOnTop([TROUGH.x + 8, TROUGH.y + 8], [TROUGH.x + TROUGH.w - 10, TROUGH.y + 8], 6.4, P),
    k.lineOnTop([TROUGH.x + 10, TROUGH.y + 12], [TROUGH.x + TROUGH.w - 8, TROUGH.y + 12], 6.4, P),
    k.lineOnTop([TROUGH.x + 8, TROUGH.y + 16], [TROUGH.x + TROUGH.w - 12, TROUGH.y + 16], 6.4, P),
  ];
  out.push(L(flow.join(""), { tone: "hi", flow: true }));
  const dirt = { x: TROUGH.x + 8, y: TROUGH.y + 6, w: 10, d: 8, r: 1 };
  out.push(S(k.slabOf(dirt, 6.2, 3, P, 3, 0.3), { tone: "lo" }));
  out.push(S(k.slabOf({ x: TROUGH.x + 14, y: TROUGH.y + 8, w: 7, d: 6, r: 1 }, 6.2, 2.2, P, 3, 0.3), { tone: "lo" }));
  return out.join("");
}

function drain() {
  const out = [];
  const pipe = { x: TROUGH.x + TROUGH.w - 4, y: TROUGH.y + 8, w: PAN.x - (TROUGH.x + TROUGH.w) + 8, d: 6, r: 2 };
  out.push(S(k.cylinder(TROUGH.x + TROUGH.w - 2, TROUGH.y + 11, 4, 2, 6, P, 16), { tone: "mid" }));
  out.push(S(k.slabOf(pipe, 3, 6, P, 4, 0.4), { tone: "mid" }));
  const valve = [pipe.x + pipe.w * 0.45, pipe.y + 3];
  out.push(S(k.cylinder(valve[0], valve[1], 6, 2, 10, P, 20, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(valve[0], valve[1], 6, 8, 12, 18, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([valve[0] - 3, valve[1]], [valve[0] + 4, valve[1]], 12, P), { tone: "hi" }));
  out.push(S(k.cylinder(PAN.x + 2, TROUGH.y + 11, 4.4, 2, 7, P, 16), { tone: "mid" }));
  out.push(`<path class="iso-halo" d="${k.haloOf(PAN, 0, 0.1, P)}" style="filter:blur(5px)"/>`);
  out.push(S(k.slabOf(PAN, 0, PAN_H, P, 5, 0.7), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(PAN, 4), PAN_H, P), { tone: "faint" }));
  out.push(S(k.slabOf(k.insetPlan(PAN, 5), 1.6, 3.4, P, 4), { tone: "lo", flat: true }));
  out.push(screws(PAN, PAN_H, 7, 0.4));
  const drip = k.lineOnTop([PAN.x + 22, PAN.y + 18], [PAN.x + 22, PAN.y + 26], PAN_H + 6, P);
  out.push(L(drip, { tone: "hi", flow: true }));
  out.push(D([at([PAN.x + 22, PAN.y + 22, PAN_H + 1])], { size: 0.55, tone: "hi", pulse: true }));
  return out.join("");
}

function hits() {
  const spots = [
    ["mouth", [HOP[0], HOP[1], 92], 28],
    ["factory", [0, -4, 28], 36],
    ["courier", [0, TANK_Y, TANK_Z + 10], 24],
    ["flush", [0, TROUGH.y + 10, 8], 26],
    ["exit", [VENT[0], VENT[1], WALL_H + 16], 20],
    ["exit", [PAN.x + 22, PAN.y + 22, 10], 22],
  ];
  return `<g class="kv-hits">${spots
    .map(([id, point, r]) => {
      const [cx, cy] = at(point);
      return `<circle data-piece="${id}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="transparent"/>`;
    })
    .join("")}</g>`;
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "一座小小身体工厂。头顶的小嘴巴把水接进来，肚子里的小机器要喝水，水滴快递员在轨道上送水，前面的水槽把脏东西冲走，出汗的烟囱和旁边的水盆是水跑出去的门。",
  className: "kv-svg",
  body: [
    plate(),
    beaker(),
    feed(),
    piece("factory", vatBack()),
    piece("exit", vent()),
    piece("factory", floorAndMachines()),
    gantryBack(),
    piece("mouth", hopper()),
    piece("factory", vatFront()),
    piece("courier", courier()),
    gantryFront(),
    piece("flush", trough()),
    piece("exit", drain()),
    hits(),
  ],
});

const KID_CSS = `
.kv-top{display:flex;justify-content:center;margin:0 0 22px}
.kv-listen{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:58px;padding:0 38px;border:0;border-radius:999px;background:var(--anatomy-face);color:var(--anatomy-strong);font:650 22px/1 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.08em;cursor:pointer;box-shadow:var(--anatomy-lift)}
.kv-listen:hover{color:var(--anatomy-hi)}
.kv-listen:active{transform:scale(.98)}
.kv-listen:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:4px}
.kv-listen[data-on]{box-shadow:inset 0 0 0 1px var(--anatomy-hi),var(--anatomy-lift)}
.kv-lamp{width:9px;height:9px;border-radius:50%;background:var(--anatomy-lo);box-shadow:0 0 0 0 transparent}
.kv-listen[data-on] .kv-lamp{background:var(--anatomy-lit);box-shadow:0 0 10px 2px var(--anatomy-hi)}
.kv-stage{touch-action:pan-y;outline:none}
.kv-stage:focus{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.kv-say{display:block;margin:14px 8px 36px;text-align:center;font-size:clamp(22px,4.4vw,30px);line-height:1.4;font-weight:650;color:var(--anatomy-strong);min-height:1.4em}
.iso-page .iso-plate{padding:52px 24px 28px}
.kv-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.iso-plate-corner[data-corner="title"],.iso-plate-corner[data-corner="hint"]{text-transform:none;letter-spacing:.08em}
.iso-plate-corner[data-corner="readout"]{white-space:normal;max-width:46%;text-align:right;line-height:1.35}
.kv-hits [data-piece]{cursor:pointer}
.kv-stage[data-focus] .it:not([data-on]){--anatomy-hi:var(--anatomy-mid);--anatomy-mid:var(--anatomy-lo);opacity:.48}
.kv-stage[data-focus] .iso-svg>:not(.it):not(.kv-hits){opacity:.5}
.it[data-on]{--anatomy-hi:var(--anatomy-lit);--anatomy-mid:var(--anatomy-hi)}
.it[data-on] .iso-top{fill:var(--anatomy-lit-top)}
.it[data-on] .iso-shade{fill:var(--anatomy-lit-shade)}
.it[data-on] .iso-edge{stroke:var(--anatomy-lit)}
.it[data-on] .iso-line[data-tone="hi"]{stroke:var(--anatomy-lit)}
.iso-page{width:min(720px,100% - 28px);margin:48px auto 88px}
@media (max-width:560px){
  .iso-page .iso-plate{padding:48px 10px 20px}
  .kv-listen{min-height:52px;font-size:18px;padding:0 26px}
  .kv-say{font-size:20px;margin:12px 4px 40px}
  .iso-plate-corner[data-corner="hint"],.iso-plate-corner[data-corner="readout"]{bottom:8px}
}
`;

function kidPage({ title, theme, body, script }) {
  const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const scheme = theme === "light" ? "light" : "dark";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>${k.ISO_CSS}
*{box-sizing:border-box}
html{color-scheme:${scheme}}
body{margin:0;background:var(--anatomy-page);color:var(--anatomy-text);font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
${KID_CSS}</style></head><body class="iso" data-theme="${theme}"><main class="iso-page">${body}</main>${script ? `<script type="module">${script.replace(/<\/(script)/gi, "<\\/$1")}</script>` : ""}</body></html>`;
}

const live = "const NARRATION = " + JSON.stringify(narration) + ";\nconst P = " + JSON.stringify(P) + ";\n" + readFileSync(join(HERE, "live.js"), "utf8");
const script = kitScript() + "\n" + live;

const plateBody = k.plateHtml({
  fig: "01",
  title: "每天要喝水",
  hint: "点一点会动的地方",
  readout: "准备好了",
  keys: [
    { mark: "lit", label: "正在讲的零件，会发亮" },
    { mark: "raised", label: "身体工厂里的小机器" },
    { mark: "dim", label: "旁边的杯子、尺子和螺丝" },
  ],
  caption: "一座小小身体工厂。水是快递员，也是清洁工。身体里的活儿要靠水，水会用掉，所以每天要再喝回来。",
  body: `<div class="kv-stage iso-stage" tabindex="0" role="group" aria-label="小小身体工厂：点一点会动的地方，或按听故事按顺序看" aria-valuetext="每天都要把水补回来。">${svg}</div><p class="kv-say" data-say>每天都要把水补回来。</p><span class="kv-live" aria-live="polite" data-live></span>`,
});

const pageBody = `<div class="kv-top"><button type="button" class="kv-listen" data-listen><span class="kv-lamp" aria-hidden="true"></span>听故事</button></div>${plateBody}`;

function writeTheme(theme) {
  const name = theme === "light" ? "index-light.html" : "index.html";
  writeFileSync(join(HERE, name), kidPage({ title: "每天要喝水", theme, body: pageBody, script }));
  console.log("wrote", name);
}

maybeVoice();
writeTheme("dark");
writeTheme("light");

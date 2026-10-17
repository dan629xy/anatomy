import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";
import * as A from "../../kit/audit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import { embedNarration } from "../../scripts/voice/embed.mjs";
import { voicePlayerSource } from "../../scripts/voice/player.mjs";
import {
  OSC_PER_MIN,
  OSC_HZ,
  AMPLITUDE_DEG,
  BATTERY_V,
  BATTERY_MAH,
  CHARGE_W,
  PRESSURE_TRIP_N,
  TUFTS,
  IP,
  MOTOR_RPM,
} from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const DEG = Math.PI / 180;

const W = 640;
const H = 520;
const AZIMUTH = 38;
const ELEVATION = 32;

const PLATE = { x: -86, y: -70, w: 176, d: 142, r: 9 };
const PLATE_H = 11;
const FOOT_H = 5;
const CX = 0;
const CY = 4;
const CHARGER_R = 34;
const CHARGER_H = 15;
const WELL_R = 16.2;
const HANDLE_R = 14;
const Z0 = 14;

const PIECES = {
  bench: { name: "台面", say: "台面 · 承载充电座", move: [0, 0, 0] },
  charger: { name: "充电座", say: `充电座 · 感应充电 ${CHARGE_W} W`, move: [0, 28, 0] },
  shell: { name: "手柄壳体", say: `手柄壳体 · 防水结构 ${IP}`, move: [0, -34, 8] },
  coil: { name: "次级充电线圈", say: "次级充电线圈 · 从充电座耦合电能", move: [0, 0, 10] },
  battery: { name: "锂离子电池", say: `锂离子电池 · ${BATTERY_V} V · ${BATTERY_MAH} mAh`, move: [0, 0, 24] },
  board: { name: "印刷电路板", say: "印刷电路板 · 开关与电机驱动", move: [0, 0, 38] },
  motor: { name: "直流电动机", say: `直流电动机 · ${MOTOR_RPM} r/min`, move: [0, 0, 54] },
  drive: { name: "偏心轮与传动轴", say: `偏心轮 · 旋转振荡 ${OSC_PER_MIN} 次/min`, move: [0, 0, 68] },
  pressure: { name: "压力传感器", say: `压力传感器 · 阈值 ${PRESSURE_TRIP_N} N`, move: [0, 0, 78] },
  seal: { name: "防水密封圈", say: `防水密封圈 · 颈部 ${IP}`, move: [0, 0, 86] },
  head: { name: "刷头", say: `刷头 · ${TUFTS} 束刷毛 · ±${AMPLITUDE_DEG}°`, move: [0, 0, 102] },
};
const STAGGER = ["head", "seal", "pressure", "drive", "motor", "board", "battery", "coil", "shell", "charger"];
const FLOW = ["charger", "coil", "battery", "board", "motor", "drive", "head", "seal", "pressure", "shell"];
const SPRING = { stagger: 0.035, stiffness: 64, damping: 14.2, substeps: 4 };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [CX - HANDLE_R, CY - 20, 0], [CX + HANDLE_R, CY + 22, 208], [CX, CY, 210]],
  W,
  H,
  { pad: 34, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const UP = G.frameOf([CX, CY, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

const R = A.recorder(P, { order: STAGGER, spring: SPRING });
const record = R.solid;
function put(piece, ref, svg, { bias = 0, name, shapes = [], ride } = {}) {
  R.put({
    piece,
    ride: ride ?? piece,
    at: ref,
    bias,
    svg,
    move: PIECES[piece].move,
    shapes,
    name: name ?? R.nameFor(`${piece}.item`),
  });
}

function box(piece, name, plan, z, h, style = {}, extra = "") {
  const bevel = style.bevel ?? 0.5;
  const steps = style.steps ?? 6;
  const shape = record(A.slab(plan, z, h, { name }, steps));
  put(piece, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], S(k.slabOf(plan, z, h, P, steps, bevel), style) + extra, { name, shapes: [shape] });
}

function cyl(piece, name, x, y, r, z, h, style = {}, extra = "", steps = 32) {
  const bevel = style.bevel ?? 0;
  const shape = record(A.cylinder(x, y, r, z, h, { name }));
  put(piece, [x, y, z + h / 2], S(k.cylinder(x, y, r, z, h, P, steps, bevel), style) + extra, { name, shapes: [shape] });
}

function disc(piece, name, F, s0, s1, r, style = {}, extra = "") {
  const shape = record(A.disc(F, s0, s1, r, { name }));
  put(piece, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.disc(s0, s1, r, F, P, { bevel: style.bevel ?? 0 }), style) + extra, { name, shapes: [shape] });
}

function turned(piece, name, F, profile, style = {}, extra = "") {
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const shape = record(A.solid(F, profile, { name }));
  put(piece, G.add3(F.o, G.mul3(F.a, mid)), S(G.solidOf(profile, F, P, { bevel: style.bevel ?? 0.4, steps: 36 }), style) + extra, { name, shapes: [shape] });
}

function cable(piece, name, points, r = 0.7, { tone = "mid", bend = 4, bias = 0.05 } = {}) {
  const route = G.fillet(points, Math.max(bend, r * 2.6), 10, { P, tube: r });
  R.route(name, route, r, { limp: true, piece, move: PIECES[piece].move });
  tubePieces(route, r, P, { maxLength: 18, spacing: 1.1 }).forEach((chunk, index) => {
    put(piece, chunk.mid, tubeSvg(chunk, { tone }), { bias, name: `${name}:${index}`, shapes: [A.tube(chunk.points, chunk.radii)] });
  });
  put(piece, route[0], Dots([at(route[0])], { size: 0.7, tone: "hi" }), { bias: bias + 0.2, name: `${name}.end0`, shapes: [A.ball(route[0], 0.7, { name: `${name}.end0`, owner: name })] });
  put(piece, route[route.length - 1], Dots([at(route[route.length - 1])], { size: 0.7, tone: "hi" }), { bias: bias + 0.2, name: `${name}.end1`, shapes: [A.ball(route[route.length - 1], 0.7, { name: `${name}.end1`, owner: name })] });
  return route;
}

const halo = `<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`;
for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
  cyl("bench", "stand.foot-pad", x, y, 7, -PLATE_H - FOOT_H, 1.6, { tone: "lo" }, "", 28);
  cyl("bench", "stand.foot", x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, { tone: "mid" }, "", 28);
}
box("bench", "stand.plate", PLATE, -PLATE_H, PLATE_H, { tone: "mid", bevel: 1.6, steps: 8 }, Ln(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }));
put("bench", [0, 0, 0], Ln(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }), { name: "stand.groove", bias: 0.4 });
const plateScrews = k.corners(PLATE, 10);
put(
  "bench",
  [0, 0, 0],
  Ln(plateScrews.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }) + Dots(plateScrews.map(([x, y]) => at([x, y, 0])), { size: 0.5 }),
  { name: "stand.screws", bias: 0.5 },
);
const STRIP = { x: PLATE.x + 16, y: PLATE.y + PLATE.d - 14, w: PLATE.w - 32, d: 7, r: 1 };
box("bench", "stand.strip", STRIP, 0, 0.6, { tone: "lo", crease: "none", bevel: 0 });
const ticks = k.topTicks(STRIP.x + 4, STRIP.x + STRIP.w - 4, 4, 5, STRIP.y + 0.8, 0.6, [2, 3.6], P);
put("bench", [STRIP.x + STRIP.w / 2, STRIP.y + 3, 0.6], Ln(ticks.minor, { tone: "lo" }) + Ln(ticks.major, { tone: "mid" }) + Dots([at([STRIP.x + 2, STRIP.y + 3.5, 0.6]), at([STRIP.x + STRIP.w - 2, STRIP.y + 3.5, 0.6])], { size: 0.45 }), { name: "stand.ticks", bias: 0.6 });
const LABEL = { x: PLATE.x + 14, y: PLATE.y + 14, w: 34, d: 14, r: 1.2 };
box("bench", "stand.label", LABEL, 0, 0.8, { tone: "lo", crease: "none", bevel: 0 }, Ln(k.planOutline(k.insetPlan(LABEL, 1.4), 0.8, P, 3), { tone: "faint" }) + Ln([22, 16, 19].map((w, i) => k.lineOnTop([LABEL.x + 4, LABEL.y + 3.6 + i * 3], [LABEL.x + 4 + w, LABEL.y + 3.6 + i * 3], 0.8, P)).join(""), { tone: "lo", free: true }) + Dots([at([LABEL.x + LABEL.w - 2.6, LABEL.y + 2.6, 0.8]), at([LABEL.x + LABEL.w - 2.6, LABEL.y + LABEL.d - 2.6, 0.8])], { size: 0.45 }));

const CHARGER_F = G.frameOf([CX, CY, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
for (const angle of [40, 160, 280]) {
  const x = CX + Math.cos(angle * DEG) * 30;
  const y = CY + Math.sin(angle * DEG) * 30;
  cyl("charger", "charger.foot", x, y, 4.2, 0, 3.2, { tone: "lo" }, "", 20);
}
turned("charger", "charger.base", CHARGER_F, [[0, 32], [2.4, 34], [CHARGER_H - 2.6, 34], [CHARGER_H, 30.5]], { tone: "mid", bevel: 0.7 });
disc("charger", "charger.well", CHARGER_F, 10, CHARGER_H, WELL_R + 2.4, { tone: "lo", bevel: 0.3 }, Ln(G.circleOf(CHARGER_F, CHARGER_H, WELL_R, P, 28), { tone: "faint" }));
disc("charger", "charger.ferrite", CHARGER_F, 3.2, 8.2, 18, { tone: "hi", bevel: 0.2 });
disc("charger", "charger.coil-inner", CHARGER_F, 4.4, 7.4, 22, { tone: "hi" });
disc("charger", "charger.coil-outer", CHARGER_F, 4.4, 7.4, 28, { tone: "mid" });
const primary = G.spiral(CHARGER_F, 6.2, 20, 27, 0, Math.PI * 2 * 5.2, 90);
put("charger", [CX, CY, 6.2], Ln(k.pathOf(primary.map(at)), { tone: "hi" }), { name: "charger.winding", bias: 0.4 });
disc("charger", "charger.contact", CHARGER_F, CHARGER_H - 1.2, CHARGER_H, WELL_R + 0.6, { tone: "hi" });
const ledAt = [CX + 22, CY - 18];
cyl("charger", "charger.led-bezel", ledAt[0], ledAt[1], 2.6, CHARGER_H, 1.4, { tone: "mid" }, "", 16);
put("charger", [...ledAt, CHARGER_H + 1.6], Dots([at([ledAt[0], ledAt[1], CHARGER_H + 1.6])], { size: 0.7, tone: "hi", pulse: true }), { name: "charger.led", bias: 1.2, shapes: [A.ball([ledAt[0], ledAt[1], CHARGER_H + 1.6], 0.7, { name: "charger.led" })] });
const CHARGER_LABEL = { x: CX + 14, y: CY + 22, w: 22, d: 10, r: 1 };
box("charger", "charger.label", CHARGER_LABEL, CHARGER_H, 0.7, { tone: "lo", crease: "none", bevel: 0 }, Ln([14, 10, 12].map((w, i) => k.lineOnTop([CHARGER_LABEL.x + 3, CHARGER_LABEL.y + 2.4 + i * 2.4], [CHARGER_LABEL.x + 3 + w, CHARGER_LABEL.y + 2.4 + i * 2.4], CHARGER_H + 0.7, P)).join(""), { tone: "lo", free: true }));
const grommet = [CX + 29, CY + 5, 7];
cyl("charger", "charger.grommet", grommet[0], grommet[1], 2.2, 5, 4, { tone: "mid" }, "", 16);
const plug = [PLATE.x + PLATE.w - 18, PLATE.y + 28, 3];
box("charger", "charger.plug", { x: plug[0] - 5, y: plug[1] - 4, w: 10, d: 8, r: 1.4 }, 0, 6, { tone: "mid", bevel: 0.4 }, Dots([at([plug[0] - 1.6, plug[1], 6]), at([plug[0] + 1.6, plug[1], 6])], { size: 0.45 }));
cable("charger", "charger.cable", [[grommet[0] + 2, grommet[1], 7], [grommet[0] + 16, grommet[1] + 4, 7], [plug[0] - 18, plug[1] + 10, 4], [plug[0] - 6, plug[1], 4]], 0.85, { tone: "mid", bend: 6 });
const chargerScrews = [0, 90, 180, 270].map((deg) => [CX + Math.cos(deg * DEG) * 28, CY + Math.sin(deg * DEG) * 28]);
put("charger", [CX, CY, CHARGER_H], Ln(chargerScrews.map(([x, y]) => k.ring(x, y, 1.6, CHARGER_H, P, 12)).join(""), { tone: "lo" }) + Dots(chargerScrews.map(([x, y]) => at([x, y, CHARGER_H])), { size: 0.4 }), { name: "charger.screws", bias: 0.8 });

const SHELL_Z0 = Z0 + 7;
const SHELL_Z1 = 154;
const FRONT = { x: CX - 12, y: CY - 13.2, w: 24, d: 14.4, r: 11 };
const BACK = { x: CX - 12, y: CY + 0.4, w: 24, d: 14.4, r: 11 };
box("shell", "shell.front", FRONT, SHELL_Z0, SHELL_Z1 - SHELL_Z0, { tone: "mid", bevel: 0.9, steps: 10 }, Ln(k.planOutline(k.insetPlan(FRONT, 2.4), SHELL_Z1, P, 8), { tone: "faint" }) + k.faceTextSvg(k.sideMatrix([CX, FRONT.y], (SHELL_Z0 + SHELL_Z1) / 2 + 10, P, "left"), IP, { size: 2.5, tone: "lo", anchor: "middle" }));
const grip = Array.from({ length: 8 }, (_, index) => {
  const z = SHELL_Z0 + 14 + index * 15;
  return k.segment([CX - 7.5, BACK.y + BACK.d - 0.2, z], [CX + 7.5, BACK.y + BACK.d - 0.2, z], P);
}).join("");
box("shell", "shell.back", BACK, SHELL_Z0, SHELL_Z1 - SHELL_Z0, { tone: "mid", bevel: 0.9, steps: 10 }, Ln(grip, { tone: "lo" }));
cyl("shell", "shell.cap", CX, CY, HANDLE_R + 0.4, Z0, 8.4, { tone: "mid", bevel: 0.7 }, Ln(k.sideArc(CX, CY, HANDLE_R + 0.4, Z0 + 4.2, P, 22), { tone: "faint" }), 44);
cyl("shell", "shell.collar", CX, CY, 11.6, SHELL_Z1, 9, { tone: "mid", bevel: 0.55 }, Ln(k.knurl(CX, CY, 11.6, SHELL_Z1 + 2.2, SHELL_Z1 + 8, 48, P, 0.25), { tone: "lo" }), 44);
turned("shell", "shell.waist", G.frameOf([CX, CY, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), [[64, 14.2], [72, 13.2], [84, 13.2], [92, 14.2]], { tone: "mid", bevel: 0.4 });
const SWITCH_WIN = { x: CX - 5.5, y: FRONT.y - 1.2, w: 11, d: 4.2, r: 1.6 };
box("shell", "shell.window", SWITCH_WIN, 86, 16, { tone: "lo", bevel: 0.3 });
for (const y of [CY - 9, CY + 12]) {
  cyl("shell", "shell.vent", CX + 9.6, y, 0.9, 48, 5, { tone: "lo" }, "", 12);
  cyl("shell", "shell.vent", CX + 9.6, y, 0.9, 56, 5, { tone: "lo" }, "", 12);
}
for (const z of [SHELL_Z0 + 10, SHELL_Z1 - 12]) {
  put("shell", [CX, CY, z], Ln(k.corners({ x: CX - 11, y: CY - 11, w: 22, d: 22 }, 3).map(([x, y]) => k.ring(x, y, 1.3, z, P, 10)).join(""), { tone: "lo" }) + Dots(k.corners({ x: CX - 11, y: CY - 11, w: 22, d: 22 }, 3).map(([x, y]) => at([x, y, z])), { size: 0.4 }), { name: "shell.pins", bias: 0.4 });
}

const COIL_F = G.frameOf([CX, CY, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
disc("coil", "coil.ferrite", COIL_F, 18, 28, 7.2, { tone: "hi", bevel: 0.2 });
disc("coil", "coil.bobbin-low", COIL_F, 18, 19.6, 10.4, { tone: "mid" });
disc("coil", "coil.bobbin-high", COIL_F, 26.4, 28, 10.4, { tone: "mid" });
disc("coil", "coil.winding", COIL_F, 19.8, 26.2, 9.6, { tone: "hi" });
const secondary = G.spiral(COIL_F, 23, 8.2, 9.4, 0, Math.PI * 2 * 6, 80);
put("coil", [CX, CY, 23], Ln(k.pathOf(secondary.map(at)), { tone: "lit" }), { name: "coil.turns", bias: 0.5 });
put(
  "coil",
  [CX, CY, 24],
  k.wireSvg(at([CX + 9, CY, 20]), at([CX + 7.4, CY - 2, 34]), { tone: "hi", ends: "both", size: 0.9 }) + k.wireSvg(at([CX - 9, CY, 20]), at([CX - 7.4, CY + 2, 34]), { tone: "hi", ends: "both", size: 0.9 }),
  { name: "coil.leads", bias: 0.6 },
);

cyl("battery", "battery.foam-low", CX, CY, 9.2, 30, 3.2, { tone: "lo" }, "", 28);
turned("battery", "battery.cell", G.frameOf([CX, CY, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), [[33.2, 8.4], [34.4, 8.6], [70, 8.6], [71.2, 8.4]], { tone: "hi", bevel: 0.35 });
disc("battery", "battery.sleeve", G.frameOf([CX, CY, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), 36, 68, 8.9, { tone: "mid" });
cyl("battery", "battery.insulator", CX, CY, 6.4, 71.2, 1.6, { tone: "lo" }, "", 20);
cyl("battery", "battery.pos", CX, CY, 3.2, 72.8, 2.4, { tone: "hi", bevel: 0.2 }, "", 16);
cyl("battery", "battery.neg", CX, CY, 4.6, 32.2, 1.4, { tone: "mid" }, "", 16);
cyl("battery", "battery.foam-high", CX, CY, 9.2, 75.2, 2.6, { tone: "lo" }, "", 24);
put("battery", [CX + 8.6, CY, 52], Ln(k.rise([CX + 8.6, CY], 38, 68, P), { tone: "lo" }), { name: "battery.seam", bias: 0.3 });

const PCB = { x: CX - 8, y: CY - 6, w: 16, d: 12, r: 1.2 };
box("board", "board.pcb", PCB, 78.2, 1.8, { tone: "hi", bevel: 0.25 }, Ln(k.planOutline(k.insetPlan(PCB, 1.1), 80, P, 4), { tone: "faint" }) + Dots([[-5, -3], [5, -3], [-5, 3], [5, 3]].map(([dx, dy]) => at([CX + dx, CY + dy, 80])), { size: 0.35, tone: "lo" }));
box("board", "board.mcu", { x: CX - 3.6, y: CY - 2.4, w: 7.2, d: 4.8, r: 0.5 }, 80, 1.6, { tone: "mid", bevel: 0.2 });
box("board", "board.driver", { x: CX + 2.2, y: CY + 1.4, w: 5.2, d: 3.6, r: 0.4 }, 80, 1.4, { tone: "mid", bevel: 0.15 });
for (const [dx, dy, r] of [[-5.6, 3.2, 1.3], [5.4, -3.4, 1.15], [-1.2, 3.6, 1.05]]) {
  cyl("board", "board.cap", CX + dx, CY + dy, r, 80, 2.8, { tone: "hi" }, Ln(k.sideArc(CX + dx, CY + dy, r, 81.4, P, 10), { tone: "faint" }), 16);
}
cyl("board", "board.led", CX + 5.8, CY + 3.8, 0.9, 80, 1.2, { tone: "hi" }, "", 12);
put("board", [CX + 5.8, CY + 3.8, 81.4], Dots([at([CX + 5.8, CY + 3.8, 81.4])], { size: 0.45, tone: "hi", pulse: true }), { name: "board.led-die", bias: 0.4 });
box("board", "board.tactile", { x: CX - 2.2, y: CY - 7.4, w: 4.4, d: 3.2, r: 0.5 }, 80, 1.5, { tone: "mid", bevel: 0.15 });
put(
  "board",
  [CX, CY, 80],
  k.wireSvg(at([CX, CY, 75]), at([CX, CY, 78.2]), { tone: "hi", ends: "both", size: 0.8 }) + k.wireSvg(at([CX + 4, CY, 81.8]), at([CX + 4, CY, 90]), { tone: "hi", ends: "both", size: 0.8 }),
  { name: "board.leads", bias: 0.5 },
);

box("board", "board.key-bezel", { x: CX - 6, y: FRONT.y - 0.4, w: 12, d: 3.4, r: 1.4 }, 88, 12, { tone: "mid", bevel: 0.35 });
box("board", "board.key-cap", { x: CX - 4.4, y: FRONT.y - 1.6, w: 8.8, d: 2.4, r: 1.1 }, 90, 8, { tone: "hi", bevel: 0.25 });
box("board", "board.membrane", { x: CX - 3.6, y: FRONT.y - 0.2, w: 7.2, d: 1.4, r: 0.6 }, 91, 6, { tone: "lo", bevel: 0.1 });
cyl("board", "board.lightpipe", CX, FRONT.y - 0.8, 0.7, 99, 4, { tone: "hi" }, "", 12);

cyl("motor", "motor.rear-flange", CX, CY, 10.2, 90, 3.2, { tone: "mid", bevel: 0.35 }, Dots(G.dotsOf(G.frameOf([CX, CY, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), 93.2, 8.6, 6, P, { all: true }), { size: 0.35 }), 36);
turned("motor", "motor.can", G.frameOf([CX, CY, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), [[93.2, 9.4], [94, 9.6], [120, 9.6], [121.2, 9.4]], { tone: "hi", bevel: 0.4 });
cyl("motor", "motor.front-flange", CX, CY, 10.2, 121.2, 3.6, { tone: "mid", bevel: 0.35 }, Ln(k.sideArc(CX, CY, 10.2, 123, P, 18), { tone: "faint" }), 36);
box("motor", "motor.magnet-a", { x: CX - 8.2, y: CY - 2.2, w: 3.2, d: 4.4, r: 0.6 }, 98, 18, { tone: "lo", bevel: 0.2 });
box("motor", "motor.magnet-b", { x: CX + 5, y: CY - 2.2, w: 3.2, d: 4.4, r: 0.6 }, 98, 18, { tone: "lo", bevel: 0.2 });
cyl("motor", "motor.armature", CX, CY, 4.4, 97, 20, { tone: "hi" }, Ln(k.knurl(CX, CY, 4.4, 100, 114, 18, P, 0.2), { tone: "lo" }), 24);
cyl("motor", "motor.commutator", CX, CY, 3.2, 94, 4.4, { tone: "mid", bevel: 0.15 }, Ln(k.sideArc(CX, CY, 3.2, 96, P, 12), { tone: "faint" }), 20);
for (const dx of [-5.2, 5.2]) {
  box("motor", "motor.brush", { x: CX + dx - 1.1, y: CY - 1.1, w: 2.2, d: 2.2, r: 0.4 }, 94.4, 3.6, { tone: "hi", bevel: 0.1 });
}
cyl("motor", "motor.bearing-rear", CX, CY, 2.6, 90.4, 2.2, { tone: "mid" }, "", 16);
cyl("motor", "motor.bearing-front", CX, CY, 2.6, 123.2, 2.4, { tone: "mid" }, "", 16);
cyl("motor", "motor.shaft", CX, CY, 1.6, 88, 42, { tone: "hi", crease: "none" }, "", 14);
put("motor", [CX + 9.4, CY, 92], k.wireSvg(at([CX + 9.4, CY, 92]), at([CX + 6, CY, 81.8]), { tone: "hi", ends: "both", size: 0.8 }) + k.wireSvg(at([CX - 9.4, CY, 92]), at([CX - 4, CY, 81.8]), { tone: "hi", ends: "both", size: 0.8 }), { name: "motor.leads", bias: 0.4 });

cyl("drive", "drive.eccentric", CX + 1.6, CY, 5.4, 126.4, 4.8, { tone: "hi", bevel: 0.3, lit: true }, Ln(k.ring(CX + 1.6, CY, 3.2, 131.2, P, 16), { tone: "lo" }), 28);
cyl("drive", "drive.pin", CX + 2.8, CY, 1.15, 126, 6.2, { tone: "mid" }, "", 12);
cyl("drive", "drive.coupling", CX, CY, 3.6, 132.4, 5.2, { tone: "mid", bevel: 0.25 }, Dots([0, 90, 180, 270].map((deg) => at([CX + Math.cos(deg * DEG) * 2.4, CY + Math.sin(deg * DEG) * 2.4, 137.6])), { size: 0.32 }), 20);
cyl("drive", "drive.shaft", CX, CY, 1.7, 136, 22, { tone: "hi", crease: "none", lit: true }, "", 14);
cyl("drive", "drive.bushing", CX, CY, 3.1, 148, 6, { tone: "mid" }, Ln(k.sideArc(CX, CY, 3.1, 151, P, 12), { tone: "faint" }), 18);

const helix = [];
const helixFront = [];
const helixBack = [];
for (let step = 0; step <= 72; step++) {
  const t = step / 72;
  const angle = t * 5.5 * Math.PI * 2;
  const point = [CX + 3.8 * Math.cos(angle), CY + 3.8 * Math.sin(angle), 148 + 12 * t];
  const facing = k.depthOf([Math.cos(angle), Math.sin(angle), 0], P) > 0;
  helix.push({ point, facing });
}
let run = [];
let near = helix[0].facing;
for (const knot of helix) {
  if (knot.facing !== near) {
    run.push(at(knot.point));
    (near ? helixFront : helixBack).push(k.pathOf(run));
    run = [at(knot.point)];
    near = knot.facing;
    continue;
  }
  run.push(at(knot.point));
}
if (run.length > 1) (near ? helixFront : helixBack).push(k.pathOf(run));
put("pressure", [CX, CY, 154], Ln(helixBack.join(""), { tone: "mid" }) + Ln(helixFront.join(""), { tone: "hi" }), { name: "pressure.spring", bias: 0.2 });
cyl("pressure", "pressure.plunger", CX, CY, 2.2, 146.5, 8, { tone: "hi" }, "", 14);
box("pressure", "pressure.switch", { x: CX - 4.4, y: CY + 4.2, w: 8.8, d: 3.4, r: 0.7 }, 150, 5.2, { tone: "mid", bevel: 0.2 });
box("pressure", "pressure.stop", { x: CX - 3, y: CY - 6.4, w: 6, d: 2.2, r: 0.5 }, 157, 2.4, { tone: "lo", bevel: 0.15 });
put("pressure", [CX, CY + 6, 152], k.wireSvg(at([CX, CY + 6, 152.6]), at([CX + 3, CY + 4, 81.8]), { via: [at([CX + 11, CY + 8, 140]), at([CX + 11, CY + 6, 100])], tone: "hi", ends: "both", size: 0.75 }), { name: "pressure.lead", bias: 0.3 });

cyl("seal", "seal.neck-oring", CX, CY, 10.2, 162, 3.2, { tone: "hi", bevel: 0.4 }, Ln(k.sideArc(CX, CY, 10.2, 163.6, P, 20), { tone: "lo" }), 36);
cyl("seal", "seal.gland", CX, CY, 11.8, 160.4, 2.2, { tone: "mid" }, "", 32);
cyl("seal", "seal.charge-gasket", CX, CY, 12.2, Z0 + 6.4, 2, { tone: "hi" }, "", 32);
box("seal", "seal.switch-gasket", { x: CX - 6.4, y: FRONT.y - 0.8, w: 12.8, d: 1.6, r: 0.7 }, 87.2, 14, { tone: "hi", bevel: 0.1 });
cyl("seal", "seal.head-snap", CX, CY, 6.4, 168, 3.6, { tone: "mid", bevel: 0.2 }, "", 24);

cyl("head", "head.stem", CX, CY, 5.2, 168, 10, { tone: "mid", bevel: 0.35 }, Ln(k.knurl(CX, CY, 5.2, 170, 176, 22, P, 0.2), { tone: "lo" }), 26);
cyl("head", "head.snap", CX, CY, 6.6, 164.8, 4.4, { tone: "hi", bevel: 0.25 }, "", 24);
cyl("head", "head.ring", CX, CY, 9.2, 176.6, 2.4, { tone: "hi", bevel: 0.2 }, "", 32);
const TUFT_PLATE = { x: CX - 8.2, y: CY - 12.4, w: 16.4, d: 25.2, r: 7.2 };
box("head", "head.plate", TUFT_PLATE, 178.6, 3, { tone: "hi", bevel: 0.4, lit: true }, Ln(k.planOutline(k.insetPlan(TUFT_PLATE, 1.8), 181.6, P, 6), { tone: "faint" }) + Dots(k.corners(TUFT_PLATE, 3.4).map(([x, y]) => at([x, y, 181.6])), { size: 0.35 }));
const tuftAt = [];
for (let row = 0; row < 7; row++) {
  for (let col = 0; col < 4; col++) {
    const x = CX - 5.4 + col * 3.6;
    const y = CY - 9.2 + row * 3.1;
    const h = 13.4 + (row % 2 ? 1.6 : 0) + (col === 0 || col === 3 ? 0.8 : 0);
    tuftAt.push([x, y, h]);
    cyl("head", "head.tuft", x, y, 0.86, 181.6, h, { tone: "hi", lit: true }, "", 10);
  }
}

A.settle(R, P, { states: [0, 1] });
const items = R.items.slice().sort((a, b) => a.key - b.key);
const groups = items.map((item, index) => {
  const [mx, my, mz] = item.move;
  const ride = item.ride !== item.piece ? ` data-ride="${item.ride}"` : "";
  return `<g class="it" data-piece="${item.piece}"${ride} data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});

const solids = items.reduce((n, item) => n + (item.svg.match(/iso-solid/g) || []).length, 0);
const LABEL_TEXT = `一台旋转振荡式电动牙刷直立在感应充电座上：手柄壳体打开后可见次级充电线圈、${BATTERY_V} V ${BATTERY_MAH} mAh 锂离子电池、印刷电路板、直流电动机、偏心轮与传动轴、压力传感器和颈部防水密封圈；刷头毛束底板上有 ${TUFTS} 束刷毛。`;
const svg = k.figureSvg({
  width: W,
  height: H,
  label: LABEL_TEXT,
  body: [halo, `<g class="tbh-machine">${groups.join("")}</g>`],
});

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  stagger: STAGGER,
  spring: SPRING,
  order: FLOW,
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, piece]) => [id, { name: piece.name, say: piece.say }])),
  oscPerMin: OSC_PER_MIN,
  oscHz: OSC_HZ,
  tripN: PRESSURE_TRIP_N,
  batteryV: BATTERY_V,
  batteryMah: BATTERY_MAH,
};

const voice = await embedNarration(join(HERE, "narration.json"), { cacheDir: join(HERE, ".tts-cache") });
const CSS = readFileSync(join(HERE, "toothbrush.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA)).replace("__NARRATION__", JSON.stringify(voice.lines));
const caption =
  `旋转振荡式电动牙刷：充电座以 ${CHARGE_W} W 感应耦合向次级充电线圈供电，锂离子电池 ${BATTERY_V} V / ${BATTERY_MAH} mAh 储能；印刷电路板经轻触开关驱动直流电动机（${MOTOR_RPM} r/min），偏心轮把转动变成刷头 ±${AMPLITUDE_DEG}°、${OSC_PER_MIN} 次/min（${OSC_HZ.toFixed(1)} Hz）的旋转振荡，${TUFTS} 束刷毛清洁牙面。颈部防水密封圈保持 ${IP}；轴向力超过 ${PRESSURE_TRIP_N} N 时压力传感器切断驱动。悬停拆开，方向键选件，空格振荡，P 播放旁白。`;
const body =
  `<style>${CSS}</style>` +
  k.plateHtml({
    fig: "Fig 01",
    title: "旋转振荡式电动牙刷",
    hint: "悬停拆开 · ← → · 空格振荡 · P 旁白",
    readout: `${BATTERY_V.toFixed(1)} V · ${BATTERY_MAH} mAh · 静止`,
    keys: [
      { mark: "lit", label: "当前讲解的部件：选中时高亮，旁白讲到哪一处就点亮哪一处" },
      { mark: "raised", label: `刷头与刷毛：${TUFTS} 束，旋转振荡 ±${AMPLITUDE_DEG}°` },
      { mark: "edge", label: `感应充电线圈与充电座：${CHARGE_W} W 耦合` },
    ],
    caption,
    body: `<div class="iso-stage tbh-stage" tabindex="0" role="slider" aria-label="旋转振荡式电动牙刷。悬停拆开；左右方向键选择组件；空格键启动振荡；P 播放旁白；Escape 合拢。" aria-valuemin="0" aria-valuemax="${FLOW.length}" aria-valuenow="0" aria-valuetext="已合拢">${svg}<span class="iso-sr" role="status" aria-live="polite" data-live></span></div>`,
  }) +
  `<div class="iso-voice" data-voice><div class="iso-voice-bar"><button type="button" data-voice-play>播放旁白</button><span class="iso-voice-status" data-voice-status></span></div><p class="iso-voice-line" data-voice-line></p></div>`;

let page = k.pageHtml({ title: "旋转振荡式电动牙刷", theme: THEME, body, script: kitScript() + voicePlayerSource() + LIVE, width: 680 });
page = page.replace("<html lang=\"en\">", "<html lang=\"zh-Hans\">");
const filename = THEME === "light" ? "electric-toothbrush-light.html" : "electric-toothbrush.html";
writeFileSync(join(HERE, filename), page);
console.log("wrote", filename, `${(page.length / 1024).toFixed(0)} KB`, `${items.length} items`, `${solids} solids`, `tufts ${tuftAt.length}`, `voice ${voice.embedded}/${voice.lines.length}`, `scale ${KS.toFixed(3)}`);

A.auditOrExit(R, P, {});

const D = __DATA__;
const NARRATION = __NARRATION__;
const IDS = D.stagger;
const SPRING = D.spring;
const stage = document.querySelector(".tbh-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const live = document.querySelector("[data-live]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const piece = Object.fromEntries(IDS.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));
const nodes = [...svg.querySelectorAll(".it")].map((el) => {
  const move = (el.dataset.m || "0,0,0").split(",").map(Number);
  return { el, piece: el.dataset.piece, ride: el.dataset.ride || el.dataset.piece, move, key: Number(el.dataset.k), lift: D.EX[0] * move[0] + D.EY[0] * move[1] + D.EZ[0] * move[2] };
});
let selected = null;
let apart = false;
let running = false;
let pressureN = 0;
let pressureTarget = 0;
let tourClock = 0;
let touring = !still.matches;
let visible = false;
let inside = false;
let frame = 0;
let last = 0;
let clock = 0;
let idleTimer = 0;
let leaveTimer = 0;
let voiceHold = false;
const FLOW = D.order;

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function describe() {
  const text = selected ? D.pieces[selected].name : running ? "振荡中" : apart ? "已拆开" : "已合拢";
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  stage.setAttribute("aria-valuenow", String(selected ? FLOW.indexOf(selected) + 1 : 0));
}

function setApart(on) {
  if (apart === on) return;
  apart = on;
  const goal = on ? 1 : 0;
  let index = 0;
  for (const id of on ? IDS : [...IDS].reverse()) {
    if (piece[id].target === goal) piece[id].pending = null;
    else piece[id].pending = { value: goal, at: clock + (still.matches ? 0 : index++ * SPRING.stagger) };
  }
  describe();
  run();
}

function select(id) {
  if (id === "bench") id = null;
  if (selected === id) return;
  selected = id;
  for (const node of nodes) {
    if (id !== null && node.piece === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  describe();
}

function setRunning(on) {
  running = on;
  if (!on) pressureTarget = 0;
  describe();
  run();
}

function steerSpring(state, dt, calm) {
  if (state.pending && clock >= state.pending.at) {
    state.target = state.pending.value;
    state.pending = null;
  }
  if (calm) {
    state.x = state.target;
    state.v = 0;
    return false;
  }
  for (let index = 0; index < SPRING.substeps; index++) {
    const h = dt / SPRING.substeps;
    state.v += ((state.target - state.x) * SPRING.stiffness - state.v * SPRING.damping) * h;
    state.x += state.v * h;
  }
  if (Math.abs(state.target - state.x) < 2e-4 && Math.abs(state.v) < 2e-4) {
    state.x = state.target;
    state.v = 0;
    return false;
  }
  return true;
}

function follow(value, target, dt, tau, calm) {
  if (calm) return target;
  return value + (target - value) * (1 - Math.exp(-dt / tau));
}

function idleText() {
  if (selected) return D.pieces[selected].say;
  const moving = IDS.some((id) => Math.abs(piece[id].x - piece[id].target) > 0.002 || piece[id].pending);
  if (moving) return apart ? "拆开" : "合拢";
  if (pressureN >= D.tripN) return "过压保护 · " + D.tripN.toFixed(1) + " N";
  if (running) return D.oscPerMin + " 次/min · " + D.oscHz.toFixed(1) + " Hz";
  return apart ? "拆开 · 10 个组件" : D.batteryV.toFixed(1) + " V · " + D.batteryMah + " mAh · 静止";
}

function place() {
  const shares = {};
  for (const id of IDS) shares[id] = piece[id].x;
  shares.bench = 0;
  const phase = running && pressureN < D.tripN && !still.matches ? Math.sin(clock * D.oscHz * Math.PI * 2) : 0;
  const wig = [phase * 1.7, phase * 0.45, 0];
  let orderChanged = false;
  const keyed = nodes.map((node, index) => {
    const s = shares[node.ride] ?? 0;
    const wiggle = node.piece === "head" || node.piece === "drive" ? wig : [0, 0, 0];
    const mx = node.move[0] * s + wiggle[0];
    const my = node.move[1] * s + wiggle[1];
    const mz = node.move[2] * s + wiggle[2];
    const tx = D.EX[0] * mx + D.EY[0] * my + D.EZ[0] * mz;
    const ty = D.EX[1] * mx + D.EY[1] * my + D.EZ[1] * mz;
    const transform = tx || ty ? "translate(" + tx.toFixed(2) + " " + ty.toFixed(2) + ")" : "";
    if ((node.el.getAttribute("transform") || "") !== transform) {
      if (transform) node.el.setAttribute("transform", transform);
      else node.el.removeAttribute("transform");
    }
    const lift = node.lift * s + (D.EX[0] * wiggle[0] + D.EY[0] * wiggle[1] + D.EZ[0] * wiggle[2]);
    return { node, index, key: node.key + lift };
  });
  keyed.sort((a, b) => a.key - b.key || a.index - b.index);
  let prev = -1;
  for (const row of keyed) {
    if (row.index < prev) {
      orderChanged = true;
      break;
    }
    prev = row.index;
  }
  if (orderChanged) {
    const frag = document.createDocumentFragment();
    for (const row of keyed) frag.appendChild(row.node.el);
    svg.querySelector(".tbh-machine").appendChild(frag);
  }
}

function tourAt(time) {
  const list = FLOW;
  const apartFrom = 0.45;
  const listFrom = apartFrom + 0.9;
  const step = 1.55;
  const listTo = listFrom + list.length * step;
  const closeFrom = listTo + 0.7;
  const runFrom = closeFrom + 1.1;
  const runTo = runFrom + 3.2;
  const pressTo = runTo + 1.8;
  const restTo = pressTo + 1.2;
  const t = ((time % restTo) + restTo) % restTo;
  if (t < apartFrom) return { apart: false, part: null, run: false, press: 0 };
  if (t < listFrom) return { apart: true, part: null, run: false, press: 0 };
  if (t < listTo) return { apart: true, part: list[Math.min(list.length - 1, Math.floor((t - listFrom) / step))], run: false, press: 0 };
  if (t < closeFrom) return { apart: false, part: null, run: false, press: 0 };
  if (t < runFrom) return { apart: false, part: "head", run: false, press: 0 };
  if (t < runTo) return { apart: false, part: "head", run: true, press: 0 };
  if (t < pressTo) return { apart: false, part: "pressure", run: true, press: D.tripN + 0.3 };
  return { apart: false, part: null, run: false, press: 0 };
}

function quietTour() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (inside || voiceHold || still.matches) return quietTour();
    touring = true;
    tourClock = -0.4;
    run();
  }, 3600);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (touring && !voiceHold) {
    tourClock += dt;
    const step = tourAt(tourClock);
    setApart(step.apart);
    select(step.part);
    running = step.run;
    pressureTarget = step.press;
  }
  pressureN = follow(pressureN, pressureTarget, dt, 0.22, calm);
  let moving = false;
  for (const id of IDS) if (steerSpring(piece[id], dt, calm)) moving = true;
  place();
  say(idleText());
  const spinning = running && pressureN < D.tripN && !calm;
  frame = visible && (moving || touring || spinning || Math.abs(pressureN - pressureTarget) > 0.004 || voiceHold) ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  },
  { rootMargin: "120px 0px" },
).observe(stage);

function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item ? item.dataset.piece : null;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  quietTour();
  if (voiceHold) return;
  setApart(true);
  select(pieceAt(event));
  run();
});

stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside || voiceHold) return;
    select(null);
    setApart(false);
    run();
  }, 160);
});

stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") return;
  inside = true;
  quietTour();
  if (voiceHold) return;
  setApart(true);
  select(pieceAt(event));
  run();
});

stage.addEventListener("keydown", (event) => {
  if (event.key === "p" || event.key === "P") {
    event.preventDefault();
    voice.toggle();
    return;
  }
  quietTour();
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    if (voiceHold) return;
    setRunning(!running);
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    if (voice.isPlaying()) voice.finish();
    setRunning(false);
    pressureTarget = 0;
    select(null);
    setApart(false);
    return;
  }
  const here = selected ? FLOW.indexOf(selected) : -1;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") to = Math.min(FLOW.length - 1, here + 1);
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") to = Math.max(0, here < 0 ? 0 : here - 1);
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = FLOW.length - 1;
  if (to === null) return;
  event.preventDefault();
  setApart(true);
  select(FLOW[to]);
  run();
});

const voice = createVoicePlayer({
  lines: NARRATION,
  playButton: document.querySelector("[data-voice-play]"),
  statusEl: document.querySelector("[data-voice-status]"),
  lineEl: document.querySelector("[data-voice-line]"),
  reduced: still.matches,
  onLine(line) {
    voiceHold = true;
    touring = false;
    quietTour();
    if (line.part) {
      setApart(true);
      select(line.part);
    } else {
      select(null);
      setApart(false);
    }
    if (live) live.textContent = line.text;
    run();
  },
  onStop() {
    voiceHold = false;
    select(null);
    if (live) live.textContent = "";
    quietTour();
    run();
  },
});

if (still.matches) touring = false;
say(idleText());
describe();
run();

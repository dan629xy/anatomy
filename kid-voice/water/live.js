const stage = document.querySelector(".kv-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const sayEl = document.querySelector("[data-say]");
const listen = document.querySelector("[data-listen]");
const live = document.querySelector("[data-live]");
const hopper = svg.querySelector('[data-part="hopper"]');
const dropA = svg.querySelector('[data-part="drop-a"]');
const dropB = svg.querySelector('[data-part="drop-b"]');
const still = matchMedia("(prefers-reduced-motion: reduce)");
const pieces = [...svg.querySelectorAll(".it")];
const byPart = Object.fromEntries(NARRATION.map((item) => [item.part, item.zh]));
const ORDER = NARRATION.map((item) => item.part);
const DEFAULT_SAY = "每天都要把水补回来。";
const END_SAY = "水用掉了要再喝回来。";
const STATUS = {
  mouth: "水走进来了",
  factory: "小机器要喝水",
  courier: "水滴去送信",
  flush: "正在冲走脏东西",
  exit: "水跑出去了",
};

let selected = null;
let storying = false;
let storyIndex = 0;
let storyClock = 0;
let drop = 0;
let dropTarget = 18;
let hop = 0;
let frame = 0;
let last = 0;
let clock = 0;
let visible = false;
const STEP = 2.6;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function say(text, status) {
  if (sayEl.textContent !== text) sayEl.textContent = text;
  if (readout && readout.textContent !== status) readout.textContent = status;
  if (live && live.textContent !== text) live.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}

function select(id) {
  selected = id;
  for (const node of pieces) {
    if (id && node.dataset.piece === id) node.setAttribute("data-on", "");
    else node.removeAttribute("data-on");
  }
  svg.querySelectorAll(".kv-hits [data-piece]").forEach((node) => {
    if (id && node.dataset.piece === id) node.setAttribute("data-on", "");
    else node.removeAttribute("data-on");
  });
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  const line = id ? byPart[id] ?? DEFAULT_SAY : storying ? byPart[ORDER[storyIndex]] : DEFAULT_SAY;
  const status = id ? STATUS[id] ?? "点一点会动的地方" : storying ? "正在讲故事" : "准备好了";
  say(id ? line : storying ? line : DEFAULT_SAY, status);
}

function setListen(on) {
  storying = on;
  if (on) {
    listen.setAttribute("data-on", "");
    listen.textContent = "停一停";
  } else {
    listen.removeAttribute("data-on");
    listen.textContent = "听故事";
  }
}

function startStory() {
  setListen(true);
  storyIndex = 0;
  storyClock = 0;
  select(ORDER[0]);
  run();
}

function stopStory({ keep } = {}) {
  setListen(false);
  if (!keep) {
    select(null);
    say(END_SAY, "讲完了");
  }
}

function draw() {
  if (dropA) dropA.setAttribute("transform", translateAlong(P, [drop, 0, 0]));
  if (dropB) dropB.setAttribute("transform", translateAlong(P, [-drop, 0, 0]));
  if (hopper) hopper.setAttribute("transform", hop ? translateAlong(P, [0, 0, hop]) : "");
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (storying) {
    storyClock += dt;
    if (storyClock >= STEP) {
      storyClock = 0;
      storyIndex += 1;
      if (storyIndex >= ORDER.length) stopStory();
      else select(ORDER[storyIndex]);
    }
  }
  const busy = selected === "courier" || storying;
  dropTarget = Math.sin(clock * (busy ? 1.6 : 0.7)) * (busy ? 16 : 10);
  const hopWant = calm ? 0 : selected === "mouth" ? 2.4 + Math.sin(clock * 3.1) * 1.2 : 0.6 + Math.sin(clock * 1.4) * 0.4;
  if (calm) {
    drop = dropTarget;
    hop = 0;
  } else {
    drop += (dropTarget - drop) * (1 - Math.exp(-dt / 0.28));
    hop += (hopWant - hop) * (1 - Math.exp(-dt / 0.22));
  }
  draw();
  const settled = !storying && Math.abs(drop - dropTarget) < 0.05 && Math.abs(hop - hopWant) < 0.05;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
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

function pieceFrom(event) {
  const node = event.target.closest("[data-piece]");
  return node ? node.dataset.piece : null;
}

stage.addEventListener("pointerdown", (event) => {
  const id = pieceFrom(event);
  if (!id) return;
  event.preventDefault();
  if (storying) stopStory({ keep: true });
  select(id);
  run();
});

listen.addEventListener("click", () => {
  if (storying) stopStory();
  else startStory();
});

stage.addEventListener("keydown", (event) => {
  const here = selected ? Math.max(0, ORDER.indexOf(selected)) : -1;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") to = clamp(here + 1, 0, ORDER.length - 1);
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") to = clamp(here < 0 ? 0 : here - 1, 0, ORDER.length - 1);
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = ORDER.length - 1;
  if (event.key === "Escape") {
    event.preventDefault();
    if (storying) stopStory();
    else select(null);
    return;
  }
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    if (storying) stopStory();
    else startStory();
    return;
  }
  if (to === null) return;
  event.preventDefault();
  if (storying) stopStory({ keep: true });
  select(ORDER[to]);
  run();
});

if (still.matches) {
  hop = 0;
  drop = 0;
}
select(null);
draw();
run();

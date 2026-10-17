import { deepEqual, equal, match, ok } from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { apiKeyFromEnv, captionMs, hashText, maxDur } from "./voice/tts.mjs";
import { embedNarration, spokenText } from "./voice/embed.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NARRATION = join(ROOT, "examples", "electric-toothbrush", "narration.json");
const TERMS = join(ROOT, "examples", "electric-toothbrush", "terms.md");

test("apiKeyFromEnv is empty when unset", () => {
  equal(apiKeyFromEnv({}), "");
  equal(apiKeyFromEnv({ MIMO_API_KEY: "  " }), "");
});

test("apiKeyFromEnv reads the trimmed variable and nothing else", () => {
  equal(apiKeyFromEnv({ MIMO_API_KEY: " abc " }), "abc");
});

test("hashText is stable SHA1 prefix", () => {
  equal(hashText("锂离子电池"), hashText("锂离子电池"));
  equal(hashText("锂离子电池").length, 12);
  ok(hashText("a") !== hashText("b"));
});

test("captionMs and maxDur grow with Chinese characters", () => {
  ok(captionMs("电能从充电座进入手柄。") > captionMs("电能。"));
  ok(maxDur("电能从充电座进入手柄。") > maxDur("电能。"));
  ok(maxDur("一二三四五六七八九十") > captionMs("一二三四五六七八九十") / 1000);
});

test("embedNarration skips TTS without MIMO_API_KEY and warns", async () => {
  const dir = mkdtempSync(join(tmpdir(), "voice-"));
  const file = join(dir, "narration.json");
  writeFileSync(file, JSON.stringify([{ id: "n01", part: "motor", text: "直流电动机把电能变成轴的转动。" }]));
  const warnings = [];
  const result = await embedNarration(file, { cacheDir: join(dir, "cache"), warn: (msg) => warnings.push(msg), env: {} });
  equal(result.skipped, true);
  equal(result.embedded, 0);
  equal(result.lines[0].audio, null);
  equal(result.lines[0].part, "motor");
  match(warnings[0], /MIMO_API_KEY is not set/);
  match(warnings[0], /Rebuild locally with MIMO_API_KEY=/);
  rmSync(dir, { recursive: true, force: true });
});

test("toothbrush narration has unique ids and known parts", () => {
  const lines = JSON.parse(readFileSync(NARRATION, "utf8"));
  const ids = lines.map((line) => line.id);
  equal(ids.length, new Set(ids).size);
  const parts = new Set(["charger", "coil", "battery", "board", "motor", "drive", "head", "seal", "pressure", "shell", null]);
  for (const line of lines) {
    ok(spokenText(line).length > 8, line.id);
    ok(parts.has(line.part ?? null), line.id);
  }
  const used = new Set(lines.map((line) => line.part).filter(Boolean));
  deepEqual([...used].sort(), ["battery", "board", "charger", "coil", "drive", "head", "motor", "pressure", "seal", "shell"]);
});

test("terms table maps English to Chinese professional names", () => {
  const text = readFileSync(TERMS, "utf8");
  for (const row of ["torque | 扭矩", "bristle | 刷毛", "oscillation | 振荡", "waterproof seal / O-ring | 防水密封圈", "drive shaft | 传动轴", "eccentric cam | 偏心轮"]) {
    ok(text.includes(row.split(" | ")[0]) && text.includes(row.split(" | ")[1]), row);
  }
});

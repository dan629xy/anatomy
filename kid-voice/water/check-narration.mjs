import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const NARRATION_PATH = join(HERE, "..", "narration.json");
const HAN = /[\u3400-\u9fff\uf900-\ufaff]/g;
const MIN_HAN = 4;
const MAX_HAN = 14;

const BANNED = [
  { name: "px", re: /px/i },
  { name: "%", re: /[%％]/ },
  { name: "decimal", re: /\d+\.\d+/ },
  { name: "latin-abbrev", re: /[A-Za-z]{2,}/ },
  { name: "新陈代谢", re: /新陈代谢/ },
  { name: "血液循环", re: /血液循环/ },
  { name: "调节体温", re: /调节体温/ },
  { name: "代谢", re: /代谢/ },
  { name: "循环", re: /循环/ },
  { name: "体温", re: /体温/ },
  { name: "ml", re: /ml/i },
  { name: "kg", re: /kg/i },
  { name: "cm", re: /cm/i },
  { name: "mm", re: /mm/i },
  { name: "ATP", re: /ATP/ },
  { name: "DNA", re: /DNA/ },
  { name: "H2O", re: /H2O/i },
  { name: "CO2", re: /CO2/i },
];

export function checkNarration(items, { path = NARRATION_PATH } = {}) {
  const errors = [];
  if (!Array.isArray(items) || items.length === 0) {
    errors.push(`${path}: expected a non-empty array of { part, zh }`);
    return errors;
  }
  const seen = new Set();
  items.forEach((item, index) => {
    const at = `${path}[${index}]`;
    if (!item || typeof item !== "object") {
      errors.push(`${at}: not an object`);
      return;
    }
    const part = item.part;
    const zh = item.zh;
    if (typeof part !== "string" || !part.trim()) errors.push(`${at}: missing part`);
    else if (seen.has(part)) errors.push(`${at}: duplicate part "${part}"`);
    else seen.add(part);
    if (typeof zh !== "string" || !zh.trim()) {
      errors.push(`${at}: missing zh`);
      return;
    }
    const han = zh.match(HAN) ?? [];
    if (han.length < MIN_HAN) errors.push(`${at} (${part}): ${han.length} hanzi, need at least ${MIN_HAN}: “${zh}”`);
    if (han.length > MAX_HAN) errors.push(`${at} (${part}): ${han.length} hanzi, max ${MAX_HAN} (~12): “${zh}”`);
    for (const rule of BANNED) {
      if (rule.re.test(zh)) errors.push(`${at} (${part}): banned “${rule.name}” in “${zh}”`);
    }
  });
  return errors;
}

export function loadNarration(path = NARRATION_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const items = loadNarration();
  const errors = checkNarration(items);
  if (errors.length) {
    console.error("narration check failed:");
    for (const line of errors) console.error("  " + line);
    process.exit(1);
  }
  console.log(`narration check passed (${items.length} lines, ${MIN_HAN}–${MAX_HAN} hanzi, banned terms clear)`);
}

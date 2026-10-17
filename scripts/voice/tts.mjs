import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const MIMO_TTS_URL = "https://api.xiaomimimo.com/v1/chat/completions";
export const MIMO_TTS_MODEL = "mimo-v2.5-tts";
export const DEFAULT_VOICE = "冰糖";
export const TTS_STYLE =
  "一位中性、专业的工程讲解员，面向成人听众说明机械结构与工作原理。语速平稳、吐字清晰、语气克制，术语按教科书读法朗读。";

export function apiKeyFromEnv(env = process.env) {
  const value = env.MIMO_API_KEY;
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function hashText(text, extra = "") {
  return createHash("sha1").update(`${extra}\n${text}`).digest("hex").slice(0, 12);
}

export function captionMs(text) {
  const zh = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const en = (text.match(/[a-z0-9]/gi) || []).length;
  const punct = (text.match(/[，。：！？、——,.!?;:]/g) || []).length;
  return Math.round((zh * 0.28 + en * 0.22 + punct * 0.2 + 0.55) * 1000);
}

export function maxDur(text) {
  const zh = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const en = (text.match(/[a-z0-9]/gi) || []).length;
  const punct = (text.match(/[，。：！？、——,.!?;:]/g) || []).length;
  return zh * 0.34 + en * 0.3 + punct * 0.35 + 1.2;
}

export function durationOf(file) {
  return parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function synthWav(text, { key, voice = process.env.VOICE || DEFAULT_VOICE, style = TTS_STYLE, url = MIMO_TTS_URL } = {}) {
  if (!key) throw new Error("MIMO_API_KEY is not set");
  let last = "failed";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": key },
      body: JSON.stringify({
        model: MIMO_TTS_MODEL,
        messages: [
          { role: "user", content: style },
          { role: "assistant", content: text },
        ],
        audio: { format: "wav", voice },
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const data = json?.choices?.[0]?.message?.audio?.data;
      if (!data) throw new Error("TTS response had no audio data");
      return Buffer.from(data, "base64");
    }
    last = `${res.status} ${await res.text()}`;
    if (res.status < 500 && res.status !== 429) throw new Error(last.slice(0, 300));
    await sleep(2000 * (attempt + 1));
  }
  throw new Error(last.slice(0, 300));
}

export function postprocessWav(rawFile, outFile) {
  execFileSync("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-i",
    rawFile,
    "-af",
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,loudnorm=I=-16:TP=-1.5:LRA=11",
    "-ar",
    "48000",
    "-ac",
    "1",
    outFile,
  ]);
}

export function wavToMp3(wavFile, mp3File) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", wavFile, "-ac", "1", "-b:a", "48k", mp3File]);
}

export async function renderLine(text, destWav, { key, voice, style, workDir } = {}) {
  const raw = join(workDir, `${hashText(text)}.raw.wav`);
  await mkdir(workDir, { recursive: true });
  let duration = Infinity;
  for (let attempt = 1; attempt <= 4; attempt++) {
    await writeFile(raw, await synthWav(text, { key, voice, style }));
    postprocessWav(raw, destWav);
    duration = durationOf(destWav);
    if (duration <= maxDur(text)) break;
    console.warn(`voice: line too long (${duration.toFixed(2)}s > ${maxDur(text).toFixed(2)}s), retry ${attempt}`);
  }
  if (existsSync(raw)) await unlink(raw);
  return duration;
}

const isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const key = apiKeyFromEnv();
  if (!key) {
    console.warn(
      "voice: MIMO_API_KEY is not set; skipping TTS. The page will ship with narration text and timed captions, without audio. Rebuild locally with MIMO_API_KEY=... node examples/electric-toothbrush/build.mjs",
    );
    process.exit(0);
  }
  const cwd = process.cwd();
  const lines = JSON.parse(await readFile(join(cwd, "script.json"), "utf8"));
  const only = process.argv.slice(2);
  const voice = process.env.VOICE || DEFAULT_VOICE;
  await mkdir(join(cwd, "audio", "vo"), { recursive: true });
  const workDir = join(cwd, "audio", "work");
  await mkdir(workDir, { recursive: true });
  for (const line of lines) {
    if (only.length && !only.includes(line.id)) continue;
    const text = line.tts ?? line.zh ?? line.text;
    const out = join(cwd, "audio", "vo", `${line.id}.wav`);
    const duration = await renderLine(text, out, { key, voice, workDir });
    console.log(line.id, duration.toFixed(2), text);
  }
}

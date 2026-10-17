import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { apiKeyFromEnv, captionMs, hashText, renderLine, wavToMp3, DEFAULT_VOICE } from "./tts.mjs";

const SKIP_WARN =
  "voice: MIMO_API_KEY is not set; skipping TTS. The page will ship with narration text and timed captions, without audio. Rebuild locally with MIMO_API_KEY=... node examples/electric-toothbrush/build.mjs";

function which(bin) {
  const path = process.env.PATH || "";
  const ext = process.platform === "win32" ? ".exe" : "";
  for (const dir of path.split(process.platform === "win32" ? ";" : ":")) {
    const file = join(dir, bin + ext);
    if (dir && existsSync(file)) return file;
  }
  return "";
}

export function spokenText(line) {
  return line.tts ?? line.text ?? line.zh ?? "";
}

export async function embedNarration(narrationPath, { cacheDir, warn = console.warn, env = process.env } = {}) {
  const lines = JSON.parse(readFileSync(narrationPath, "utf8"));
  if (!Array.isArray(lines)) throw new Error("narration.json must be an array");
  const key = apiKeyFromEnv(env);
  const silent = (line) => ({
    id: line.id,
    part: line.part ?? null,
    text: spokenText(line),
    audio: null,
    ms: captionMs(spokenText(line)),
  });
  if (!key) {
    warn(SKIP_WARN);
    return { lines: lines.map(silent), embedded: 0, skipped: true, warning: SKIP_WARN };
  }
  if (!which("ffmpeg") || !which("ffprobe")) {
    const message = "voice: ffmpeg/ffprobe not found; skipping TTS. Captions will still play.";
    warn(message);
    return { lines: lines.map(silent), embedded: 0, skipped: true, warning: message };
  }
  mkdirSync(cacheDir, { recursive: true });
  const voice = env.VOICE || DEFAULT_VOICE;
  const workDir = join(cacheDir, "work");
  mkdirSync(workDir, { recursive: true });
  const out = [];
  let embedded = 0;
  for (const line of lines) {
    const text = spokenText(line);
    const id = hashText(text, `${voice}`);
    const mp3 = join(cacheDir, `${id}.mp3`);
    const wav = join(workDir, `${id}.wav`);
    try {
      if (!existsSync(mp3)) {
        await renderLine(text, wav, { key, voice, workDir });
        wavToMp3(wav, mp3);
      }
      const audio = `data:audio/mpeg;base64,${readFileSync(mp3).toString("base64")}`;
      out.push({ id: line.id, part: line.part ?? null, text, audio, ms: captionMs(text) });
      embedded += 1;
    } catch (error) {
      warn(`voice: failed to synthesise ${line.id}: ${error.message}`);
      out.push(silent(line));
    }
  }
  writeFileSync(join(cacheDir, "index.json"), JSON.stringify(out.map(({ id, part, text, ms, audio }) => ({ id, part, text, ms, hasAudio: Boolean(audio) })), null, 2));
  return { lines: out, embedded, skipped: false, warning: null };
}

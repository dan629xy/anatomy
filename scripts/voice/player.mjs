export function voicePlayerSource() {
  return `
function captionMs(text) {
  const zh = (String(text).match(/[\\u4e00-\\u9fff]/g) || []).length;
  const en = (String(text).match(/[a-z0-9]/gi) || []).length;
  const punct = (String(text).match(/[，。：！？、——,.!?;:]/g) || []).length;
  return Math.round((zh * 0.28 + en * 0.22 + punct * 0.2 + 0.55) * 1000);
}
function createVoicePlayer({ lines, playButton, statusEl, lineEl, reduced, onLine, onStop }) {
  const audio = new Audio();
  audio.preload = "auto";
  let index = -1;
  let playing = false;
  let timer = 0;
  let token = 0;
  const hasAudio = lines.some((line) => line.audio);
  const setStatus = (text) => { if (statusEl && statusEl.textContent !== text) statusEl.textContent = text; };
  const setLine = (text) => { if (lineEl && lineEl.textContent !== text) lineEl.textContent = text; };
  const idleStatus = () => (hasAudio ? "配音已内嵌 · 离线可播" : "无配音 · 字幕与部件高亮仍可播放");
  const clearWait = () => { clearTimeout(timer); timer = 0; token += 1; audio.pause(); };
  const finish = () => {
    playing = false;
    index = -1;
    clearWait();
    if (playButton) playButton.textContent = "播放旁白";
    setStatus(idleStatus());
    setLine("");
    if (onStop) onStop();
  };
  const waitThen = (ms, then) => {
    const stamp = token;
    timer = setTimeout(() => { if (stamp === token) then(); }, Math.max(320, ms));
  };
  const advance = () => {
    if (!playing) return;
    index += 1;
    if (index >= lines.length) { finish(); return; }
    const line = lines[index];
    const n = index + 1;
    setStatus("旁白 " + n + " / " + lines.length);
    setLine(line.text);
    if (playButton) playButton.textContent = "暂停旁白";
    if (onLine) onLine(line, index);
    const fallback = line.ms || captionMs(line.text);
    const stamp = token;
    const next = () => { if (playing && stamp === token) advance(); };
    if (line.audio && !reduced) {
      audio.src = line.audio;
      const ended = () => { audio.removeEventListener("ended", ended); next(); };
      audio.addEventListener("ended", ended);
      const play = audio.play();
      if (play && play.catch) play.catch(() => { audio.removeEventListener("ended", ended); waitThen(fallback, next); });
    } else {
      waitThen(fallback, next);
    }
  };
  const start = () => {
    clearWait();
    playing = true;
    index = -1;
    advance();
  };
  const pause = () => {
    playing = false;
    clearWait();
    if (playButton) playButton.textContent = "继续旁白";
    setStatus("已暂停 · " + Math.max(1, index + 1) + " / " + lines.length);
  };
  const toggle = () => { if (playing) pause(); else start(); };
  setStatus(idleStatus());
  setLine("");
  if (playButton) {
    playButton.textContent = "播放旁白";
    playButton.addEventListener("click", (event) => { event.preventDefault(); toggle(); });
  }
  return { toggle, start, pause, finish, isPlaying: () => playing, hasAudio };
}
`;
}

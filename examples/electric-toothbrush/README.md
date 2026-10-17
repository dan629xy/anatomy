# 旋转振荡式电动牙刷

原版 Anatomy 工作流下的 Hero 级样张：把「电动牙刷的工作原理」做成一台可拆开的真实机器。画框四角、图例图注、lit 选中高亮、idle tour、零件密度与原规范一致；专业术语用中文教科书译名。旁白配音是叠加在产物上的可选层。

## 打开页面

构建产物是单文件 HTML，离线即可打开：

```sh
node examples/electric-toothbrush/build.mjs
node examples/electric-toothbrush/build.mjs --light
```

然后用浏览器打开：

- `examples/electric-toothbrush/electric-toothbrush.html`（深色）
- `examples/electric-toothbrush/electric-toothbrush-light.html`（浅色）

交互：悬停拆开并选中部件；← → 按电能路径选件；空格启动旋转振荡；Escape 合拢；P 播放旁白。

## 可选配音层

旁白稿在 [`narration.json`](narration.json)，结构为 `[{ id, part, text, tts? }]`。`part` 对应图中组件 id（讲到哪一处，哪一处 `lit`）；`tts` 仅在需要人工纠偏时覆盖朗读文本。

本云端环境没有 `MIMO_API_KEY`。构建时会跳过合成并打印 warning，页面降级为「有旁白稿与字幕、无声音」：播放仍会按句推进字幕，并用定时器（无音频）或 `ended`（有音频）驱动部件高亮。页面不得因缺 Key 报错。

在本地得到带配音的版本：

```sh
MIMO_API_KEY=... node examples/electric-toothbrush/build.mjs
MIMO_API_KEY=... node examples/electric-toothbrush/build.mjs --light
```

可选 `VOICE` 换音色，默认 `冰糖`。脚本把逐句 48 kbps MP3 按文本 SHA1 缓存进 `.tts-cache/`（已 gitignore），再 base64 内嵌进单文件 HTML；运行期零网络请求。

缺 Key 时的日志原文应类似：

```text
voice: MIMO_API_KEY is not set; skipping TTS. The page will ship with narration text and timed captions, without audio. Rebuild locally with MIMO_API_KEY=... node examples/electric-toothbrush/build.mjs
```

实现参考：`scripts/voice/tts.mjs`（合成、去静音、loudnorm、重试）、`scripts/voice/embed.mjs`（缓存与内嵌）、`scripts/voice/player.mjs`（页面播放器）。密钥只从环境变量 `MIMO_API_KEY` 读取，不得写入仓库或日志。

## 术语对照

英文原词 → 中文专业译名见 [`terms.md`](terms.md)。

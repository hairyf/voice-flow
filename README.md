# voice-flow-x

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

🎙️ **Environment-agnostic voice stream processing** — a small, testable API for consuming **audio chunks → async ASR text streams**, merging segments, debouncing deltas, and matching commands.

- 🌊 **Streaming-first** — `Voice` consumes incremental recognition as `AsyncIterable` / `ReadableStream`, handles segment switches and candidate merging
- 🎯 **UI-friendly** — dedupes snapshots, short-window throttling, and a recent-output window to tame ASR flicker
- 🧩 **Pluggable commands** — match on `delta` / `final` with strings, predicates, or regex; `stop`, `clear`, and custom `handler`
- 📘 **TypeScript-native** — generic `Chunk<T>` and `VoiceOptions<T>` for any audio payload type

> 📌 **Note**
> This library is only a **stream + text state machine**. It does **not** ship recording, WebSocket, or a specific ASR SDK — wire `stream` to your service.

## 📦 Install

```bash
pnpm add voice-flow-x
```

```bash
npm install voice-flow-x
```

## 🚀 Usage

### Minimal example

Use `createVoice` (or `new Voice`) and provide `stream`: for each `Chunk`, return the async text stream for that audio segment.

```ts
import { createVoice } from 'voice-flow-x'

const voice = createVoice({
  stream: async ({ data, id }) => {
    // Your ASR: return AsyncIterable<string> or ReadableStream<string>
    return yourAsrStream(data, id)
  },
  onDelta: (text) => {
    // Debounced full snapshot (good for the current recognition line)
  },
  onFinal: (text) => {
    // Fires when `done()` completes (e.g. silence timeout with `finalIdleMs`, or manual `done()`)
  },
  deltaIdleMs: 50, // debounce for onDelta, default 50
  finalIdleMs: 2000, // optional: silence window before auto-finalize when no new chunk
  debug: false,
})

// After you get audio from the mic or elsewhere:
voice.feed({ data: audioPayload, id: segmentId })
```

### Commands

Register match-and-run rules on streaming text — handy for keyword interrupts or clearing the UI.

```ts
voice.addCommand({
  match: ['stop', 'cancel'],
  stage: 'delta',
  stop: true, // skip further onDelta/onFinal handling when matched
  clear: true, // pass empty string to callbacks to clear the view
  handler: (text) => { /* side effects */ },
})
```

`match` may be `string[]` (`includes`), `(text: string) => boolean`, or `RegExp`.

### State & concurrency

- `feed(chunk)` — queued processing; continues with the next chunk when the current run finishes
- `lock(ms)` / `unlock()` — pause processing; auto-unlock after timeout; `unlock` clears internal text state
- `finalize()` — when `finalIdleMs` is set, schedules `done()` after silence (no new audio)
- `clear()` — resets prefix, merged text, and dedupe window (often via internal or `onClear` paths)

### Types

Exporting from `voice-flow-x`: `Voice`, `createVoice`, `Chunk`, `Command`, `VoiceOptions`, `AsyncIterableStream`, and more — see [JSDocs][jsdocs-href].

## 🔧 For package maintainers

If you use [npm Trusted Publisher](https://github.com/e18e/ecosystem-issues/issues/201), run `pnpm publish` once locally to create the package and link the GitHub repo on npm; later, `pnpm run release` can drive releases via CI. See npm docs and scripts in this repo.

## 📄 License

[MIT](./LICENSE) License © [Hairyf](https://github.com/hairyf)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/voice-flow-x?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/voice-flow-x
[npm-downloads-src]: https://img.shields.io/npm/dm/voice-flow-x?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/voice-flow-x
[bundle-src]: https://img.shields.io/bundlephobia/minzip/voice-flow-x?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=voice-flow-x
[license-src]: https://img.shields.io/github/license/hairyf/voice-flow-x.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/hairyf/voice-flow-x/blob/main/LICENSE
[jsdocs-src]: https://img.shields.io/badge/jsdocs-reference-080f12?style=flat&colorA=080f12&colorB=1fa669
[jsdocs-href]: https://www.jsdocs.io/package/voice-flow-x

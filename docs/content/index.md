---
title: Voice Flow
description: Official site for voice-flow-x
---

# Voice Flow

Build reliable voice streaming workflows with a tiny TypeScript API.

<VoiceFlowDemo />

## Why Voice Flow

- Streaming-first ASR pipeline with `AsyncIterable` and `ReadableStream`
- Stable delta/final callbacks for real-time UI
- Command matching for voice interrupts and automation triggers

## Quick Start {#quick-start}

```bash
pnpm add voice-flow-x
```

```ts
import { createVoice } from 'voice-flow-x'

const voice = createVoice({
  stream: async ({ data, id }) => yourAsrStream(data, id),
  onDelta: text => console.log('delta:', text),
  onFinal: text => console.log('final:', text),
  finalIdleMs: 1500,
})

voice.feed({ data: 'hello world', id: 'seg-1' })
```

## UI Demo Code

The demo above is powered by a local Vue component:

```vue
<script setup lang="ts">
const state = ref('listening')
</script>

<template>
  <div class="demo">
    <strong>{{ state }}</strong>
  </div>
</template>
```

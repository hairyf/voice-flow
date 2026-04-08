<script setup lang="ts">
import { computed, ref } from 'vue'

const states = ['idle', 'listening', 'thinking', 'responding'] as const
const index = ref(1)
const transcript = ref('turn on the living room lights')

const state = computed(() => states[index.value % states.length])
const dots = computed(() => '.'.repeat((index.value % 3) + 1))

function next() {
  index.value += 1
}
</script>

<template>
  <div class="vf-demo">
    <div class="vf-status">
      <span class="vf-dot" />
      <strong>{{ state }}</strong>
      <span class="vf-fade">{{ dots }}</span>
    </div>
    <p class="vf-label">Live Transcript</p>
    <p class="vf-text">{{ transcript }}</p>
    <button class="vf-btn" @click="next">
      Simulate Next Frame
    </button>
  </div>
</template>

<style scoped>
.vf-demo {
  border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  border-radius: 12px;
  padding: 16px;
  background: color-mix(in srgb, #22c55e 8%, transparent);
}

.vf-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.vf-dot {
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  background: #22c55e;
}

.vf-fade {
  opacity: 0.6;
}

.vf-label {
  margin: 0;
  font-size: 12px;
  opacity: 0.7;
}

.vf-text {
  margin: 4px 0 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.vf-btn {
  border: 0;
  border-radius: 10px;
  padding: 8px 12px;
  color: white;
  background: #16a34a;
  cursor: pointer;
}

.vf-btn:hover {
  background: #15803d;
}
</style>

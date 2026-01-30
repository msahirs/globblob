<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { MetaballsRender } from '@/metaballs/MetaballsRender'

const containerRef = ref<HTMLDivElement | null>(null)
const supported = ref(true)

let sim: MetaballsRender | null = null
let raf: number | null = null

function frame(now: number) {
  sim?.render(now)
  raf = window.requestAnimationFrame(frame)
}

onMounted(() => {
  if (!containerRef.value) return

  // Avoid noisy jsdom warnings in unit tests.
  if (typeof navigator !== 'undefined' && navigator.userAgent?.toLowerCase().includes('jsdom')) {
    supported.value = false
    return
  }

  sim = new MetaballsRender(containerRef.value)
  supported.value = sim.init()
  if (!supported.value) return

  raf = window.requestAnimationFrame(frame)
})

onUnmounted(() => {
  if (raf) window.cancelAnimationFrame(raf)
  raf = null
  sim?.dispose()
  sim = null
})
</script>

<template>
  <div class="mb-root">
    <div ref="containerRef" class="mb-canvas" />
    <div v-if="!supported" class="mb-fallback">This simulation requires WebGL2.</div>
  </div>
</template>

<style scoped>
.mb-root {
  position: relative;
  width: 100%;
  height: 100%;
  background: #050505;
  overflow: hidden;
}

.mb-canvas {
  width: 100%;
  height: 100%;
}

.mb-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 700;
  letter-spacing: 0.02em;
}
</style>


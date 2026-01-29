<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { PhysarumRender } from '@/physarum/PhysarumRender'

const containerRef = ref<HTMLDivElement | null>(null)
const supported = ref(true)
let sim: PhysarumRender | null = null
let raf: number | null = null

function frame() {
  sim?.render()
  raf = window.requestAnimationFrame(frame)
}

onMounted(() => {
  if (!containerRef.value) return

  // Avoid noisy jsdom warnings in unit tests.
  if (typeof navigator !== 'undefined' && navigator.userAgent?.toLowerCase().includes('jsdom')) {
    supported.value = false
    return
  }

  sim = new PhysarumRender(containerRef.value)
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
  <div class="phys-root">
    <div ref="containerRef" class="phys-canvas" />
    <div v-if="!supported" class="phys-fallback">
      This simulation requires WebGL2 + float render targets.
    </div>
  </div>
</template>

<style scoped>
.phys-root {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
}

.phys-canvas {
  width: 100%;
  height: 100%;
}

.phys-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* Match Physarum-WebGL's interface styles for the info dialog/button. */
:global(.infoField) {
  color: white;
  text-align: center;
  font-size: 1.5em;
}

:global(.infoButton:hover) {
  box-shadow: 0em 0em 3px 3px white;
}

:global(.infoButton) {
  position: absolute;
  bottom: 1.5em;
  left: 1.5em;
  width: 50px;
  height: 50px;
  border-radius: 25px;
  background-color: #bdcfd18c;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
}

:global(.notification) {
  position: fixed;
  top: 20%;
  width: 50%;
  left: 25%;
  max-height: 60%;
  overflow-y: auto;
  background-color: #e0f7fa;
  padding: 2em;
  border-radius: 3px;
  box-shadow: 0em 0em 3px 3px white;
  z-index: 9999;
}
</style>


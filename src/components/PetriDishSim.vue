<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { PetriSimRenderer } from '@/petriSim/PetriSimRenderer'

const props = defineProps<{
  running: boolean
  growthRate: number
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const supported = ref(true)

let sim: PetriSimRenderer | null = null
let raf: number | null = null

function frame(now: number) {
  sim?.render(now)
  raf = window.requestAnimationFrame(frame)
}

onMounted(() => {
  if (!containerRef.value) return

  if (typeof navigator !== 'undefined' && navigator.userAgent?.toLowerCase().includes('jsdom')) {
    supported.value = false
    return
  }

  sim = new PetriSimRenderer(containerRef.value)
  const isAutomated = typeof navigator !== 'undefined' && !!navigator.webdriver
  supported.value = sim.init({ showStats: true, showGui: !isAutomated })
  if (!supported.value) return

  sim.setGrowthRate(props.growthRate)
  sim.setRunning(props.running)
  raf = window.requestAnimationFrame(frame)
})

watch(
  () => props.running,
  (v) => {
    sim?.setRunning(v)
  },
)

watch(
  () => props.growthRate,
  (v) => {
    sim?.setGrowthRate(v)
  },
)

onUnmounted(() => {
  if (raf) window.cancelAnimationFrame(raf)
  raf = null
  sim?.dispose()
  sim = null
})
</script>

<template>
  <div class="petriSimRoot">
    <div ref="containerRef" class="petriSimCanvas" />
    <div v-if="!supported" class="petriSimFallback">This simulation requires WebGL2.</div>
  </div>
</template>

<style scoped>
.petriSimRoot {
  position: relative;
  width: 100%;
  height: 100%;
}

.petriSimCanvas {
  width: 100%;
  height: 100%;
}

.petriSimFallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(0, 0, 0, 0.7);
  font-weight: 700;
  letter-spacing: 0.02em;
  background: var(--bg-primary);
}
</style>

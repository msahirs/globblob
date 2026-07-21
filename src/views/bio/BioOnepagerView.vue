<template>
  <div class="page">
    <header class="header">
      <img :src="titelUrl" alt="Logo" class="logo" />
    </header>

    <main class="content">
      <div class="graphContainer">
        <ExpressionGraph
          :points="previewPoints"
          :invalid="!compiledExpressionResult.ok"
          :invalid-message="compiledExpressionResult.ok ? '' : compiledExpressionResult.error"
          :current-time="elapsedSeconds"
        />

        <!-- Timeline Control -->
        <div class="timelineControl">
          <div class="timelineHeader">
            <span class="timeLabel">Simulation Time (t):</span>
            <span class="timeValue"
              >{{ elapsedSeconds.toFixed(1) }}s / {{ maxTime.toFixed(1) }}s</span
            >
          </div>
          <div class="timelineInputWrapper">
            <input
              type="range"
              min="0"
              :max="maxTime"
              step="0.1"
              v-model.number="elapsedSeconds"
              class="timelineSlider"
              @input="onTimelineScrub"
            />
          </div>
          <div class="timelineLabels">
            <span>0s</span>
            <span>10s</span>
            <span>20s</span>
            <span>30s</span>
            <span>40s</span>
            <span>50s</span>
          </div>
        </div>
      </div>

      <div class="sliders">
        <div class="slidersHorizontal">
          <SliderUnit
            label="Draaisnelheid"
            info-key="draai"
            info-text="Bepaalt hoe snel de cultuur wordt gemengd. Te snel kan stress veroorzaken."
            v-model="sliderDraaiSnelheid"
            slider-class="slider-rotating-speed"
            :min_value="rotationMin"
            :max_value="rotationMax"
            :steps="4"
          />

          <SliderUnit
            label="pH niveau"
            info-key="pH"
            info-text="pH niveau bepaalt de zuurgraad van de cultuur. Te zuur of te basisch kan de groei beïnvloeden."
            v-model="sliderPHLevel"
            slider-class="slider-PH"
            :min_value="phmin"
            :max_value="phmax"
            :steps="24"
          />

          <SliderUnit
            label="Zuurstof niveau"
            info-key="zuurstof"
            info-text="Zuurstof is essentieel voor aerobe micro-organismen. Te weinig zuurstof kan de groei beperken."
            v-model="sliderZuurstofLevel"
            slider-class="slider-oxygen"
            :min_value="zuurstofMin"
            :max_value="zuurstofMax"
            :steps="20"
          />
        </div>

        <div class="sliderUnitVertical">
          <div class="sliderTextHorizontal">
            <span class="sliderLabel">Temperatuur</span>
            <div
              class="infoWrapper"
              @mouseenter="showInfo('Temperatuur')"
              @mouseleave="hideInfo"
              @click="toggleInfo('Temperatuur')"
            >
              <img :src="infoIconUrl" alt="Info icon" class="infoIcon" />
              <div v-if="activeInfo === 'Temperatuur'" class="infoIconText">
                Temperatuur beïnvloedt de groeisnelheid en het gedrag van micro-organismen.
              </div>
            </div>
          </div>
          <div class="verticalSliderContainer">
            <span class="sliderMax">{{ tempmax }}</span>
            <input
              v-model.number="sliderTemperature"
              type="range"
              :min="tempmin"
              :max="tempmax"
              step="0.5"
              class="slider slider-vertical"
              :style="{
                '--pointer-color': tempColor,
                '--track-color': 'var(--slider-temp-track)',
                '--value': `${temperaturePercent}%`,
              }"
            />
            <span class="sliderMin">{{ tempmin }}</span>
          </div>
        </div>
      </div>

      <button class="startButton" @click="toggleStart">
        {{ started ? 'Stop' : 'Start' }}
      </button>
    </main>

    <div class="petriStage" aria-label="Petri dish simulation">
      <div class="petriClip">
        <PetriDishSim ref="petriDishRef" :running="started" :growth-rate="growthRate" />
      </div>
      <svg
        width="666"
        height="666"
        viewBox="0 0 666 666"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class="petriFrame"
      >
        <circle
          cx="333"
          cy="333"
          r="330.5"
          :stroke="petriFrameColor"
          stroke-width="5"
          stroke-dasharray="20 20"
        />
        <circle
          cx="332.5"
          cy="332.5"
          r="283"
          :stroke="petriFrameColor"
          stroke-width="5"
          stroke-dasharray="20 20"
        />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import PetriDishSim from '@/components/PetriDishSim.vue'
import SliderUnit from '@/components/sliders/SliderUnit.vue'
import ExpressionGraph from '@/components/bio/ExpressionGraph.vue'
import titelUrl from '@/assets/bio/TitleDarkMode.svg'
import infoIconUrl from '@/assets/bio/infoIconBlue.svg'
import GUI from 'lil-gui'
import { PARAMETER_RANGES, DEFAULT_GROWTH_EXPRESSION } from '@/features/microbiology/defaults'
import {
  compileGrowthExpression,
  createExpressionContext,
  evaluateCompiledGrowthExpression,
  buildGrowthPreview,
  getExpressionValidationMessage,
} from '@/features/microbiology/expressionEngine'
import { useMicrobiologyConfigsStore } from '@/stores/microbiologyConfigs'

const petriFrameColor = 'var(--petri-frame-color)'

const petriDishRef = ref<InstanceType<typeof PetriDishSim> | null>(null)

const sliderDraaiSnelheid = ref(PARAMETER_RANGES.rotation.defaultValue)
const sliderPHLevel = ref(PARAMETER_RANGES.ph.defaultValue)
const sliderZuurstofLevel = ref(PARAMETER_RANGES.oxygen.defaultValue)
const sliderTemperature = ref(PARAMETER_RANGES.temperature.defaultValue)

const started = ref(false)
const elapsedSeconds = ref(0)
const maxTime = 50.0
const debugMode = ref(false)

const store = useMicrobiologyConfigsStore()

let timerFrameId: number | null = null
let timerStartMs: number | null = null
let guiInstance: GUI | null = null

const zuurstofMin = PARAMETER_RANGES.oxygen.min
const zuurstofMax = PARAMETER_RANGES.oxygen.max

const rotationMin = PARAMETER_RANGES.rotation.min
const rotationMax = PARAMETER_RANGES.rotation.max

const phmin = PARAMETER_RANGES.ph.min
const phmax = PARAMETER_RANGES.ph.max

const tempmin = PARAMETER_RANGES.temperature.min
const tempmax = PARAMETER_RANGES.temperature.max

const activeInfo = ref<string | null>(null)
const showInfo = (key: string) => (activeInfo.value = key)
const hideInfo = () => (activeInfo.value = null)
const toggleInfo = (key: string) => (activeInfo.value = activeInfo.value === key ? null : key)

provide('showInfo', showInfo)
provide('hideInfo', hideInfo)
provide('toggleInfo', toggleInfo)
provide('activeInfo', activeInfo)

function lerpColor(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1)
  const c2 = hexToRgb(color2)
  if (!c1 || !c2) return color1
  const r = Math.round(c1.r + (c2.r - c1.r) * t)
  const g = Math.round(c1.g + (c2.g - c1.g) * t)
  const b = Math.round(c1.b + (c2.b - c1.b) * t)
  return rgbToHex(r, g, b)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null

  const [, r, g, b] = result

  if (!r || !g || !b) return null

  return {
    r: parseInt(r, 16),
    g: parseInt(g, 16),
    b: parseInt(b, 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

function startTimer() {
  if (timerFrameId !== null) return
  timerStartMs = performance.now() - elapsedSeconds.value * 1000

  const tick = (now: number) => {
    if (timerStartMs === null) {
      timerStartMs = now - elapsedSeconds.value * 1000
    }

    const elapsed = (now - timerStartMs) / 1000
    if (elapsed >= maxTime) {
      elapsedSeconds.value = maxTime
      started.value = false
      stopTimer()
    } else {
      elapsedSeconds.value = elapsed
      timerFrameId = window.requestAnimationFrame(tick)
    }
  }

  timerFrameId = window.requestAnimationFrame(tick)
}

function stopTimer() {
  if (timerFrameId === null) return
  window.cancelAnimationFrame(timerFrameId)
  timerFrameId = null
  timerStartMs = null
}

function toggleStart() {
  if (started.value) {
    started.value = false
  } else {
    if (elapsedSeconds.value >= maxTime) {
      elapsedSeconds.value = 0
    }
    started.value = true
  }
}

function syncPetriDish() {
  if (!compiledExpressionResult.value.ok) return
  const compiled = compiledExpressionResult.value.compiled
  const environment = currentEnvironment.value
  petriDishRef.value?.syncToTime(elapsedSeconds.value, (t: number) =>
    evaluateCompiledGrowthExpression(compiled, createExpressionContext(environment, t)),
  )
}

function onTimelineScrub() {
  if (started.value) {
    started.value = false
    stopTimer()
  }
  syncPetriDishDebounced()
}

const compiledExpressionResult = computed(() => {
  const expression = store.activeConfig?.expression ?? DEFAULT_GROWTH_EXPRESSION
  try {
    const compiled = compileGrowthExpression(expression)
    return {
      ok: true as const,
      compiled,
    }
  } catch (error) {
    return {
      ok: false as const,
      error: getExpressionValidationMessage(error),
    }
  }
})

const currentEnvironment = computed(() => ({
  rotation: sliderDraaiSnelheid.value,
  ph: sliderPHLevel.value,
  oxygen: sliderZuurstofLevel.value,
  temperature: sliderTemperature.value,
}))

const previewPoints = computed(() => {
  if (!compiledExpressionResult.value.ok) return []
  return buildGrowthPreview(compiledExpressionResult.value.compiled, currentEnvironment.value)
})

const growthRate = computed(() => {
  if (!compiledExpressionResult.value.ok) return 0
  const raw = evaluateCompiledGrowthExpression(
    compiledExpressionResult.value.compiled,
    createExpressionContext(currentEnvironment.value, elapsedSeconds.value),
  )
  return raw
})

const temperaturePercent = computed(() => {
  const span = tempmax - tempmin
  if (span <= 0) return 0
  return ((sliderTemperature.value - tempmin) / span) * 100
})

const tempColor = computed(() => {
  const minColor = '#ffe000'
  const maxColor = '#ff0000'
  const t = temperaturePercent.value / 100
  return lerpColor(minColor, maxColor, t)
})

watch(started, (isRunning) => {
  if (isRunning) {
    startTimer()
    return
  }
  stopTimer()
})

let syncDebounceId: ReturnType<typeof setTimeout> | null = null
function syncPetriDishDebounced() {
  if (syncDebounceId !== null) clearTimeout(syncDebounceId)
  syncDebounceId = setTimeout(() => {
    syncDebounceId = null
    syncPetriDish()
  }, 80)
}

watch(currentEnvironment, () => {
  if (!started.value) {
    syncPetriDishDebounced()
  }
})

function initGui() {
  if (!debugMode.value) return

  if (guiInstance) {
    guiInstance.destroy()
  }

  guiInstance = new GUI({ title: 'Biolab Debug' })
  guiInstance.domElement.style.zIndex = '9999'

  const guiState = {
    get curveName() {
      return store.activeConfig?.name ?? 'Default (Fallback)'
    },
    get equation() {
      return store.activeConfig?.expression ?? DEFAULT_GROWTH_EXPRESSION
    },
    get growthRate() {
      return growthRate.value
    },
    get t() {
      return elapsedSeconds.value
    },
    set t(v) {
      elapsedSeconds.value = v
    },
    get rotation() {
      return sliderDraaiSnelheid.value
    },
    set rotation(v) {
      sliderDraaiSnelheid.value = v
    },
    get ph() {
      return sliderPHLevel.value
    },
    set ph(v) {
      sliderPHLevel.value = v
    },
    get oxygen() {
      return sliderZuurstofLevel.value
    },
    set oxygen(v) {
      sliderZuurstofLevel.value = v
    },
    get temperature() {
      return sliderTemperature.value
    },
    set temperature(v) {
      sliderTemperature.value = v
    },
  }

  const infoFolder = guiInstance.addFolder('Active Curve Info')
  infoFolder.add(guiState, 'curveName').name('Name').listen().disable()
  infoFolder.add(guiState, 'equation').name('Equation').listen().disable()
  infoFolder.add(guiState, 'growthRate').name('Growth Rate').listen().disable()

  const varFolder = guiInstance.addFolder('Live Control Variables')
  varFolder.add(guiState, 't', 0, maxTime, 0.1).name('t (Time)').listen()
  varFolder.add(guiState, 'rotation', rotationMin, rotationMax, 1).name('Rotation').listen()
  varFolder.add(guiState, 'ph', phmin, phmax, 0.1).name('pH').listen()
  varFolder.add(guiState, 'oxygen', zuurstofMin, zuurstofMax, 0.05).name('Oxygen').listen()
  varFolder.add(guiState, 'temperature', tempmin, tempmax, 0.5).name('Temperature').listen()

  infoFolder.open()
  varFolder.open()
}

watch(debugMode, (val) => {
  window.localStorage.setItem('globblob.debug', val ? 'true' : 'false')
  if (val) {
    initGui()
  } else {
    guiInstance?.destroy()
    guiInstance = null
  }
})

onMounted(async () => {
  // Check URL query parameter 'debug' or local storage
  const params = new URLSearchParams(window.location.search)
  if (
    params.get('debug') !== null
      ? params.get('debug') !== 'false'
      : window.localStorage.getItem('globblob.debug') === 'true'
  ) {
    debugMode.value = true
  }

  try {
    await store.hydrate()
  } catch {
    return
  }

  // If debug was resolved true, init the gui
  if (debugMode.value) {
    initGui()
  }
})

onBeforeUnmount(() => {
  stopTimer()
  if (syncDebounceId !== null) clearTimeout(syncDebounceId)
  guiInstance?.destroy()
  guiInstance = null
})
</script>

<style scoped>
.header {
  padding: 2% 5% 0% 7%; /* Move title further up (reduced padding-top) */
}

.graphContainer {
  margin-left: 7% !important;
  width: 35vw !important;
  max-width: 35vw;
  margin-top: 2vh;
}

.sliders {
  position: static !important;
  width: auto !important;
  max-width: none !important;
  margin-top: 3vh;
}

.slidersHorizontal {
  width: 35vw !important;
}

:deep(.chartSurface) {
  height: 275px !important; /* Increased vertical scale by 25% (from 220px to 275px) */
  border-radius: 12px;
}

.timelineControl {
  margin-top: 15px;
  background: rgba(0, 11, 31, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.4);
  font-family:
    system-ui,
    -apple-system,
    sans-serif !important;
}

.timelineHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-family:
    system-ui,
    -apple-system,
    sans-serif !important;
}

.timeLabel {
  color: rgba(255, 255, 255, 0.85);
  font-family:
    system-ui,
    -apple-system,
    sans-serif !important;
  font-size: 0.85rem;
}

.timeValue {
  color: #00ff85;
  font-family:
    system-ui,
    -apple-system,
    sans-serif !important;
  font-size: 0.95rem;
  font-weight: bold;
}

.timelineInputWrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.timelineSlider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: #012a72;
  outline: none;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.timelineSlider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #00ff85;
  box-shadow: 0 0 8px #00ff85;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.timelineSlider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.timelineSlider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #00ff85;
  box-shadow: 0 0 8px #00ff85;
  cursor: pointer;
  border: none;
  transition: transform 0.1s ease;
}

.timelineSlider::-moz-range-thumb:hover {
  transform: scale(1.2);
}

.timelineLabels {
  display: flex;
  justify-content: space-between;
  font-family:
    system-ui,
    -apple-system,
    sans-serif !important;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 6px;
}
</style>

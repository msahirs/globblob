<template>
  <div class="page">
    <header class="header">
      <img :src="titelUrl" alt="Logo" class="logo" />
    </header>

    <main class="content">
      <div class="graphContainer">
        <svg class="graph" viewBox="0 0 300 150" preserveAspectRatio="none">
          <line x1="20" y1="10" x2="20" y2="130" class="axis" />
          <line x1="20" y1="130" x2="280" y2="130" class="axis" />

          <polyline
            :points="graphPoints"
            fill="none"
            stroke="var(--color-graph-axes)"
            stroke-width="3"
          />

          <circle :cx="x1" :cy="y1" r="5" fill="var(--color-graph-axes)" />
          <circle :cx="x2" :cy="y2" r="5" fill="var(--color-graph-axes)" />
          <circle :cx="x3" :cy="y3" r="5" fill="var(--color-graph-axes)" />
        </svg>
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

      <button class="startButton" @click="started = !started">
        {{ started ? 'Stop' : 'Start' }}
      </button>
    </main>

    <div class="petriStage" aria-label="Petri dish simulation">
      <div class="petriClip">
        <PetriDishSim :running="started" :growth-rate="growthRate" />
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
import titelUrl from '@/assets/bio/TitleDarkMode.svg'
import infoIconUrl from '@/assets/bio/infoIconBlue.svg'
import { PARAMETER_RANGES } from '@/features/microbiology/defaults'
import {
  clampGrowthRate,
  compileGrowthExpression,
  createExpressionContext,
  evaluateCompiledGrowthExpression,
} from '@/features/microbiology/expressionEngine'
import { useMicrobiologyConfigsStore } from '@/stores/microbiologyConfigs'

const petriFrameColor = 'var(--petri-frame-color)'

const sliderDraaiSnelheid = ref(PARAMETER_RANGES.rotation.defaultValue)
const sliderPHLevel = ref(PARAMETER_RANGES.ph.defaultValue)
const sliderZuurstofLevel = ref(PARAMETER_RANGES.oxygen.defaultValue)
const sliderTemperature = ref(PARAMETER_RANGES.temperature.defaultValue)

const started = ref(false)
const elapsedSeconds = ref(0)
const store = useMicrobiologyConfigsStore()

let timerId: number | null = null

const zuurstofMin = PARAMETER_RANGES.oxygen.min
const zuurstofMax = PARAMETER_RANGES.oxygen.max

const rotationMin = PARAMETER_RANGES.rotation.min
const rotationMax = PARAMETER_RANGES.rotation.max

const phmin = PARAMETER_RANGES.ph.min
const phmax = PARAMETER_RANGES.ph.max

const tempmin = PARAMETER_RANGES.temperature.min
const tempmax = PARAMETER_RANGES.temperature.max

const mapY = (value: number, min: number, max: number) => 130 - ((value - min) / (max - min)) * 120

const x1 = 80
const x2 = 160
const x3 = 240

const y1 = computed(() => mapY(sliderDraaiSnelheid.value, rotationMin, rotationMax))
const y2 = computed(() => mapY(sliderPHLevel.value, phmin, phmax))
const y3 = computed(() => mapY(sliderZuurstofLevel.value, zuurstofMin, zuurstofMax))

const graphPoints = computed(() => `${x1},${y1.value} ${x2},${y2.value} ${x3},${y3.value}`)

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
  if (timerId !== null) return
  timerId = window.setInterval(() => {
    elapsedSeconds.value += 0.25
  }, 250)
}

function stopTimer() {
  if (timerId === null) return
  window.clearInterval(timerId)
  timerId = null
}

const compiledExpression = computed(() => {
  const expression = store.activeConfig?.expression ?? '1.2'
  return compileGrowthExpression(expression)
})

const currentEnvironment = computed(() => ({
  rotation: sliderDraaiSnelheid.value,
  ph: sliderPHLevel.value,
  oxygen: sliderZuurstofLevel.value,
  temperature: sliderTemperature.value,
}))

const growthRate = computed(() => {
  const raw = evaluateCompiledGrowthExpression(
    compiledExpression.value,
    createExpressionContext(currentEnvironment.value, elapsedSeconds.value),
  )
  return clampGrowthRate(raw)
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

onMounted(async () => {
  try {
    await store.hydrate()
  } catch {
    return
  }
})

onBeforeUnmount(() => {
  stopTimer()
})
</script>

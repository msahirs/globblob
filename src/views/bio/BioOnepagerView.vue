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

          <polyline :points="graphPoints" fill="none" stroke="var(--color-graph-axes)" stroke-width="3" />

          <circle :cx="x1" :cy="y1" r="5" fill="var(--color-graph-axes)" />
          <circle :cx="x2" :cy="y2" r="5" fill="var(--color-graph-axes)" />
          <circle :cx="x3" :cy="y3" r="5" fill="var(--color-graph-axes)" />
        </svg>
      </div>

      <div class="sliders">
        <div class="slidersHorizontal">

          <div class="sliderUnit">
            <div class="sliderTextHorizontal">
              <span class="sliderLabel">Draaisnelheid</span>
              <div class="infoWrapper" @mouseenter="showInfo('draai')" @mouseleave="hideInfo" @click="toggleInfo('draai')">
                <img :src="infoIconUrl" alt="Info" class="infoIcon" />
                <div v-if="activeInfo === 'draai'" class="infoIconText">
                  Bepaalt hoe snel de cultuur wordt gemengd. Te snel kan stress veroorzaken.
                </div>
              </div>
            </div>
            <input type="range" min="0" max="100" v-model="sliderDraaiSnelheid" class="slider slider-rotating-speed" :style="{ '--value': sliderDraaiSnelheid + '%' }" />
          </div>

          <div class="sliderUnit">
            <div class="sliderTextHorizontal">
              <span class="sliderLabel">pH niveau</span>
              <div class="infoWrapper" @mouseenter="showInfo('pH')" @mouseleave="hideInfo" @click="toggleInfo('pH')">
                <img :src="infoIconUrl" alt="Info icon" class="infoIcon" />
                <div v-if="activeInfo === 'pH'" class="infoIconText">
                  pH niveau bepaalt de zuurgraad van de cultuur. Te zuur of te basisch kan de groei beïnvloeden.
                </div>
              </div>
            </div>
            <input type="range" min="0" max="100" v-model="sliderPHLevel" class="slider slider-PH" :style="{ '--value': sliderPHLevel + '%' }" />
          </div>

          <div class="sliderUnit">
            <div class="sliderTextHorizontal">
              <span class="sliderLabel">Zuurstof niveau</span>
              <div class="infoWrapper" @mouseenter="showInfo('zuurstof')" @mouseleave="hideInfo" @click="toggleInfo('zuurstof')">
                <img :src="infoIconUrl" alt="Info icon" class="infoIcon" />
                <div v-if="activeInfo === 'zuurstof'" class="infoIconText">
                  Zuurstof is essentieel voor aerobe micro-organismen. Te weinig zuurstof kan de groei beperken.
                </div>
              </div>
            </div>
            <input type="range" min="0" max="100" v-model="sliderZuurstofLevel" class="slider slider-oxygen" :style="{ '--value': sliderZuurstofLevel + '%' }" />
          </div>
        </div>
        <div class="sliderUnitVertical">
          <div class="sliderTextHorizontal">
            <span class="sliderLabel">Temperatuur</span>
            <div class="infoWrapper" @mouseenter="showInfo('Temperatuur')" @mouseleave="hideInfo" @click="toggleInfo('Temperatuur')">
              <img :src="infoIconUrl" alt="Info icon" class="infoIcon" />
              <div v-if="activeInfo === 'Temperatuur'" class="infoIconText">
                Temperatuur beïnvloedt de groeisnelheid en het gedrag van micro-organismen.
              </div>
            </div>
          </div>
          <input type="range" min="0" max="100" v-model="sliderTemperature" class="slider slider-vertical" :style="{ '--pointer-color': tempColor, '--track-color': 'var(--slider-temp-track)', '--value': sliderTemperature + '%' }" />
        </div>
      </div>

      <button class="startButton" @click="started = !started">{{ started ? 'Stop' : 'Start' }}</button>
    </main>

    <div class="petriStage" aria-label="Petri dish simulation">
      <div class="petriClip">
        <PetriDishSim :running="started" />
      </div>
      <svg width="666" height="666" viewBox="0 0 666 666" fill="none" xmlns="http://www.w3.org/2000/svg" class="petriFrame">
        <circle cx="333" cy="333" r="330.5" :stroke="petriFrameColor" stroke-width="5" stroke-dasharray="20 20"/>
        <circle cx="332.5" cy="332.5" r="283" :stroke="petriFrameColor" stroke-width="5" stroke-dasharray="20 20"/>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PetriDishSim from '@/components/PetriDishSim.vue'

import titelUrl from '@/assets/bio/TitleDarkMode.svg'
import infoIconUrl from '@/assets/bio/infoIconBlue.svg'

const petriFrameColor = 'var(--petri-frame-color)'

const sliderDraaiSnelheid = ref(50)
const sliderPHLevel = ref(50)
const sliderZuurstofLevel = ref(50)
const sliderTemperature = ref(50)
const started = ref(false)

const mapY = (value: number) => 130 - (value / 100) * 120

const x1 = 80
const x2 = 160
const x3 = 240

const y1 = computed(() => mapY(sliderDraaiSnelheid.value))
const y2 = computed(() => mapY(sliderPHLevel.value))
const y3 = computed(() => mapY(sliderZuurstofLevel.value))

const graphPoints = computed(() => `${x1},${y1.value} ${x2},${y2.value} ${x3},${y3.value}`)

const activeInfo = ref<string | null>(null)
const showInfo = (key: string) => (activeInfo.value = key)
const hideInfo = () => (activeInfo.value = null)
const toggleInfo = (key: string) => (activeInfo.value = activeInfo.value === key ? null : key)

// Function to interpolate between two hex colors
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, r, g, b] = result

  if (!r || !g || !b) return null

  return {
    r: parseInt(r, 16),
    g: parseInt(g, 16),
    b: parseInt(b, 16)
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

const tempColor = computed(() => {
  const minColor = '#ffe000'
  const maxColor = '#ff0000'
  const t = sliderTemperature.value / 100
  return lerpColor(minColor, maxColor, t)
})
</script>


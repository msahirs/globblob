<template>
  <div class="page">
    <header class="header">
      <img :src="titelUrl" alt="Logo" class="logo" />
    </header>

    <main class="content">
      <GraphUnit
        :segments="graphSegments"
        :start-animation="started"
        :speed="20"
      />

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
            <div class="infoWrapper" @mouseenter="showInfo('Temperatuur')" @mouseleave="hideInfo" @click="toggleInfo('Temperatuur')">
              <img :src="infoIconUrl" alt="Info icon" class="infoIcon" />
              <div v-if="activeInfo === 'Temperatuur'" class="infoIconText">
                Temperatuur beïnvloedt de groeisnelheid en het gedrag van micro-organismen.
              </div>
            </div>
          </div>
          <div class="verticalSliderContainer">
            <span class="sliderMax">{{ tempmax }}</span>
            <input type="range" min="tempmin" max="tempmax" v-model="sliderTemperature" class="slider slider-vertical" :style="{ '--pointer-color': tempColor, '--track-color': 'var(--slider-temp-track)', '--value': sliderTemperature + '%' }" />
            <span class="sliderMin">{{ tempmin }}</span>
          </div>
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
import { computed, provide, ref } from 'vue'
import PetriDishSim from '@/components/PetriDishSim.vue'
import SliderUnit from '@/components/sliders/SliderUnit.vue'
import GraphUnit from '@/components/GraphUnit.vue'

import titelUrl from '@/assets/bio/TitleDarkMode.svg'
import infoIconUrl from '@/assets/bio/infoIconBlue.svg'

const petriFrameColor = 'var(--petri-frame-color)'

const graphSegments = [
  {
    formula: '10',
    duration: 5
  },
  {
    formula: '0.3 * x**2 + 10',
    duration: 4
  },
  {
    formula: '-0.1 * x**2 + 11',
    duration: 6
  },
  {
    formula: '0.5 * x + 20',
    duration: 3
  }
]

const sliderDraaiSnelheid = ref(1300)
const sliderPHLevel = ref(7)
const sliderZuurstofLevel = ref(0.5)
const sliderTemperature = ref(30)

const started = ref(false)

const zuurstofMin = 0.6
const zuurstofMax = 1.6

const rotationMin = 800.0
const rotationMax = 1400.0

const phmin = 4.0
const phmax = 10.0

const tempmin = 20.0
const tempmax = 40.0

const activeInfo = ref<string | null>(null)
const showInfo = (key: string) => (activeInfo.value = key)
const hideInfo = () => (activeInfo.value = null)
const toggleInfo = (key: string) => (activeInfo.value = activeInfo.value === key ? null : key)

// Provide the info functions to child components
provide('showInfo', showInfo)
provide('hideInfo', hideInfo)
provide('toggleInfo', toggleInfo)
provide('activeInfo', activeInfo)

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


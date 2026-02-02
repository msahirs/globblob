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

          <polyline :points="graphPoints" fill="none" stroke="#EC6526" stroke-width="3" />

          <circle :cx="x1" :cy="y1" r="5" fill="#EC6526" />
          <circle :cx="x2" :cy="y2" r="5" fill="#EC6526" />
          <circle :cx="x3" :cy="y3" r="5" fill="#EC6526" />
        </svg>
      </div>

      <div class="sliders">
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
          <input type="range" min="0" max="100" v-model="sliderDraaiSnelheid" class="slider slider-orange" :style="{ '--value': sliderDraaiSnelheid + '%' }" />
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
          <input type="range" min="0" max="100" v-model="sliderPHLevel" class="slider slider-green" :style="{ '--value': sliderPHLevel + '%' }" />
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
          <input type="range" min="0" max="100" v-model="sliderZuurstofLevel" class="slider slider-blue" :style="{ '--value': sliderZuurstofLevel + '%' }" />
        </div>
      </div>

      <button class="startButton" @click="started = !started">{{ started ? 'Stop' : 'Start' }}</button>
    </main>

    <div class="petriStage" aria-label="Petri dish simulation">
      <div class="petriClip">
        <PetriDishSim :running="started" />
      </div>
      <img :src="petriFrameUrl" alt="Petri dish" class="petriFrame" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PetriDishSim from '@/components/PetriDishSim.vue'

import titelUrl from '@/assets/bio/titel.svg'
import infoIconUrl from '@/assets/bio/infoIcon.svg'
import petriFrameUrl from '@/assets/bio/PetriDishFrame.svg'

const sliderDraaiSnelheid = ref(50)
const sliderPHLevel = ref(50)
const sliderZuurstofLevel = ref(50)
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
</script>


<script setup lang="ts">
import { computed, inject, type Ref } from 'vue'
import infoIconUrl from '@/assets/bio/infoIconBlue.svg'

const props = defineProps<{
  label: string
  infoKey: string
  infoText: string
  modelValue: number
  min_value: number
  max_value: number
  sliderClass?: string
  steps?: number
  pointerColor?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function onInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target) return

  let value = parseFloat(target.value)

  if (props.steps && props.steps > 1) {
    const step = (props.max_value - props.min_value) / (props.steps - 1)
    value = Math.round((value - props.min_value) / step) * step + props.min_value
  }

  emit('update:modelValue', value)
}

const percent = computed(() => {
  const p = ((props.modelValue - props.min_value) / (props.max_value - props.min_value)) * 100
  return Math.min(100, Math.max(0, p))
})

const stepSize = computed(() => {
  if (!props.steps || props.steps < 2) return 'any'
  return (props.max_value - props.min_value) / (props.steps - 1)
})

// injected info logic
const showInfo = inject<(key: string) => void>('showInfo')!
const hideInfo = inject<() => void>('hideInfo')!
const toggleInfo = inject<(key: string) => void>('toggleInfo')!
const activeInfo = inject<Ref<string | null>>('activeInfo')!
</script>

<template>
  <div class="sliderUnitVertical">
    <div class="sliderTextHorizontal">
      <span class="sliderLabel">{{ label }}</span>

      <div
        class="infoWrapper"
        @mouseenter="showInfo(infoKey)"
        @mouseleave="hideInfo"
        @click="toggleInfo(infoKey)"
      >
        <img :src="infoIconUrl" class="infoIcon" />
        <div v-if="activeInfo === infoKey" class="infoIconText">
          {{ infoText }}
        </div>
      </div>
    </div>

    <div class="verticalSliderContainer">
      <span class="sliderMax">{{ max_value }}</span>

      <input
        type="range"
        :min="min_value"
        :max="max_value"
        :step="stepSize"
        :value="modelValue"
        @input="onInput"
        class="slider slider-vertical"
        :class="sliderClass"
        :style="{
          '--value': percent + '%',
          '--pointer-color': pointerColor,
          '--track-color': 'var(--slider-track)'
        }"
      />

      <span class="sliderMin">{{ min_value }}</span>
    </div>
  </div>
</template>

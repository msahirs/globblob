<template>
  <div class="sliderUnit">
    <div class="sliderTextHorizontal">
      <span class="sliderLabel">{{ label }}</span>
      <div class="infoWrapper" @mouseenter="showInfo(infoKey)" @mouseleave="hideInfo" @click="toggleInfo(infoKey)">
        <img :src="infoIconUrl" alt="Info" class="infoIcon" />
        <div v-if="activeInfo === infoKey" class="infoIconText">
          {{ infoText }}
        </div>
      </div>
    </div>

    <div class="sliderContainer">
      <span class="sliderMin">{{ min_value }}</span>
      <input
        type="range"
        :min="min_value"
        :max="max_value"
        :value="modelValue"
        @input="onInput"
        class="slider"
        :class="sliderClass"
        :style="{ '--value': percent + '%' }"
        :step="stepSize"
      />
      <span class="sliderMax">{{ max_value }}</span>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, inject, type Ref } from 'vue'

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

const props = defineProps<{
  label: string
  infoKey: string
  infoText: string
  modelValue: number
  sliderClass?: string
  min_value: number
  max_value: number
  steps?: number
}>()

console.log(props.modelValue)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const stepSize = computed(() => {
  if (!props.steps || props.steps < 2) return 'any'
  return (props.max_value - props.min_value) / (props.steps - 1)
})

// Inject the info functions from parent
const showInfo = inject<(key: string) => void>('showInfo')!
const hideInfo = inject<() => void>('hideInfo')!
const toggleInfo = inject<(key: string) => void>('toggleInfo')!
const activeInfo = inject<Ref<string | null>>('activeInfo')!

// Import the icon
import infoIconUrl from '@/assets/bio/infoIconBlue.svg'

const percent = computed(() => {
  const p = ((props.modelValue - props.min_value) / (props.max_value - props.min_value)) * 100
  return Math.min(100, Math.max(0, p))
})
</script>

<style scoped>
.sliderContainer {
  display: flex;
  align-items: center;
  margin-top: 1vh;
}

.sliderMin,
.sliderMax {
  font-size: 1.5vh;
  color: var(--color-sliders-text);
  font-family: 'Anonymous Pro', monospace;
  margin: 0 0.5rem;
}

.slider {
  flex: 1;
}
</style>

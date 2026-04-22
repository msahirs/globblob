<template>
  <div class="graphContainer">
    <svg class="graph" viewBox="0 0 400 220" preserve-aspect-ratio="none">
      <!-- Draw the axes-->
      <line :x1="padding" :y1="padding" :x2="padding" :y2="height - padding" class="axis" />
      <line :x1="padding" :y1="height - padding" :x2="width - padding" :y2="height - padding" class="axis" />

      <!-- Draw the graph line -->
      <polyline :points="animatedPoints" fill="none" stroke="var(--color-graph-axes)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed , watch, type PropType } from 'vue'

interface GraphSegment {
  formula: string
  duration: number
}

interface RawPoint {
  x: number
  y: number
}

/**
 * Example input:
 * [
 *   { formula: '4*x + 2', duration: 5 },
 *   { formula: '-2*x + 30', duration: 4 },
 *   { formula: '1.5*x + 10', duration: 6 },
 *   { formula: '0.5*x + 20', duration: 3 }
 * ]
 */

const props = defineProps({
  segments:{
    type: Array as PropType<GraphSegment[]>,
    required: true,
    validator: (value: GraphSegment[]) => value.length === 4
  },
  startAnimation: {
    type: Boolean,
    default: false
   },
   speed: {
    type: Number,
    default: 25 // this is the milliseconds per point
   }
  })

  const width = 400
  const height = 220
  const padding = 30
  const samplesPerUnit = 12

  const allPoints = computed<string[]>(() => {
    const rawPoints: RawPoint[] = []
    let globalX = 0

    for (const segment of props.segments) {

      const duration = Number(segment.duration)
      const formula = segment.formula

      for (let i = 0; i <= duration * samplesPerUnit; i++) {
        const localX = i / samplesPerUnit
        const y = evaluateFormula(formula, localX)
        rawPoints.push({x: globalX + localX, y})
      }
      globalX += duration
    }
    if (!rawPoints.length) return []

    const maxX = Math.max(...rawPoints.map((p) => p.x, 1))
    const minY = Math.min(...rawPoints.map((p) => p.y))
    const maxY = Math.max(...rawPoints.map((p) => p.y))
    const yRange = Math.max(maxY - minY, 1)

    return rawPoints.map((p) => {
      const svgx = padding + (p.x / maxX) * (width - 2 * padding)
      // invert Y because SVG starts at top-left
      const svgy = height - padding - ((p.y - minY) / yRange) * (height - 2 * padding)
      return `${svgx},${svgy}`
    })
  })

  const animatedPoints = ref<string>('')
  let animationFrame: ReturnType<typeof setInterval> | null = null

  watch(
  () => props.startAnimation,
  (shouldStart) => {
    if (shouldStart) {
      runAnimation()
    }
  },
  {immediate: true})


  function runAnimation() {
    if (!allPoints.value.length) return

    if (animationFrame !== null) {
      clearInterval(animationFrame)
    }

    const pointsArray = allPoints.value
    animatedPoints.value = ''

    let index = 0

    animationFrame = setInterval(() => {
      animatedPoints.value = pointsArray.slice(0, index).join(' ')
      index++

      if (index > pointsArray.length) {
        if (animationFrame !== null) {
          clearInterval(animationFrame)
        }
      }
    }, props.speed)
    }

    function evaluateFormula(formula: string, x: number) {
      try {
        // Replace ^ with ** for JS power support
        const safeFormula = formula.replace(/\^/g, '**')

        // eslint-disable-next-line no-new-func
          return new Function('x', `return ${safeFormula}`)(x)
      } catch {
        return 0
      }
    }
 </script>

<style scoped>
.graphContainer {
  /* margin-left: 3%; */
  margin-top: 4vh;
  width: 60%;
  background: transparent;
}

.graph {
  /* width: 100%; */
  height: 35vh;
}

.axis {
  stroke-width: 2;
  stroke: var(--color-graph-axes);
}
</style>


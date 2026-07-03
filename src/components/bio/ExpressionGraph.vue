<script setup lang="ts">
import { Chart, type ChartConfiguration, registerables } from 'chart.js'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GrowthPreviewPoint } from '@/features/microbiology/types'

Chart.register(...registerables)

const props = withDefaults(
  defineProps<{
    points: GrowthPreviewPoint[]
    invalid?: boolean
    invalidMessage?: string
    compact?: boolean
  }>(),
  {
    invalid: false,
    invalidMessage: '',
    compact: false,
  },
)

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart<'line'> | null = null

type ChartPoint = {
  x: number
  y: number
}

const chartData = computed(() => ({
  datasets: [
    {
      label: 'Population at time t',
      data: props.points.map((point): ChartPoint => ({ x: point.x, y: point.y })),
      parsing: false as const,
      borderColor: props.invalid ? 'rgba(255, 123, 186, 0.75)' : '#00ff85',
      backgroundColor: 'rgba(0, 255, 133, 0.12)',
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHitRadius: 12,
      borderWidth: 1.5,
      tension: 0.4,
      fill: false,
    },
  ],
}))

function destroyChart() {
  chart?.destroy()
  chart = null
}

function renderChart() {
  const canvas = canvasRef.value
  if (!canvas) return

  const context = canvas.getContext('2d')
  if (!context) return

  const config: ChartConfiguration<'line', ChartPoint[]> = {
    type: 'line',
    data: chartData.value,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      normalized: true,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: true,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          mode: 'nearest',
          intersect: true,
          callbacks: {
            title(items) {
              const value = items[0]?.parsed.x
              return typeof value === 'number' ? `t = ${value.toFixed(2)}` : ''
            },
            label(item) {
              const value = item.parsed.y
              return typeof value === 'number' ? `Population at time t: ${value.toFixed(2)}` : ''
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          title: {
            display: !props.compact,
            text: 't',
            color: 'rgba(255, 255, 255, 0.86)',
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.74)',
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.12)',
          },
        },
        y: {
          title: {
            display: true,
            text: 'Population at time t',
            color: 'rgba(255, 255, 255, 0.86)',
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.74)',
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.12)',
          },
        },
      },
    },
  }

  destroyChart()
  chart = new Chart(context, config)
}

watch(
  chartData,
  () => {
    renderChart()
  },
  { deep: true },
)

onMounted(() => {
  renderChart()
})

onBeforeUnmount(() => {
  destroyChart()
})
</script>

<template>
  <div class="expressionGraph" :class="{ invalid, compact }">
    <div class="chartSurface">
      <canvas ref="canvasRef" aria-label="Population curve preview"></canvas>
    </div>
    <p v-if="invalidMessage" class="graphMessage">{{ invalidMessage }}</p>
  </div>
</template>

<style scoped>
.expressionGraph {
  display: grid;
  gap: 12px;
}

.chartSurface {
  position: relative;
  height: 340px;
  border-radius: 18px;
  padding: 14px;
  background:
    radial-gradient(circle at top, rgba(0, 198, 255, 0.14), transparent 55%), rgba(0, 11, 31, 0.78);
}

.expressionGraph.compact .chartSurface {
  height: 30vh;
  width: 45vw;
  border-radius: 10px;
}

.graphMessage {
  color: rgba(255, 255, 255, 0.82);
  font-family: 'Anonymous Pro', monospace;
  font-size: 0.95rem;
}
</style>

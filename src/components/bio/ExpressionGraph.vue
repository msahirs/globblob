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
    currentTime?: number | null
  }>(),
  {
    invalid: false,
    invalidMessage: '',
    currentTime: null,
  },
)

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart<'line'> | null = null

type ChartPoint = {
  x: number
  y: number
}

const visiblePoints = computed(() => {
  if (props.currentTime === null || props.currentTime === undefined) {
    return props.points
  }
  return props.points.filter((point) => point.x <= props.currentTime!)
})

const xBounds = computed(() => {
  if (!props.points.length) return { min: 0, max: 50 }
  const xValues = props.points.map((p) => p.x)
  return {
    min: Math.min(...xValues),
    max: Math.max(...xValues),
  }
})

const yBounds = computed(() => {
  if (!props.points.length) return { min: 0, max: 10 }
  const yValues = props.points.map((p) => p.y)
  const minY = Math.min(...yValues)
  const maxY = Math.max(...yValues)
  const padding = (maxY - minY) * 0.1 || 1
  return {
    min: minY - padding,
    max: maxY + padding,
  }
})

const chartData = computed(() => ({
  datasets: [
    {
      label: 'Population at time t',
      data: visiblePoints.value.map((point): ChartPoint => ({ x: point.x, y: point.y })),
      parsing: false as const,
      borderColor: props.invalid ? 'rgba(255, 123, 186, 0.75)' : '#00ff85',
      backgroundColor: 'rgba(0, 255, 133, 0.12)',
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHitRadius: 12,
      borderWidth: 3.5, // Thicker graph line
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

  const playheadPlugin = {
    id: 'playhead',
    afterDraw: (chartInstance: any) => {
      if (props.currentTime === null || props.currentTime === undefined) return
      const ctx = chartInstance.ctx
      const xAxis = chartInstance.scales.x
      const yAxis = chartInstance.scales.y

      const xPixel = xAxis.getPixelForValue(props.currentTime)
      if (xPixel < xAxis.left || xPixel > xAxis.right) return

      ctx.save()

      // Draw dashed playhead line
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(0, 255, 133, 0.75)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.moveTo(xPixel, yAxis.top)
      ctx.lineTo(xPixel, yAxis.bottom)
      ctx.stroke()

      // Trace precise point of intersection
      const tVal = props.currentTime
      if (props.points.length > 0) {
        const firstPoint = props.points[0]
        if (firstPoint) {
          const closestPoint = props.points.reduce((prev, curr) => {
            return Math.abs(curr.x - tVal) < Math.abs(prev.x - tVal) ? curr : prev
          }, firstPoint)

          if (closestPoint) {
            const yPixel = yAxis.getPixelForValue(closestPoint.y)
            if (yPixel >= yAxis.top && yPixel <= yAxis.bottom) {
              ctx.beginPath()
              ctx.arc(xPixel, yPixel, 6, 0, 2 * Math.PI)
              ctx.fillStyle = '#00ff85'
              ctx.shadowBlur = 12
              ctx.shadowColor = '#00ff85'
              ctx.fill()
            }
          }
        }
      }

      ctx.restore()
    },
  }

  const config: ChartConfiguration<'line', ChartPoint[]> = {
    type: 'line',
    data: chartData.value,
    plugins: [playheadPlugin],
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
          titleFont: {
            family: "'Anonymous Pro', monospace",
            size: 14,
          },
          bodyFont: {
            family: "'Anonymous Pro', monospace",
            size: 14,
          },
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
          min: xBounds.value.min,
          max: xBounds.value.max,
          title: {
            display: true,
            text: 't',
            color: 'rgba(255, 255, 255, 0.86)',
            font: {
              family: "'Anonymous Pro', monospace",
              size: 14,
            },
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.74)',
            font: {
              family: "'Anonymous Pro', monospace",
              size: 13,
            },
          },
          grid: {
            display: false, // Remove background grid lines
          },
        },
        y: {
          min: yBounds.value.min,
          max: yBounds.value.max,
          title: {
            display: true,
            text: 'Population at time t',
            color: 'rgba(255, 255, 255, 0.86)',
            font: {
              family: "'Anonymous Pro', monospace",
              size: 14,
            },
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.74)',
            font: {
              family: "'Anonymous Pro', monospace",
              size: 13,
            },
          },
          grid: {
            display: false, // Remove background grid lines
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

watch(
  () => props.currentTime,
  () => {
    chart?.update('none')
  },
)

onMounted(() => {
  renderChart()
})

onBeforeUnmount(() => {
  destroyChart()
})
</script>

<template>
  <div class="expressionGraph" :class="{ invalid }">
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

.graphMessage {
  color: rgba(255, 255, 255, 0.82);
  font-family: 'Anonymous Pro', monospace;
  font-size: 0.95rem;
}
</style>

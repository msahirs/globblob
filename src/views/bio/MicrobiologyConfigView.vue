<template>
  <div class="page configPage">
    <div v-if="hasUnsavedChanges || successNotice" class="floatingNoticeShell">
      <div class="floatingNoticeStack">
        <p v-if="hasUnsavedChanges" class="statusNotice unsavedNotice floatingNotice">
          {{ unsavedNotice }}
        </p>
        <p v-if="successNotice" class="statusNotice okNotice floatingNotice">
          {{ successNotice }}
        </p>
      </div>
    </div>

    <header class="header configHeader">
      <img :src="titelUrl" alt="Logo" class="logo" />
    </header>

    <main class="configContent">
      <aside class="configLibrary panel">
        <div class="panelHeadingRow">
          <h1 class="panelTitle">Saved Curves</h1>
          <button class="secondaryButton" type="button" @click="createConfig">Add</button>
        </div>

        <p v-if="store.lastError" class="statusNotice errorNotice">{{ store.lastError }}</p>

        <ul class="configList" aria-label="Saved curve configurations">
          <li v-for="config in store.configs" :key="config.id">
            <button
              class="configCard"
              :class="{ selected: config.id === selectedId }"
              type="button"
              @click="selectConfig(config.id)"
            >
              <span class="configCardTop">
                <strong>{{ config.name }}</strong>
                <span v-if="config.isActive" class="activeBadge">Active</span>
              </span>
              <span class="configCardExpression">{{ config.expression }}</span>
            </button>
          </li>
        </ul>
      </aside>

      <section class="configWorkbench">
        <div class="previewColumns">
          <section class="panel previewPanel">
            <div class="panelHeadingRow">
              <h2 class="panelTitle">Growth Preview</h2>
            </div>

            <ExpressionGraph
              :points="previewPoints"
              :invalid="!validation.ok"
              :invalid-message="validation.ok ? '' : validation.error"
            />
          </section>

          <section class="panel parameterPanel">
            <div class="panelHeadingRow">
              <h2 class="panelTitle">Parameters</h2>
            </div>

            <div class="parameterGrid">
              <label class="fieldGroup compactField">
                <span class="fieldLabel">Draaisnelheid</span>
                <input
                  v-model.number="previewRotation"
                  class="slider slider-rotating-speed"
                  type="range"
                  :min="parameterRanges.rotation.min"
                  :max="parameterRanges.rotation.max"
                  step="1"
                />
                <span class="fieldValue">{{ previewRotation.toFixed(0) }}</span>
              </label>

              <label class="fieldGroup compactField">
                <span class="fieldLabel">pH niveau</span>
                <input
                  v-model.number="previewPh"
                  class="slider slider-PH"
                  type="range"
                  :min="parameterRanges.ph.min"
                  :max="parameterRanges.ph.max"
                  step="0.1"
                />
                <span class="fieldValue">{{ previewPh.toFixed(1) }}</span>
              </label>

              <label class="fieldGroup compactField">
                <span class="fieldLabel">Zuurstof niveau</span>
                <input
                  v-model.number="previewOxygen"
                  class="slider slider-oxygen"
                  type="range"
                  :min="parameterRanges.oxygen.min"
                  :max="parameterRanges.oxygen.max"
                  step="0.05"
                />
                <span class="fieldValue">{{ previewOxygen.toFixed(2) }}</span>
              </label>

              <label class="fieldGroup compactField">
                <span class="fieldLabel">Temperatuur</span>
                <input
                  v-model.number="previewTemperature"
                  class="slider"
                  type="range"
                  :min="parameterRanges.temperature.min"
                  :max="parameterRanges.temperature.max"
                  step="0.5"
                  :style="{
                    '--pointer-color': previewTemperatureColor,
                    '--track-color': 'var(--slider-temp-track)',
                    '--value': `${temperatureSliderPercent}%`,
                  }"
                />
                <span class="fieldValue">{{ previewTemperature.toFixed(1) }} C</span>
              </label>
            </div>
          </section>
        </div>

        <section class="panel editorPanel">
          <div class="panelHeadingRow">
            <h2 class="panelTitle">Editor</h2>
            <span class="validationBadge" :class="validation.ok ? 'ok' : 'error'">
              {{ validation.ok ? 'Valid expression' : 'Needs attention' }}
            </span>
          </div>

          <label class="fieldGroup">
            <span class="fieldLabel">Configuration name</span>
            <input v-model="draftName" class="textField" type="text" maxlength="80" />
          </label>

          <label class="fieldGroup">
            <span class="fieldLabel">Expression for current population at time t</span>
            <textarea
              v-model="draftExpression"
              class="expressionField"
              rows="5"
              spellcheck="false"
              placeholder="Example: piecewise(t < 15, 0.6, t < 45, 1.3 + 0.2 * sin(t / 6), 0.4)"
            ></textarea>
          </label>

          <div class="helpGrid">
            <div>
              <p class="fieldLabel">Variables</p>
              <p class="inlineHelp">
                <span>t</span>
                <span>rotation</span>
                <span>ph</span>
                <span>oxygen</span>
                <span>temperature</span>
              </p>
            </div>
            <div>
              <p class="fieldLabel">Constants</p>
              <p class="inlineHelp">
                <span>pi</span>
                <span>e</span>
              </p>
            </div>
            <div>
              <p class="fieldLabel">Functions</p>
              <p class="inlineHelp">
                <span>sin</span>
                <span>cos</span>
                <span>tan</span>
                <span>abs</span>
                <span>ln</span>
                <span>min</span>
                <span>max</span>
                <span>sqrt</span>
                <span>log</span>
                <span>exp</span>
                <span>piecewise</span>
              </p>
            </div>
          </div>

          <p class="panelCopy helperCopy">
            Time is the main input variable. For interval-based expressions use
            <strong>piecewise(condition, value, ..., default)</strong>, for example
            <strong>piecewise(t &lt; 10, 0.2, t &lt; 30, 1.4, 0.5)</strong>. Use
            <strong>ln</strong> for natural log, <strong>log</strong> for base-10 log, and
            <strong>^</strong> for powers. Constants <strong>pi</strong> and <strong>e</strong>
            are also available.
          </p>

          <p class="statusNotice" :class="validation.ok ? 'okNotice' : 'errorNotice'">
            {{ validation.ok ? validation.message : validation.error }}
          </p>

          <div class="actionRow">
            <button class="primaryButton" type="button" :disabled="!canSave" @click="saveConfig">
              Save changes
            </button>
            <button
              class="secondaryButton"
              type="button"
              :disabled="!canSetActive"
              @click="setActiveConfig"
            >
              Set active
            </button>
            <button
              class="ghostButton"
              type="button"
              :disabled="!selectedConfig || isNewDraft"
              @click="deleteConfig"
            >
              Delete
            </button>
          </div>
        </section>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ExpressionGraph from '@/components/bio/ExpressionGraph.vue'
import titelUrl from '@/assets/bio/TitleDarkMode.svg'
import {
  DEFAULT_ENVIRONMENT_PARAMETERS,
  DEFAULT_GROWTH_CONFIG_NAME,
  DEFAULT_GROWTH_EXPRESSION,
  PARAMETER_RANGES,
} from '@/features/microbiology/defaults'
import {
  buildGrowthPreview,
  compileGrowthExpression,
  createExpressionContext,
  evaluateCompiledGrowthExpression,
  getExpressionValidationMessage,
} from '@/features/microbiology/expressionEngine'
import { useMicrobiologyConfigsStore } from '@/stores/microbiologyConfigs'

const store = useMicrobiologyConfigsStore()

const selectedId = ref<number | null>(null)
const isNewDraft = ref(false)
const draftName = ref('')
const draftExpression = ref('')
const successNotice = ref('')
const activeConfigId = ref<number | null>(null)

const previewRotation = ref(DEFAULT_ENVIRONMENT_PARAMETERS.rotation)
const previewPh = ref(DEFAULT_ENVIRONMENT_PARAMETERS.ph)
const previewOxygen = ref(DEFAULT_ENVIRONMENT_PARAMETERS.oxygen)
const previewTemperature = ref(DEFAULT_ENVIRONMENT_PARAMETERS.temperature)

const parameterRanges = PARAMETER_RANGES

const previewParameters = computed(() => ({
  rotation: Number(previewRotation.value),
  ph: Number(previewPh.value),
  oxygen: Number(previewOxygen.value),
  temperature: Number(previewTemperature.value),
}))

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

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0'))
    .join('')}`
}

const temperatureSliderPercent = computed(() => {
  const min = parameterRanges.temperature.min
  const max = parameterRanges.temperature.max
  const span = max - min
  if (span <= 0) return 0
  return ((previewTemperature.value - min) / span) * 100
})

const previewTemperatureColor = computed(() => {
  const ratio = Math.max(0, Math.min(1, temperatureSliderPercent.value / 100))
  return lerpColor('#ffe000', '#ff0000', ratio)
})

const selectedConfig = computed(
  () => store.configs.find((config) => config.id === selectedId.value) ?? null,
)

function buildNextDraftName() {
  const usedNames = new Set(store.configs.map((config) => config.name.toLowerCase()))
  if (!usedNames.has(DEFAULT_GROWTH_CONFIG_NAME.toLowerCase())) {
    return DEFAULT_GROWTH_CONFIG_NAME
  }

  let index = 2
  while (usedNames.has(`${DEFAULT_GROWTH_CONFIG_NAME} ${index}`.toLowerCase())) {
    index++
  }
  return `${DEFAULT_GROWTH_CONFIG_NAME} ${index}`
}

function applySelectedConfig() {
  if (!selectedConfig.value) return
  isNewDraft.value = false
  draftName.value = selectedConfig.value.name
  draftExpression.value = selectedConfig.value.expression
}

const hasUnsavedChanges = computed(() => {
  if (isNewDraft.value) {
    return Boolean(draftName.value.trim() || draftExpression.value.trim())
  }

  if (!selectedConfig.value) return false

  return (
    draftName.value !== selectedConfig.value.name ||
    draftExpression.value !== selectedConfig.value.expression
  )
})

const unsavedNotice = computed(() => {
  if (!hasUnsavedChanges.value) return ''
  return isNewDraft.value ? 'New curve has not been saved yet.' : 'You have unsaved changes.'
})

const validation = computed(() => {
  try {
    const compiled = compileGrowthExpression(draftExpression.value)
    evaluateCompiledGrowthExpression(compiled, createExpressionContext(previewParameters.value, 0))
    return {
      ok: true as const,
      compiled,
      message: 'Expression is valid.',
    }
  } catch (error) {
    return {
      ok: false as const,
      error: getExpressionValidationMessage(error),
    }
  }
})

const previewPoints = computed(() => {
  if (!validation.value.ok) return []
  return buildGrowthPreview(validation.value.compiled, previewParameters.value)
})

const canSave = computed(() => {
  return Boolean(draftName.value.trim() && validation.value.ok && hasUnsavedChanges.value)
})

const canSetActive = computed(() => {
  return Boolean(
    selectedConfig.value && !isNewDraft.value && selectedConfig.value.id !== activeConfigId.value,
  )
})

let successNoticeTimer: number | null = null

function showSuccessNotice(message: string) {
  successNotice.value = message
  if (successNoticeTimer) {
    window.clearTimeout(successNoticeTimer)
  }
  successNoticeTimer = window.setTimeout(() => {
    successNotice.value = ''
    successNoticeTimer = null
  }, 2600)
}

function selectConfig(id: number) {
  selectedId.value = id
  applySelectedConfig()
}

function createConfig() {
  selectedId.value = null
  isNewDraft.value = true
  draftName.value = buildNextDraftName()
  draftExpression.value = DEFAULT_GROWTH_EXPRESSION
}

async function saveConfig() {
  if (!validation.value.ok || !draftName.value.trim()) return
  const configName = draftName.value
  try {
    const saved = isNewDraft.value
      ? await store.createConfig({
          name: draftName.value,
          expression: draftExpression.value,
        })
      : await store.saveConfig(selectedConfig.value!.id, {
          name: draftName.value,
          expression: draftExpression.value,
        })
    selectedId.value = saved.id
    applySelectedConfig()
    showSuccessNotice(`"${configName}" was saved.`)
  } catch {
    return
  }
}

async function setActiveConfig() {
  if (!selectedConfig.value || selectedConfig.value.id === activeConfigId.value) return
  const configName = selectedConfig.value.name
  try {
    await store.setActiveConfig(selectedConfig.value.id)
    activeConfigId.value = selectedConfig.value.id
    showSuccessNotice(`"${configName}" is now the active curve.`)
  } catch {
    return
  }
}

async function deleteConfig() {
  if (!selectedConfig.value) return
  const configName = selectedConfig.value.name
  if (!window.confirm(`Delete "${configName}"?`)) return
  try {
    await store.deleteConfig(selectedConfig.value.id)
    const nextConfig = store.activeConfig ?? store.configs[0] ?? null
    selectedId.value = nextConfig?.id ?? null
    applySelectedConfig()
    showSuccessNotice(`"${configName}" was deleted.`)
  } catch {
    return
  }
}

watch(
  () => store.configs,
  (configs) => {
    if (!configs.length) return

    const activeConfig = configs.find((config) => config.isActive)
    if (activeConfig) {
      activeConfigId.value = activeConfig.id
    }

    if (!selectedId.value || !configs.some((config) => config.id === selectedId.value)) {
      selectedId.value = store.activeConfig?.id ?? configs[0]?.id ?? null
      applySelectedConfig()
    }
  },
  { deep: true },
)

onMounted(async () => {
  try {
    await store.hydrate()
  } catch {
    return
  }
  activeConfigId.value =
    store.activeConfig?.id ?? store.configs.find((config) => config.isActive)?.id ?? null
  selectedId.value = store.activeConfig?.id ?? store.configs[0]?.id ?? null
  applySelectedConfig()
})

onBeforeUnmount(() => {
  if (successNoticeTimer) {
    window.clearTimeout(successNoticeTimer)
  }
})
</script>

<style scoped>
.configPage {
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 32px;
}

.configHeader {
  align-items: flex-start;
  gap: 20px;
  padding: 20px 32px 12px;
}

.configHeader .logo {
  height: clamp(44px, 6vw, 68px);
}

.configContent {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 24px;
  padding: 0 32px 32px;
  align-items: start;
}

.configWorkbench,
.previewColumns {
  display: grid;
  gap: 24px;
}

.previewColumns {
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.8fr);
  align-items: start;
}

.panel {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 28px;
  padding: 24px;
  background:
    linear-gradient(180deg, rgba(1, 42, 114, 0.42), rgba(0, 11, 31, 0.78)), rgba(0, 21, 58, 0.92);
  backdrop-filter: blur(10px);
}

.panelHeadingRow {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: flex-start;
}

.panelTitle {
  color: white;
  font-family: 'Bebas Neue', monospace;
  font-size: clamp(1.9rem, 2vw, 2.5rem);
  line-height: 1;
}

.panelCopy,
.statusNotice,
.fieldLabel,
.fieldValue {
  color: rgba(255, 255, 255, 0.84);
  font-family: 'Anonymous Pro', monospace;
}

.panelCopy {
  margin-top: 14px;
  line-height: 1.5;
}

.helperCopy {
  margin-top: 12px;
  font-size: 0.92rem;
}

.floatingNoticeShell {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  justify-content: center;
  padding: 16px 32px 0;
  pointer-events: none;
}

.floatingNoticeStack {
  width: min(720px, 100%);
  display: grid;
  gap: 10px;
}

.floatingNotice {
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
}

.configList {
  list-style: none;
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.configCard {
  width: 100%;
  text-align: left;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.04);
  color: white;
  cursor: pointer;
}

.configCard.selected {
  border-color: rgba(0, 255, 133, 0.72);
  background: rgba(0, 255, 133, 0.12);
}

.configCardTop {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-family: 'Anonymous Pro', monospace;
}

.configCardExpression {
  display: block;
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Anonymous Pro', monospace;
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activeBadge,
.validationBadge {
  border-radius: 999px;
  padding: 6px 10px;
  font-family: 'Anonymous Pro', monospace;
  font-size: 0.78rem;
}

.activeBadge,
.validationBadge.ok,
.okNotice {
  background: rgba(0, 255, 133, 0.16);
  color: #92ffd2;
}

.validationBadge.error,
.errorNotice {
  background: rgba(255, 123, 186, 0.16);
  color: #ffc3de;
}

.unsavedNotice {
  background: rgba(255, 224, 0, 0.14);
  color: #ffe98a;
}

.fieldGroup {
  display: grid;
  gap: 8px;
}

.editorPanel,
.parameterGrid {
  display: grid;
  gap: 16px;
}

.textField,
.expressionField {
  width: 100%;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 7, 20, 0.66);
  color: white;
  padding: 14px 16px;
  font-family: 'Anonymous Pro', monospace;
}

.expressionField {
  min-height: 128px;
  resize: vertical;
}

.helpGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 18px;
}

.inlineHelp {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.inlineHelp span {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.88);
  font-family: 'Anonymous Pro', monospace;
  font-size: 0.78rem;
}

.actionRow {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.primaryButton,
.secondaryButton,
.ghostButton {
  border-radius: 999px;
  padding: 11px 18px;
  font-family: 'Anonymous Pro', monospace;
  cursor: pointer;
}

.primaryButton {
  border: none;
  background: var(--color-start-button);
  color: var(--bg-primary);
}

.secondaryButton {
  border: 1px solid rgba(0, 198, 255, 0.45);
  background: rgba(0, 198, 255, 0.12);
  color: white;
}

.ghostButton {
  border: 1px solid rgba(255, 123, 186, 0.4);
  background: transparent;
  color: #ffd0e6;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.compactField {
  gap: 6px;
}

@media (max-width: 1100px) {
  .configContent,
  .previewColumns {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .floatingNoticeShell {
    padding: 12px 20px 0;
  }

  .configHeader {
    padding: 16px 20px 10px;
  }

  .configContent {
    padding: 0 20px 24px;
  }

  .helpGrid {
    grid-template-columns: 1fr;
  }
}
</style>

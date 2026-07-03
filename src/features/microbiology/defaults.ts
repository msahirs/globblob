import type { EnvironmentParameters } from './types'

export const PARAMETER_RANGES = {
  rotation: { min: 800, max: 1400, defaultValue: 1300, label: 'Draaisnelheid' },
  ph: { min: 4, max: 10, defaultValue: 7, label: 'pH niveau' },
  oxygen: { min: 0.6, max: 1.6, defaultValue: 0.9, label: 'Zuurstof niveau' },
  temperature: { min: 20, max: 40, defaultValue: 30, label: 'Temperatuur' },
} as const

export const DEFAULT_ENVIRONMENT_PARAMETERS: EnvironmentParameters = {
  rotation: PARAMETER_RANGES.rotation.defaultValue,
  ph: PARAMETER_RANGES.ph.defaultValue,
  oxygen: PARAMETER_RANGES.oxygen.defaultValue,
  temperature: PARAMETER_RANGES.temperature.defaultValue,
}

export const GROWTH_RATE_LIMITS = {
  min: -20,
  max: 20,
}

export const PREVIEW_X_DOMAIN = {
  min: 0,
  max: 50,
  samples: 1000,
}

export const DEFAULT_GROWTH_CONFIG_NAME = 'Baseline culture curve'

export const DEFAULT_GROWTH_EXPRESSION = [
  'max(',
  '  0,',
  '  1.1',
  '  + 0.35 * sin(t / 9)',
  '  + 1.45 * ((oxygen - 0.6) / 1.0)',
  '  + 0.75 * ((temperature - 20) / 20)',
  '  - 1.15 * abs(((ph - 4) / 6) - 0.5)',
  '  - 0.55 * ((rotation - 800) / 600)',
  ')',
].join(' ')

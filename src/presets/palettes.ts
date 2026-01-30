export type PalettePreset = {
  name: string
  colors: [RGB, RGB, RGB]
}

export type RGB = { r: number; g: number; b: number }

export const PALETTE_PRESETS: readonly PalettePreset[] = [
  { name: 'Candy Shop', colors: [{ r: 0.31, g: 0.14, b: 0.33 }, { r: 0.87, g: 0.85, b: 0.65 }, { r: 0.54, g: 0.99, b: 0.77 }] },
  { name: 'Biolab', colors: [{ r: 0.12, g: 0.07, b: 0.15 }, { r: 0.1, g: 0.31, b: 0.2 }, { r: 0.87, g: 0.93, b: 0.53 }] },
  { name: 'Forest', colors: [{ r: 0.13, g: 0.11, b: 0.0 }, { r: 0.4, g: 0.7, b: 0.2 }, { r: 0.9, g: 1.0, b: 0.6 }] },
  { name: 'Tropical Reef', colors: [{ r: 0.05, g: 0.1, b: 0.2 }, { r: 0.15, g: 0.7, b: 0.6 }, { r: 0.95, g: 0.9, b: 0.55 }] },
  { name: 'Deep Ocean', colors: [{ r: 0.0, g: 0.1, b: 0.3 }, { r: 0.2, g: 0.6, b: 0.8 }, { r: 0.95, g: 0.95, b: 0.8 }] },
  { name: 'Cold Snap', colors: [{ r: 0.0, g: 0.07, b: 0.12 }, { r: 0.3, g: 0.55, b: 0.7 }, { r: 0.95, g: 0.98, b: 1.0 }] },
  { name: 'Amethyst Dawn', colors: [{ r: 0.18, g: 0.08, b: 0.25 }, { r: 0.65, g: 0.4, b: 0.55 }, { r: 0.95, g: 0.88, b: 0.8 }] },
  { name: 'Rosewood Sky', colors: [{ r: 0.15, g: 0.05, b: 0.07 }, { r: 0.4, g: 0.3, b: 0.55 }, { r: 0.92, g: 0.88, b: 0.98 }] },
  { name: 'Neon Rust', colors: [{ r: 0.2, g: 0.07, b: 0.037 }, { r: 0.72, g: 0.41, b: 0.17 }, { r: 0.6, g: 0.95, b: 0.94 }] },
  { name: 'Heat Wave', colors: [{ r: 0.15, g: 0.0, b: 0.15 }, { r: 0.8, g: 0.5, b: 0.3 }, { r: 1.0, g: 0.9, b: 0.66 }] },
  { name: 'Core Meltdown', colors: [{ r: 0.22, g: 0.05, b: 0.27 }, { r: 0.8, g: 0.66, b: 0.2 }, { r: 0.985, g: 0.985, b: 0.7 }] },
] as const

export function paletteOptions() {
  return Object.fromEntries(PALETTE_PRESETS.map((p) => [p.name, p.name]))
}

export function getPalette(name: string) {
  return PALETTE_PRESETS.find((p) => p.name === name) ?? PALETTE_PRESETS[0]!
}


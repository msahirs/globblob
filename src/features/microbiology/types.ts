export type GrowthExpressionConfig = {
  id: number
  name: string
  expression: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type EnvironmentParameters = {
  rotation: number
  ph: number
  oxygen: number
  temperature: number
}

export type ExpressionContext = EnvironmentParameters & {
  t: number
}

export type GrowthPreviewPoint = {
  x: number
  y: number
}

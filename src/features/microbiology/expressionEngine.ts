import { parse, type MathNode, type SymbolNode } from 'mathjs'
import { DEFAULT_ENVIRONMENT_PARAMETERS, GROWTH_RATE_LIMITS, PREVIEW_X_DOMAIN } from './defaults'
import type { EnvironmentParameters, ExpressionContext, GrowthPreviewPoint } from './types'

type CompiledGrowthExpression = {
  expression: string
  node: MathNode
}

const SCIENTIFIC_FUNCTIONS = {
  abs: Math.abs,
  acos: Math.acos,
  asin: Math.asin,
  atan: Math.atan,
  atan2: Math.atan2,
  ceil: Math.ceil,
  cos: Math.cos,
  exp: Math.exp,
  floor: Math.floor,
  hypot: Math.hypot,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  max: Math.max,
  min: Math.min,
  piecewise: (...values: number[]) => {
    if (values.length < 3) {
      throw new Error('piecewise requires condition/value pairs and a default value')
    }

    const lastIndex = values.length - 1
    for (let index = 0; index < lastIndex; index += 2) {
      if (index + 1 >= lastIndex) {
        throw new Error('piecewise requires condition/value pairs and a default value')
      }

      if (Boolean(values[index])) {
        return values[index + 1]
      }
    }

    return values[lastIndex]
  },
  round: Math.round,
  sign: Math.sign,
  sin: Math.sin,
  sqrt: Math.sqrt,
  tan: Math.tan,
}

const ALLOWED_NODE_TYPES = new Set([
  'AccessorNode',
  'ConditionalNode',
  'ConstantNode',
  'FunctionNode',
  'OperatorNode',
  'ParenthesisNode',
  'RelationalNode',
  'SymbolNode',
])

const DISALLOWED_NODE_TYPES = new Set([
  'ArrayNode',
  'AssignmentNode',
  'BlockNode',
  'FunctionAssignmentNode',
  'ObjectNode',
  'RangeNode',
])

const ALLOWED_SYMBOLS = new Set([
  'e',
  'oxygen',
  'ph',
  'pi',
  'rotation',
  't',
  'tau',
  'temperature',
  ...Object.keys(SCIENTIFIC_FUNCTIONS),
])

function ensureAllowedNodes(node: MathNode) {
  node.traverse((child) => {
    if (DISALLOWED_NODE_TYPES.has(child.type)) {
      throw new Error(`Unsupported syntax: ${child.type}`)
    }
    if (!ALLOWED_NODE_TYPES.has(child.type) && !DISALLOWED_NODE_TYPES.has(child.type)) {
      throw new Error(`Unsupported syntax: ${child.type}`)
    }
    if (child.type === 'SymbolNode') {
      const symbolName = String((child as SymbolNode).name)
      if (!ALLOWED_SYMBOLS.has(symbolName)) {
        throw new Error(`Unknown symbol: ${symbolName}`)
      }
    }
  })
}

function createScope(context: ExpressionContext) {
  return {
    ...SCIENTIFIC_FUNCTIONS,
    ...context,
    e: Math.E,
    pi: Math.PI,
    tau: Math.PI * 2,
  }
}

function evaluateNode(node: MathNode, context: ExpressionContext) {
  const result = node.compile().evaluate(createScope(context))
  if (typeof result !== 'number' || Number.isNaN(result) || !Number.isFinite(result)) {
    throw new Error('Expression must resolve to a finite number')
  }
  return result
}

export function createExpressionContext(
  parameters: EnvironmentParameters = DEFAULT_ENVIRONMENT_PARAMETERS,
  t = 0,
): ExpressionContext {
  return {
    ...parameters,
    t,
  }
}

export function compileGrowthExpression(expression: string): CompiledGrowthExpression {
  const trimmed = expression.trim()
  if (!trimmed) {
    throw new Error('Enter a math expression before saving')
  }

  const node = parse(trimmed)
  ensureAllowedNodes(node)
  return { expression: trimmed, node }
}

export function evaluateCompiledGrowthExpression(
  compiled: CompiledGrowthExpression,
  context: ExpressionContext,
) {
  return evaluateNode(compiled.node, context)
}

export function evaluateGrowthExpression(expression: string, context: ExpressionContext) {
  return evaluateCompiledGrowthExpression(compileGrowthExpression(expression), context)
}

export function clampGrowthRate(value: number) {
  return Math.min(GROWTH_RATE_LIMITS.max, Math.max(GROWTH_RATE_LIMITS.min, value))
}

export function buildGrowthPreview(
  compiled: CompiledGrowthExpression,
  parameters: EnvironmentParameters = DEFAULT_ENVIRONMENT_PARAMETERS,
  options = PREVIEW_X_DOMAIN,
) {
  const points: GrowthPreviewPoint[] = []
  const span = options.max - options.min
  const stepCount = Math.max(2, options.samples)

  for (let index = 0; index < stepCount; index++) {
    const interpolation = stepCount === 1 ? 0 : index / (stepCount - 1)
    const t = options.min + span * interpolation
    const y = evaluateCompiledGrowthExpression(compiled, createExpressionContext(parameters, t))
    points.push({ x: t, y })
  }

  return points
}

export function getExpressionValidationMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'The expression could not be parsed'
}

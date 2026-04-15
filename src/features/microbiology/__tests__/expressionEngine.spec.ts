import { describe, expect, it } from 'vitest'
import { PREVIEW_X_DOMAIN } from '../defaults'
import {
  buildGrowthPreview,
  clampGrowthRate,
  compileGrowthExpression,
  createExpressionContext,
  evaluateCompiledGrowthExpression,
} from '../expressionEngine'

describe('expressionEngine', () => {
  it('evaluates a valid expression against the microbiology parameters', () => {
    const compiled = compileGrowthExpression(
      '1 + ((oxygen - 0.6) / 1.0) * 2 - abs(((ph - 4) / 6) - 0.5)',
    )
    const value = evaluateCompiledGrowthExpression(
      compiled,
      createExpressionContext({ rotation: 1000, ph: 7, oxygen: 1.2, temperature: 31 }, 12),
    )

    expect(value).toBeTypeOf('number')
    expect(clampGrowthRate(value)).toBeGreaterThan(0)
  })

  it('allows negative growth rates instead of clamping them to zero', () => {
    expect(clampGrowthRate(-3.5)).toBe(-3.5)
    expect(clampGrowthRate(-200)).toBe(-200)
  })

  it('builds preview points across the configured domain', () => {
    const compiled = compileGrowthExpression('sin(t / 10) + ((temperature - 20) / 20)')
    const points = buildGrowthPreview(compiled)

    expect(points.length).toBeGreaterThan(10)
    expect(points[0]?.x).toBe(PREVIEW_X_DOMAIN.min)
    expect(points[points.length - 1]?.x).toBe(PREVIEW_X_DOMAIN.max)
  })

  it('supports ln and base-10 log', () => {
    const compiled = compileGrowthExpression('ln(e) + log(100)')
    const value = evaluateCompiledGrowthExpression(
      compiled,
      createExpressionContext({ rotation: 1000, ph: 7, oxygen: 1.2, temperature: 31 }, 12),
    )

    expect(value).toBeCloseTo(3)
  })

  it('supports pi and e constants', () => {
    const compiled = compileGrowthExpression('sin(pi / 2) + ln(e)')
    const value = evaluateCompiledGrowthExpression(
      compiled,
      createExpressionContext({ rotation: 1000, ph: 7, oxygen: 1.2, temperature: 31 }, 12),
    )

    expect(value).toBeCloseTo(2)
  })

  it('supports ^ for powers', () => {
    const compiled = compileGrowthExpression('t ^ 2')
    const value = evaluateCompiledGrowthExpression(
      compiled,
      createExpressionContext({ rotation: 1000, ph: 7, oxygen: 1.2, temperature: 31 }, 4),
    )

    expect(value).toBe(16)
  })

  it('supports piecewise time intervals', () => {
    const compiled = compileGrowthExpression('piecewise(t < 10, 0.5, t < 20, 1.25, 0.2)')

    const early = evaluateCompiledGrowthExpression(
      compiled,
      createExpressionContext({ rotation: 1000, ph: 7, oxygen: 1.2, temperature: 31 }, 5),
    )
    const mid = evaluateCompiledGrowthExpression(
      compiled,
      createExpressionContext({ rotation: 1000, ph: 7, oxygen: 1.2, temperature: 31 }, 15),
    )
    const late = evaluateCompiledGrowthExpression(
      compiled,
      createExpressionContext({ rotation: 1000, ph: 7, oxygen: 1.2, temperature: 31 }, 25),
    )

    expect(early).toBe(0.5)
    expect(mid).toBe(1.25)
    expect(late).toBe(0.2)
  })

  it('rejects unknown symbols', () => {
    expect(() => compileGrowthExpression('x + 1')).toThrow('Unknown symbol: x')
    expect(() => compileGrowthExpression('oxygenNorm + 1')).toThrow('Unknown symbol: oxygenNorm')
    expect(() => compileGrowthExpression('clamp(t, 0, 1)')).toThrow('Unknown symbol: clamp')
    expect(() => compileGrowthExpression('when(t < 1, 1)')).toThrow('Unknown symbol: when')
    expect(() => compileGrowthExpression('pow(t, 2)')).toThrow('Unknown symbol: pow')
  })
})

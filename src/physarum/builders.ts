import type * as THREE from 'three'
import { PingPongShader } from './PingPongShader'
import { Shader } from './Shader'

export class ShaderBuilder {
  private width = 0
  private height = 0
  private vertexString = ''
  private fragmentString = ''
  private uniforms: Record<string, unknown> = {}
  private attributes: Record<string, THREE.BufferAttribute | THREE.InterleavedBufferAttribute> = {}
  private options: Partial<THREE.RenderTargetOptions> = {}

  withVertex(vertexString: string) {
    this.vertexString = vertexString
    return this
  }

  withFragment(fragmentString: string) {
    this.fragmentString = fragmentString
    return this
  }

  withDimensions(width: number, height: number) {
    this.width = width
    this.height = height
    return this
  }

  withUniform(key: string, val: unknown) {
    this.uniforms[key] = val
    return this
  }

  withUniforms(obj: Record<string, unknown>) {
    Object.entries(obj).forEach(([k, v]) => (this.uniforms[k] = v))
    return this
  }

  withAttribute(key: string, val: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
    this.attributes[key] = val
    return this
  }

  withAttributes(obj: Record<string, THREE.BufferAttribute | THREE.InterleavedBufferAttribute>) {
    Object.entries(obj).forEach(([k, v]) => (this.attributes[k] = v))
    return this
  }

  withOptions(options: Partial<THREE.RenderTargetOptions>) {
    this.options = options
    return this
  }

  create() {
    return new Shader(
      this.width,
      this.height,
      this.vertexString,
      this.fragmentString,
      this.uniforms,
      this.attributes,
      this.options,
    )
  }
}

export class PingPongShaderBuilder {
  private width = 0
  private height = 0
  private vertexString = ''
  private fragmentString = ''
  private uniforms: Record<string, unknown> = {}
  private data: Float32Array | null = null
  private options: Partial<THREE.RenderTargetOptions> = {}

  withVertex(vertexString: string) {
    this.vertexString = vertexString
    return this
  }

  withFragment(fragmentString: string) {
    this.fragmentString = fragmentString
    return this
  }

  withDimensions(width: number, height: number) {
    this.width = width
    this.height = height
    return this
  }

  withTextureData(data: Float32Array) {
    this.data = data
    return this
  }

  withUniform(key: string, val: unknown) {
    this.uniforms[key] = val
    return this
  }

  withUniforms(obj: Record<string, unknown>) {
    Object.entries(obj).forEach(([k, v]) => (this.uniforms[k] = v))
    return this
  }

  withOptions(options: Partial<THREE.RenderTargetOptions>) {
    this.options = options
    return this
  }

  create() {
    return new PingPongShader(
      this.width,
      this.height,
      this.vertexString,
      this.fragmentString,
      this.uniforms,
      this.data,
      this.options,
    )
  }
}

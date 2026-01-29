import * as THREE from 'three'
import { orthographicCamera } from './util'

export class PingPongShader {
  readonly width: number
  readonly height: number
  private material: THREE.ShaderMaterial
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera | null = null
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null

  private renderTarget0: THREE.WebGLRenderTarget
  private renderTarget1: THREE.WebGLRenderTarget
  private currentRenderTarget: THREE.WebGLRenderTarget
  private nextRenderTarget: THREE.WebGLRenderTarget

  constructor(
    width: number,
    height: number,
    vertex: string,
    fragment: string,
    uniforms: Record<string, unknown>,
    data: Float32Array | null = null,
    options: Partial<THREE.RenderTargetOptions> = {},
  ) {
    this.width = width
    this.height = height

    const opts: THREE.RenderTargetOptions = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
      stencilBuffer: false,
      ...options,
    }

    if (data === null) data = new Float32Array(width * height * 4)

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType)
    texture.needsUpdate = true

    this.renderTarget0 = new THREE.WebGLRenderTarget(width, height, opts)
    this.renderTarget1 = new THREE.WebGLRenderTarget(width, height, opts)

    // Mirror the reference implementation's initialization behavior.
    this.renderTarget0.texture = texture.clone()
    this.renderTarget1.texture = texture

    this.currentRenderTarget = this.renderTarget0
    this.nextRenderTarget = this.renderTarget1

    const wrappedUniforms: Record<string, THREE.IUniform> = {
      input_texture: { value: this.getTexture() },
    }
    for (const key in uniforms) wrappedUniforms[key] = { value: uniforms[key] }

    this.material = new THREE.ShaderMaterial({
      uniforms: wrappedUniforms,
      blending: THREE.NoBlending,
      vertexShader: vertex,
      fragmentShader: fragment,
    })
    this.material.transparent = true

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material)
    this.mesh.scale.set(width, height, 1)
    this.getScene().add(this.mesh)
  }

  setUniform(key: string, value: unknown) {
    if (!Object.prototype.hasOwnProperty.call(this.material.uniforms, key)) {
      this.material.uniforms[key] = { value: null }
    }
    this.material.uniforms[key]!.value = value
  }

  getUniforms() {
    return this.material.uniforms
  }

  getTexture() {
    return this.currentRenderTarget.texture
  }

  private switchRenderTargets() {
    this.currentRenderTarget =
      this.currentRenderTarget === this.renderTarget0 ? this.renderTarget1 : this.renderTarget0
    this.nextRenderTarget =
      this.currentRenderTarget === this.renderTarget0 ? this.renderTarget1 : this.renderTarget0
  }

  render(renderer: THREE.WebGLRenderer, updatedUniforms: Record<string, unknown> = {}) {
    if (!this.mesh) return
    this.switchRenderTargets()

    this.mesh.visible = true
    this.material.uniforms['input_texture']!.value = this.getTexture()

    for (const key in updatedUniforms) {
      if (!Object.prototype.hasOwnProperty.call(this.material.uniforms, key)) {
        this.material.uniforms[key] = { value: null }
      }
      this.material.uniforms[key]!.value = updatedUniforms[key]
    }

    renderer.setSize(this.width, this.height)
    renderer.setRenderTarget(this.nextRenderTarget)
    renderer.render(this.getScene(), this.getCamera())
    renderer.setRenderTarget(null)
    this.mesh.visible = false
  }

  private getScene() {
    if (!this.scene) this.scene = new THREE.Scene()
    return this.scene
  }

  private getCamera() {
    if (!this.camera) {
      this.camera = orthographicCamera(this.width, this.height)
      this.camera.position.z = 1
    }
    return this.camera
  }

  dispose() {
    if (this.mesh) {
      this.getScene().remove(this.mesh)
      this.mesh.geometry.dispose()
      this.mesh = null
    }
    this.camera = null
    this.material.dispose()
    this.currentRenderTarget.texture.dispose()
    this.nextRenderTarget.texture.dispose()
    this.renderTarget0.dispose()
    this.renderTarget1.dispose()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this.renderTarget0 as any) = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this.renderTarget1 as any) = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this.currentRenderTarget as any) = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this.nextRenderTarget as any) = null
    this.scene = null
  }
}

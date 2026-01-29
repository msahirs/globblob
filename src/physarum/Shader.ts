import * as THREE from 'three'
import { orthographicCamera } from './util'

export class Shader {
  readonly width: number
  readonly height: number
  private material: THREE.ShaderMaterial
  private renderTarget: THREE.WebGLRenderTarget
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera | null = null
  private mesh: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null

  constructor(
    width: number,
    height: number,
    vertex: string,
    fragment: string,
    uniforms: Record<string, unknown>,
    attributes: Record<string, THREE.BufferAttribute | THREE.InterleavedBufferAttribute>,
    options: Partial<THREE.RenderTargetOptions> = {},
  ) {
    this.width = width
    this.height = height

    const wrappedUniforms: Record<string, THREE.IUniform> = {}
    for (const key in uniforms) wrappedUniforms[key] = { value: uniforms[key] }

    this.material = new THREE.ShaderMaterial({
      uniforms: wrappedUniforms,
      blending: THREE.NoBlending,
      transparent: true,
      vertexShader: vertex,
      fragmentShader: fragment,
    })

    const opts: THREE.RenderTargetOptions = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      ...options,
    }

    this.renderTarget = new THREE.WebGLRenderTarget(width, height, opts)

    const bufferGeometry = new THREE.BufferGeometry()
    for (const key in attributes) bufferGeometry.setAttribute(key, attributes[key]!)
    this.mesh = new THREE.Points(bufferGeometry, this.material)

    this.getScene().add(this.mesh)
  }

  setUniform(key: string, value: unknown) {
    if (!Object.prototype.hasOwnProperty.call(this.material.uniforms, key)) {
      this.material.uniforms[key] = { value: null }
    }
    this.material.uniforms[key]!.value = value
  }

  getTexture() {
    return this.renderTarget.texture
  }

  render(renderer: THREE.WebGLRenderer, updatedUniforms: Record<string, unknown> = {}) {
    if (!this.mesh) return
    this.mesh.visible = true

    for (const key in updatedUniforms) {
      if (!Object.prototype.hasOwnProperty.call(this.material.uniforms, key)) {
        this.material.uniforms[key] = { value: null }
      }
      this.material.uniforms[key]!.value = updatedUniforms[key]
    }

    renderer.setSize(this.width, this.height)
    renderer.setRenderTarget(this.renderTarget)
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
    this.renderTarget.texture.dispose()
    this.renderTarget.dispose()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this.renderTarget as any) = null
    this.scene = null
  }
}

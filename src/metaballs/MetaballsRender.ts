import * as THREE from 'three'
import GUI from 'lil-gui'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import {
  BLOOM_MASK_FRAGMENT,
  BLOOM_OVERLAY_FRAGMENT,
  FIELD_FRAGMENT,
  MARCHING_SQUARES_FRAGMENT,
  PASS_THROUGH_VERTEX,
} from './shaders'
import { getPalette, paletteOptions } from '@/presets/palettes'

type Ball = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

const MAX_BALLS = 32

function rndFloat(min: number, max: number) {
  return min + (max - min) * Math.random()
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export class MetaballsRender {
  private readonly container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private camera: THREE.OrthographicCamera
  private scene: THREE.Scene
  private fieldScene: THREE.Scene
  private bloomComposer: EffectComposer | null = null
  private bloomPass: UnrealBloomPass | null = null
  private bloomScene: THREE.Scene
  private bloomMaterial: THREE.ShaderMaterial
  private bloomMesh: THREE.Mesh
  private bloomOverlayScene: THREE.Scene
  private bloomOverlayMaterial: THREE.ShaderMaterial
  private bloomOverlayMesh: THREE.Mesh
  private drawBufferSize = new THREE.Vector2()

  private gui: GUI | null = null

  private fieldRT: THREE.WebGLRenderTarget | null = null
  private fieldMaterial: THREE.ShaderMaterial
  private fieldMesh: THREE.Mesh
  private finalMaterial: THREE.ShaderMaterial
  private finalMesh: THREE.Mesh

  private balls: Ball[] = []
  private ballUniforms: THREE.Vector4[] = Array.from({ length: MAX_BALLS }, () => new THREE.Vector4())
  private lastMs = 0
  private fieldDirty = true

  private width = 1
  private height = 1

  private settings = {
    gridSize: 512,
    ballCount: 8,
    animate: false,
    speed: 1.0,
    threshold: 1.0,
    softness: 0.06,
    lineWidthPx: 1.5,
    showContours: false,
    colorMode: 1 as 0 | 1, // 0=single, 1=palette
    paletteName: 'Biolab',
    usePaletteBg: true,
    blobColor: '#2aa39b',
    background: '#050505',
    addOnClick: true,
    clickMinRadius: 18,
    clickMaxRadius: 60,
    clickReplaceOldest: true,
    clickMotion: 1.0,
    bloomEnabled: true,
    bloomStrength: 0.75,
    bloomRadius: 0.35,
    bloomThreshold: 0.0,
    reset: () => this.reset(),
  }

  constructor(container: HTMLElement) {
    this.container = container

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.autoClear = false

    this.scene = new THREE.Scene()
    this.fieldScene = new THREE.Scene()

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    this.camera.position.z = 1

    this.fieldMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uWorldSize: { value: new THREE.Vector2(1, 1) },
        uFieldSize: { value: new THREE.Vector2(1, 1) },
        uBallCount: { value: 0 },
        uBalls: { value: this.ballUniforms },
      },
      vertexShader: PASS_THROUGH_VERTEX,
      fragmentShader: FIELD_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    })

    this.finalMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uField: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uFieldSize: { value: new THREE.Vector2(1, 1) },
        uThreshold: { value: this.settings.threshold },
        uLineWidthPx: { value: this.settings.lineWidthPx },
        uSoftness: { value: this.settings.softness },
        uShowContours: { value: this.settings.showContours },
        uPalette0: { value: new THREE.Color(0x000000) },
        uPalette1: { value: new THREE.Color(0x000000) },
        uPalette2: { value: new THREE.Color(0x000000) },
        uUsePaletteBg: { value: this.settings.usePaletteBg },
        uColorMode: { value: this.settings.colorMode },
        uBlobColor: { value: new THREE.Color(this.settings.blobColor) },
        uBgColor: { value: new THREE.Color(this.settings.background) },
      },
      vertexShader: PASS_THROUGH_VERTEX,
      fragmentShader: MARCHING_SQUARES_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    })

    this.fieldMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.fieldMaterial)
    this.finalMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.finalMaterial)
    this.fieldScene.add(this.fieldMesh)
    this.scene.add(this.finalMesh)

    this.bloomScene = new THREE.Scene()
    this.bloomMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uField: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uFieldSize: { value: new THREE.Vector2(1, 1) },
        uThreshold: { value: this.settings.threshold },
        uSoftness: { value: this.settings.softness },
        uPalette0: { value: new THREE.Color(0x000000) },
        uPalette1: { value: new THREE.Color(0x000000) },
        uPalette2: { value: new THREE.Color(0x000000) },
        uColorMode: { value: this.settings.colorMode },
        uBlobColor: { value: new THREE.Color(this.settings.blobColor) },
      },
      vertexShader: PASS_THROUGH_VERTEX,
      fragmentShader: BLOOM_MASK_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    })
    this.bloomMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.bloomMaterial)
    this.bloomScene.add(this.bloomMesh)

    this.bloomOverlayScene = new THREE.Scene()
    this.bloomOverlayMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tBloom: { value: null },
        uBloomMix: { value: 1.0 },
      },
      vertexShader: PASS_THROUGH_VERTEX,
      fragmentShader: BLOOM_OVERLAY_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
    })
    this.bloomOverlayMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.bloomOverlayMaterial)
    this.bloomOverlayScene.add(this.bloomOverlayMesh)

    this.applyPalette()
  }

  init() {
    if (typeof navigator !== 'undefined' && navigator.userAgent?.toLowerCase().includes('jsdom')) return false

    this.width = Math.max(1, this.container.clientWidth)
    this.height = Math.max(1, this.container.clientHeight)

    this.renderer.setSize(this.width, this.height)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.container.appendChild(this.renderer.domElement)

    if (!this.renderer.capabilities.isWebGL2) return false

    this.resize()
    this.reset()
    this.initBloom()
    this.initGui()
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('resize', this.resize)
    return true
  }

  private initBloom() {
    this.bloomComposer?.dispose()
    this.bloomComposer = new EffectComposer(this.renderer)
    ;(this.bloomComposer as unknown as { renderToScreen: boolean }).renderToScreen = false
    this.bloomComposer.setPixelRatio(this.renderer.getPixelRatio())
    this.bloomComposer.setSize(this.width, this.height)

    const renderPass = new RenderPass(this.bloomScene, this.camera)
    this.bloomComposer.addPass(renderPass)

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      this.settings.bloomStrength,
      this.settings.bloomRadius,
      this.settings.bloomThreshold,
    )
    bloom.enabled = this.settings.bloomEnabled
    this.bloomComposer.addPass(bloom)
    this.bloomPass = bloom
  }

  private initGui() {
    const gui = new GUI()
    this.gui = gui
    gui.close()

    const f = gui.addFolder('Metaballs')
    f.close()

    f.add(this.settings, 'ballCount', 1, 24, 1).name('Balls').onFinishChange(() => this.reset())
    f.add(this.settings, 'animate').name('Animate').onChange(() => (this.fieldDirty = true))
    f.add(this.settings, 'threshold', 0.2, 4.0, 0.01).name('Threshold')
    f.add(this.settings, 'softness', 0.001, 0.2, 0.001).name('Softness')
    f.add(this.settings, 'speed', 0, 4, 0.01).name('Speed')
    f.add(this.settings, 'gridSize', [128, 192, 256, 384, 512, 768, 1024])
      .name('Grid base')
      .onFinishChange(() => this.recreateFieldTarget())
    f.add(this.settings, 'showContours').name('Contours')
    f.add(this.settings, 'lineWidthPx', 0.5, 6.0, 0.1).name('Line width')
    f.add(this.settings, 'colorMode', { Single: 0, Palette: 1 })
      .name('Color mode')
      .onChange(() => (this.fieldDirty = true))
    f.add(this.settings, 'paletteName', paletteOptions()).name('Palette').onChange(() => this.applyPalette())
    f.add(this.settings, 'usePaletteBg').name('Palette bg')
    f.addColor(this.settings, 'blobColor').name('Blob color')
    f.addColor(this.settings, 'background').name('Background')

    const s = gui.addFolder('Spawn')
    s.close()
    s.add(this.settings, 'addOnClick').name('Click add')
    s.add(this.settings, 'clickMinRadius', 4, 140, 1).name('Min radius')
    s.add(this.settings, 'clickMaxRadius', 4, 220, 1).name('Max radius')
    s.add(this.settings, 'clickReplaceOldest').name('Replace oldest')
    s.add(this.settings, 'clickMotion', 0, 3, 0.01).name('Motion')

    const b = gui.addFolder('Bloom')
    b.close()
    b.add(this.settings, 'bloomEnabled')
      .name('Enabled')
      .onChange(() => {
        if (this.bloomPass) this.bloomPass.enabled = this.settings.bloomEnabled
      })
    b.add(this.settings, 'bloomStrength', 0, 3, 0.01)
      .name('Strength')
      .onChange(() => {
        if (this.bloomPass) this.bloomPass.strength = this.settings.bloomStrength
      })
    b.add(this.settings, 'bloomRadius', 0, 1, 0.01)
      .name('Radius')
      .onChange(() => {
        if (this.bloomPass) this.bloomPass.radius = this.settings.bloomRadius
      })
    b.add(this.settings, 'bloomThreshold', 0, 1, 0.01)
      .name('Threshold')
      .onChange(() => {
        if (this.bloomPass) this.bloomPass.threshold = this.settings.bloomThreshold
      })
    f.add(this.settings, 'reset').name('Reset')
  }

  private applyPalette() {
    const preset = getPalette(this.settings.paletteName)
    ;(this.finalMaterial.uniforms.uPalette0!.value as THREE.Color).setRGB(preset.colors[0].r, preset.colors[0].g, preset.colors[0].b)
    ;(this.finalMaterial.uniforms.uPalette1!.value as THREE.Color).setRGB(preset.colors[1].r, preset.colors[1].g, preset.colors[1].b)
    ;(this.finalMaterial.uniforms.uPalette2!.value as THREE.Color).setRGB(preset.colors[2].r, preset.colors[2].g, preset.colors[2].b)

    ;(this.bloomMaterial.uniforms.uPalette0!.value as THREE.Color).copy(this.finalMaterial.uniforms.uPalette0!.value as THREE.Color)
    ;(this.bloomMaterial.uniforms.uPalette1!.value as THREE.Color).copy(this.finalMaterial.uniforms.uPalette1!.value as THREE.Color)
    ;(this.bloomMaterial.uniforms.uPalette2!.value as THREE.Color).copy(this.finalMaterial.uniforms.uPalette2!.value as THREE.Color)

    this.finalMaterial.uniforms.uUsePaletteBg!.value = this.settings.usePaletteBg
    this.finalMaterial.uniforms.uColorMode!.value = this.settings.colorMode
    this.bloomMaterial.uniforms.uColorMode!.value = this.settings.colorMode

    this.fieldDirty = true
  }

  private recreateFieldTarget() {
    this.fieldRT?.dispose()

    const base = this.settings.gridSize
    const aspect = this.width / Math.max(1, this.height)
    let w = base
    let h = base
    if (aspect >= 1) w = Math.max(2, Math.round(base * aspect))
    else h = Math.max(2, Math.round(base / aspect))

    this.fieldRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    })
    this.fieldRT.texture.generateMipmaps = false

    ;(this.fieldMaterial.uniforms.uFieldSize!.value as THREE.Vector2).set(w, h)
    ;(this.finalMaterial.uniforms.uFieldSize!.value as THREE.Vector2).set(w, h)
    this.finalMaterial.uniforms.uField!.value = this.fieldRT.texture
    ;(this.bloomMaterial.uniforms.uFieldSize!.value as THREE.Vector2).set(w, h)
    this.bloomMaterial.uniforms.uField!.value = this.fieldRT.texture
    this.fieldDirty = true
  }

  private reset() {
    this.recreateFieldTarget()

    this.balls = []
    const boundsX = this.width * 0.5
    const boundsY = this.height * 0.5

    const ballCount = Math.min(MAX_BALLS, Math.max(1, Math.floor(this.settings.ballCount)))
    for (let i = 0; i < ballCount; i++) {
      const r = rndFloat(24, 64)
      this.balls.push({
        x: rndFloat(-boundsX + r, boundsX - r),
        y: rndFloat(-boundsY + r, boundsY - r),
        vx: rndFloat(-1, 1),
        vy: rndFloat(-1, 1),
        r,
      })
    }

    for (let i = 0; i < MAX_BALLS; i++) {
      const b = this.balls[i]
      if (!b) {
        this.ballUniforms[i]!.set(0, 0, 0, 0)
        continue
      }
      this.ballUniforms[i]!.set(b.x, b.y, b.r, 0)
    }
    this.fieldMaterial.uniforms.uBalls!.value = this.ballUniforms
    this.fieldMaterial.uniforms.uBallCount!.value = this.balls.length

    this.lastMs = 0
    this.fieldDirty = true
  }

  private resize = () => {
    if (!this.renderer) return
    this.width = Math.max(1, this.container.clientWidth || window.innerWidth)
    this.height = Math.max(1, this.container.clientHeight || window.innerHeight)
    this.renderer.setSize(this.width, this.height, false)
    this.bloomComposer?.setPixelRatio(this.renderer.getPixelRatio())
    this.bloomComposer?.setSize(this.width, this.height)
    if (this.bloomPass) this.bloomPass.setSize(this.width, this.height)

    // Use a world coordinate system in pixel-ish units centered at 0,0.
    this.camera.left = -this.width / 2
    this.camera.right = this.width / 2
    this.camera.top = this.height / 2
    this.camera.bottom = -this.height / 2
    this.camera.updateProjectionMatrix()

    this.fieldMesh.scale.set(this.width, this.height, 1)
    this.finalMesh.scale.set(this.width, this.height, 1)
    this.bloomMesh.scale.set(this.width, this.height, 1)
    this.bloomOverlayMesh.scale.set(this.width, this.height, 1)

    ;(this.fieldMaterial.uniforms.uWorldSize!.value as THREE.Vector2).set(this.width, this.height)
    this.renderer.getDrawingBufferSize(this.drawBufferSize)
    ;(this.finalMaterial.uniforms.uResolution!.value as THREE.Vector2).copy(this.drawBufferSize)
    ;(this.bloomMaterial.uniforms.uResolution!.value as THREE.Vector2).copy(this.drawBufferSize)

    this.recreateFieldTarget()
  }

  render(nowMs: number) {
    if (!this.fieldRT) return

    if (!this.lastMs) this.lastMs = nowMs
    const baseDt = clamp((nowMs - this.lastMs) / 1000, 0, 0.05) * this.settings.speed
    this.lastMs = nowMs

    const dt = this.settings.animate ? baseDt : 0
    this.tick(dt)

    this.fieldMaterial.uniforms.uBallCount!.value = this.balls.length

    if (this.fieldDirty) {
      this.renderer.setRenderTarget(this.fieldRT)
      this.renderer.render(this.fieldScene, this.camera)
      this.renderer.setRenderTarget(null)
      this.fieldDirty = false
    }

    this.finalMaterial.uniforms.uThreshold!.value = this.settings.threshold
    this.finalMaterial.uniforms.uSoftness!.value = this.settings.softness
    this.finalMaterial.uniforms.uLineWidthPx!.value = this.settings.lineWidthPx
    this.finalMaterial.uniforms.uShowContours!.value = this.settings.showContours
    this.finalMaterial.uniforms.uColorMode!.value = this.settings.colorMode
    this.finalMaterial.uniforms.uUsePaletteBg!.value = this.settings.usePaletteBg
    ;(this.finalMaterial.uniforms.uBlobColor!.value as THREE.Color).set(this.settings.blobColor)
    ;(this.finalMaterial.uniforms.uBgColor!.value as THREE.Color).set(this.settings.background)

    this.bloomMaterial.uniforms.uThreshold!.value = this.settings.threshold
    this.bloomMaterial.uniforms.uSoftness!.value = this.settings.softness
    this.bloomMaterial.uniforms.uColorMode!.value = this.settings.colorMode
    ;(this.bloomMaterial.uniforms.uBlobColor!.value as THREE.Color).set(this.settings.blobColor)

    this.renderer.setRenderTarget(null)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)

    if (this.settings.bloomEnabled && this.bloomComposer && this.bloomPass) {
      this.bloomComposer.render()
      const bloomTexture = (this.bloomComposer as unknown as { readBuffer: THREE.WebGLRenderTarget }).readBuffer.texture
      this.bloomOverlayMaterial.uniforms.tBloom!.value = bloomTexture
      this.bloomOverlayMaterial.uniforms.uBloomMix!.value = 1.0
      this.renderer.render(this.bloomOverlayScene, this.camera)
    }
  }

  private tick(dt: number) {
    if (dt <= 0) return
    const boundsX = this.width * 0.5
    const boundsY = this.height * 0.5

    for (let i = 0; i < this.balls.length; i++) {
      const b = this.balls[i]!
      b.x += b.vx * 140 * dt
      b.y += b.vy * 140 * dt

      if (b.x + b.r > boundsX) {
        b.x = boundsX - b.r
        b.vx = -Math.abs(b.vx)
      } else if (b.x - b.r < -boundsX) {
        b.x = -boundsX + b.r
        b.vx = Math.abs(b.vx)
      }

      if (b.y + b.r > boundsY) {
        b.y = boundsY - b.r
        b.vy = -Math.abs(b.vy)
      } else if (b.y - b.r < -boundsY) {
        b.y = -boundsY + b.r
        b.vy = Math.abs(b.vy)
      }

      this.ballUniforms[i]!.set(b.x, b.y, b.r, 0)
    }

    this.fieldDirty = true
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.settings.addOnClick) return
    if (!this.renderer?.domElement) return

    const rect = this.renderer.domElement.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / Math.max(1, rect.width)
    const ny = (e.clientY - rect.top) / Math.max(1, rect.height)
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return

    const ndcX = nx * 2 - 1
    const ndcY = -(ny * 2 - 1)
    const p = new THREE.Vector3(ndcX, ndcY, 0).unproject(this.camera)
    this.addBall(p.x, p.y)
  }

  private addBall(x: number, y: number) {
    const minR = Math.min(this.settings.clickMinRadius, this.settings.clickMaxRadius)
    const maxR = Math.max(this.settings.clickMinRadius, this.settings.clickMaxRadius)
    const r = rndFloat(minR, maxR)

    const motion = this.settings.clickMotion
    const ball: Ball = {
      x,
      y,
      vx: rndFloat(-1, 1) * motion,
      vy: rndFloat(-1, 1) * motion,
      r,
    }

    if (this.balls.length >= MAX_BALLS) {
      if (!this.settings.clickReplaceOldest) return
      this.balls.shift()
      this.balls.push(ball)

      for (let i = 0; i < MAX_BALLS; i++) {
        const b = this.balls[i]
        if (!b) this.ballUniforms[i]!.set(0, 0, 0, 0)
        else this.ballUniforms[i]!.set(b.x, b.y, b.r, 0)
      }
    } else {
      this.balls.push(ball)
      const i = this.balls.length - 1
      this.ballUniforms[i]!.set(ball.x, ball.y, ball.r, 0)
    }

    this.fieldMaterial.uniforms.uBalls!.value = this.ballUniforms
    this.fieldMaterial.uniforms.uBallCount!.value = this.balls.length
    this.fieldDirty = true
  }

  dispose() {
    window.removeEventListener('resize', this.resize)
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown)

    this.gui?.destroy()
    this.gui = null

    this.bloomComposer?.dispose()
    this.bloomComposer = null
    this.bloomPass = null

    this.fieldRT?.dispose()
    this.fieldRT = null

    this.fieldMaterial.dispose()
    this.finalMaterial.dispose()
    this.bloomMaterial.dispose()
    this.bloomOverlayMaterial.dispose()

    this.fieldMesh.geometry.dispose()
    this.finalMesh.geometry.dispose()
    this.bloomMesh.geometry.dispose()
    this.bloomOverlayMesh.geometry.dispose()

    this.scene.clear()
    this.fieldScene.clear()
    this.bloomScene.clear()
    this.bloomOverlayScene.clear()

    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}

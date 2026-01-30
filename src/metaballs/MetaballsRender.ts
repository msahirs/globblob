import * as THREE from 'three'
import GUI from 'lil-gui'
import { FIELD_FRAGMENT, MARCHING_SQUARES_FRAGMENT, PASS_THROUGH_VERTEX } from './shaders'

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

  private gui: GUI | null = null

  private fieldRT: THREE.WebGLRenderTarget | null = null
  private fieldMaterial: THREE.ShaderMaterial
  private fieldMesh: THREE.Mesh
  private finalMaterial: THREE.ShaderMaterial
  private finalMesh: THREE.Mesh

  private balls: Ball[] = []
  private ballUniforms: THREE.Vector4[] = Array.from({ length: MAX_BALLS }, () => new THREE.Vector4())
  private lastMs = 0

  private width = 1
  private height = 1

  private settings = {
    gridSize: 256,
    ballCount: 8,
    speed: 1.0,
    threshold: 1.0,
    softness: 0.06,
    lineWidthPx: 1.5,
    showContours: true,
    blobColor: '#2aa39b',
    background: '#050505',
    reset: () => this.reset(),
  }

  constructor(container: HTMLElement) {
    this.container = container

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))

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
    this.initGui()
    window.addEventListener('resize', this.resize)
    return true
  }

  private initGui() {
    const gui = new GUI()
    this.gui = gui
    gui.close()

    const f = gui.addFolder('Metaballs')
    f.close()

    f.add(this.settings, 'ballCount', 1, 24, 1).name('Balls').onFinishChange(() => this.reset())
    f.add(this.settings, 'threshold', 0.2, 4.0, 0.01).name('Threshold')
    f.add(this.settings, 'softness', 0.001, 0.2, 0.001).name('Softness')
    f.add(this.settings, 'speed', 0, 4, 0.01).name('Speed')
    f.add(this.settings, 'gridSize', [96, 128, 160, 192, 224, 256, 320, 384, 512])
      .name('Grid')
      .onFinishChange(() => this.recreateFieldTarget())
    f.add(this.settings, 'showContours').name('Contours')
    f.add(this.settings, 'lineWidthPx', 0.5, 6.0, 0.1).name('Line width')
    f.addColor(this.settings, 'blobColor').name('Blob color')
    f.addColor(this.settings, 'background').name('Background')
    f.add(this.settings, 'reset').name('Reset')
  }

  private recreateFieldTarget() {
    this.fieldRT?.dispose()

    const size = this.settings.gridSize
    this.fieldRT = new THREE.WebGLRenderTarget(size, size, {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    })
    this.fieldRT.texture.generateMipmaps = false

    ;(this.fieldMaterial.uniforms.uFieldSize!.value as THREE.Vector2).set(size, size)
    ;(this.finalMaterial.uniforms.uFieldSize!.value as THREE.Vector2).set(size, size)
    this.finalMaterial.uniforms.uField!.value = this.fieldRT.texture
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
  }

  private resize = () => {
    if (!this.renderer) return
    this.width = Math.max(1, this.container.clientWidth || window.innerWidth)
    this.height = Math.max(1, this.container.clientHeight || window.innerHeight)
    this.renderer.setSize(this.width, this.height, false)

    // Use a world coordinate system in pixel-ish units centered at 0,0.
    this.camera.left = -this.width / 2
    this.camera.right = this.width / 2
    this.camera.top = this.height / 2
    this.camera.bottom = -this.height / 2
    this.camera.updateProjectionMatrix()

    this.fieldMesh.scale.set(this.width, this.height, 1)
    this.finalMesh.scale.set(this.width, this.height, 1)

    ;(this.fieldMaterial.uniforms.uWorldSize!.value as THREE.Vector2).set(this.width, this.height)
    ;(this.finalMaterial.uniforms.uResolution!.value as THREE.Vector2).set(this.width, this.height)
  }

  render(nowMs: number) {
    if (!this.fieldRT) return

    if (!this.lastMs) this.lastMs = nowMs
    const dt = clamp((nowMs - this.lastMs) / 1000, 0, 0.05) * this.settings.speed
    this.lastMs = nowMs

    this.tick(dt)

    this.fieldMaterial.uniforms.uBallCount!.value = this.balls.length

    this.renderer.setRenderTarget(this.fieldRT)
    this.renderer.render(this.fieldScene, this.camera)
    this.renderer.setRenderTarget(null)

    this.finalMaterial.uniforms.uThreshold!.value = this.settings.threshold
    this.finalMaterial.uniforms.uSoftness!.value = this.settings.softness
    this.finalMaterial.uniforms.uLineWidthPx!.value = this.settings.lineWidthPx
    this.finalMaterial.uniforms.uShowContours!.value = this.settings.showContours
    ;(this.finalMaterial.uniforms.uBlobColor!.value as THREE.Color).set(this.settings.blobColor)
    ;(this.finalMaterial.uniforms.uBgColor!.value as THREE.Color).set(this.settings.background)

    this.renderer.render(this.scene, this.camera)
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
  }

  dispose() {
    window.removeEventListener('resize', this.resize)

    this.gui?.destroy()
    this.gui = null

    this.fieldRT?.dispose()
    this.fieldRT = null

    this.fieldMaterial.dispose()
    this.finalMaterial.dispose()

    this.fieldMesh.geometry.dispose()
    this.finalMesh.geometry.dispose()

    this.scene.clear()
    this.fieldScene.clear()

    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}

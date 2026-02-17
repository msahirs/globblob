import * as THREE from 'three'
import GUI from 'lil-gui'
import Stats from 'three/addons/libs/stats.module.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { getPalette, paletteOptions } from '@/presets/palettes'
import { BLOOM_OVERLAY_FRAGMENT, PASS_THROUGH_VERTEX } from './shaders'

type Cell = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  seed: number
}

type InitOptions = {
  showStats?: boolean
  showGui?: boolean
}

const PETRI_INNER_RADIUS_RATIO = 283 / 666
const ABSOLUTE_MAX_CELLS = 5000
const INITIAL_CELL_MIN = 3
const INITIAL_CELL_MAX = 5

const CELL_VERTEX = `
attribute float instanceSeed;
varying vec2 vUv;
varying float vSeed;
void main() {
  vUv = uv;
  vSeed = instanceSeed;
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`

const CELL_FRAGMENT = `
precision highp float;
varying vec2 vUv;
varying float vSeed;

uniform int uColorMode;
uniform vec3 uBlobColor;
uniform vec3 uPalette0;
uniform vec3 uPalette1;
uniform vec3 uPalette2;
uniform float uEdgeSoftness;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  if (d > 1.0) discard;

  float edge = 1.0 - smoothstep(1.0 - uEdgeSoftness, 1.0, d);
  float ring = smoothstep(0.50, 1.0, d);
  float noise = fract(sin(vSeed * 91.17) * 43758.5453);

  vec3 coreColor = (uColorMode == 0) ? uBlobColor : mix(uPalette1, uPalette2, 0.22 + 0.50 * noise);
  vec3 rimColor = (uColorMode == 0) ? uBlobColor * 0.82 : mix(uPalette0, uPalette1, 0.45 + 0.35 * noise);
  vec3 color = mix(coreColor, rimColor, ring);

  gl_FragColor = vec4(color, edge);
}
`

const BLOOM_CELL_FRAGMENT = `
precision highp float;
varying vec2 vUv;

uniform int uColorMode;
uniform vec3 uBlobColor;
uniform vec3 uPalette2;
uniform float uBloomGain;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  if (d > 1.0) discard;

  float glow = pow(max(0.0, 1.0 - d), 2.5);
  vec3 base = (uColorMode == 0) ? uBlobColor : uPalette2;
  gl_FragColor = vec4(base * glow * uBloomGain, glow);
}
`

function rndFloat(min: number, max: number) {
  return min + (max - min) * Math.random()
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function reflect(vx: number, vy: number, nx: number, ny: number) {
  const dot = vx * nx + vy * ny
  return { vx: vx - 2 * dot * nx, vy: vy - 2 * dot * ny }
}

export class MetaballsDishRender {
  private readonly container: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly camera: THREE.OrthographicCamera
  private readonly scene: THREE.Scene
  private readonly bloomScene: THREE.Scene
  private readonly overlayScene: THREE.Scene

  private bloomComposer: EffectComposer | null = null
  private bloomPass: UnrealBloomPass | null = null
  private overlayMaterial: THREE.ShaderMaterial
  private overlayMesh: THREE.Mesh

  private resizeObserver: ResizeObserver | null = null
  private stats: Stats | null = null
  private gui: GUI | null = null

  private readonly baseMaterial: THREE.ShaderMaterial
  private readonly bloomMaterial: THREE.ShaderMaterial
  private readonly cellGeometry: THREE.PlaneGeometry
  private readonly baseMesh: THREE.InstancedMesh
  private readonly bloomMesh: THREE.InstancedMesh
  private readonly instanceSeedAttr: THREE.InstancedBufferAttribute

  private readonly tmpObject = new THREE.Object3D()
  private readonly tmpVec3 = new THREE.Vector3()
  private readonly tmpClearColor = new THREE.Color()

  private cells: Cell[] = []
  private growthAccumulator = 0
  private lastMs = 0
  private frameDirty = true

  private width = 1
  private height = 1

  private settings = {
    animate: false,
    growthRate: 1.2,
    maxCells: 1000,
    movementSpeed: 4.0,
    motionJitter: 2.5,
    motionDamping: 0.92,
    buddingGap: 0.4,
    cellRadiusMin: 4.0,
    cellRadiusMax: 6.0,
    collisionGap: 0.15,
    parentBiasNewest: 0.35,
    addOnClick: true,
    colorMode: 1 as 0 | 1,
    paletteName: 'Microbial Green',
    blobColor: '#20694A',
    background: '#faf8e1',
    edgeSoftness: 0.18,
    bloomEnabled: false,
    bloomStrength: 0.45,
    bloomRadius: 0.25,
    bloomThreshold: 0.72,
    bloomGain: 1.0,
    reset: () => this.reset(),
  }

  constructor(container: HTMLElement) {
    this.container = container

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.autoClear = false

    this.scene = new THREE.Scene()
    this.bloomScene = new THREE.Scene()
    this.overlayScene = new THREE.Scene()

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    this.camera.position.z = 1

    this.cellGeometry = new THREE.PlaneGeometry(2, 2)
    const seeds = new Float32Array(ABSOLUTE_MAX_CELLS)
    this.instanceSeedAttr = new THREE.InstancedBufferAttribute(seeds, 1)
    this.cellGeometry.setAttribute('instanceSeed', this.instanceSeedAttr)

    this.baseMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColorMode: { value: this.settings.colorMode },
        uBlobColor: { value: new THREE.Color(this.settings.blobColor) },
        uPalette0: { value: new THREE.Color(0x000000) },
        uPalette1: { value: new THREE.Color(0x000000) },
        uPalette2: { value: new THREE.Color(0x000000) },
        uEdgeSoftness: { value: this.settings.edgeSoftness },
      },
      vertexShader: CELL_VERTEX,
      fragmentShader: CELL_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
    })

    this.bloomMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColorMode: { value: this.settings.colorMode },
        uBlobColor: { value: new THREE.Color(this.settings.blobColor) },
        uPalette2: { value: new THREE.Color(0x000000) },
        uBloomGain: { value: this.settings.bloomGain },
      },
      vertexShader: CELL_VERTEX,
      fragmentShader: BLOOM_CELL_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    })

    this.baseMesh = new THREE.InstancedMesh(this.cellGeometry, this.baseMaterial, ABSOLUTE_MAX_CELLS)
    this.baseMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.baseMesh.count = 0
    this.scene.add(this.baseMesh)

    this.bloomMesh = new THREE.InstancedMesh(this.cellGeometry, this.bloomMaterial, ABSOLUTE_MAX_CELLS)
    this.bloomMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.bloomMesh.count = 0
    this.bloomScene.add(this.bloomMesh)

    this.overlayMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tBloom: { value: null },
        uBloomMix: { value: 1.0 },
      },
      vertexShader: PASS_THROUGH_VERTEX,
      fragmentShader: BLOOM_OVERLAY_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    })
    this.overlayMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.overlayMaterial)
    this.overlayScene.add(this.overlayMesh)

    this.applyPalette()
  }

  init({ showStats = true, showGui = true }: InitOptions = {}) {
    if (typeof navigator !== 'undefined' && navigator.userAgent?.toLowerCase().includes('jsdom')) {
      return false
    }

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

    if (showStats) this.initStats()
    if (showGui) this.initGui()

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('resize', this.resize)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(this.container)
    }
    return true
  }

  setRunning(running: boolean) {
    this.settings.animate = running
    this.frameDirty = true
  }

  render(nowMs: number) {
    this.stats?.begin()
    try {
      if (!this.lastMs) this.lastMs = nowMs
      const dt = clamp((nowMs - this.lastMs) / 1000, 0, 0.05)
      this.lastMs = nowMs

      if (this.settings.animate) {
        this.tick(dt)
      }

      if (!this.frameDirty) return
      this.updateMaterials()

      this.renderer.setClearColor(this.settings.background, 1)
      this.renderer.setRenderTarget(null)
      this.renderer.clear()
      this.renderer.render(this.scene, this.camera)

      if (this.settings.bloomEnabled && this.bloomComposer && this.bloomPass) {
        const prevAlpha = this.renderer.getClearAlpha()
        this.renderer.getClearColor(this.tmpClearColor)
        this.renderer.setClearColor(0x000000, 0)
        this.bloomComposer.render()
        this.renderer.setClearColor(this.tmpClearColor, prevAlpha)
        const bloomTexture = (this.bloomComposer as unknown as { readBuffer: THREE.WebGLRenderTarget })
          .readBuffer.texture
        this.overlayMaterial.uniforms.tBloom!.value = bloomTexture
        this.overlayMaterial.uniforms.uBloomMix!.value = 1.0
        this.renderer.render(this.overlayScene, this.camera)
      }

      this.frameDirty = false
    } finally {
      this.stats?.end()
    }
  }

  private initStats() {
    const stats = new Stats()
    this.stats = stats
    stats.showPanel(0)
    stats.dom.style.position = 'absolute'
    stats.dom.style.left = '8px'
    stats.dom.style.top = '8px'
    stats.dom.style.zIndex = '20'
    this.container.appendChild(stats.dom)
  }

  private initGui() {
    const gui = new GUI()
    this.gui = gui
    gui.close()

    const growthFolder = gui.addFolder('Growth')
    growthFolder.close()
    growthFolder.add(this.settings, 'growthRate', 0, 20, 0.1).name('Rate / sec')
    growthFolder.add(this.settings, 'maxCells', 10, ABSOLUTE_MAX_CELLS, 1).name('Max cells')
    growthFolder.add(this.settings, 'parentBiasNewest', 0.05, 1.0, 0.01).name('Chain bias')
    growthFolder.add(this.settings, 'buddingGap', 0, 2.0, 0.05).name('Bud gap')
    growthFolder.add(this.settings, 'reset').name('Reset')

    const cellFolder = gui.addFolder('Cells')
    cellFolder.close()
    cellFolder.add(this.settings, 'cellRadiusMin', 2, 10, 0.1).name('Min radius')
    cellFolder.add(this.settings, 'cellRadiusMax', 2, 12, 0.1).name('Max radius')
    cellFolder.add(this.settings, 'collisionGap', 0, 1.0, 0.05).name('Cell spacing')
    cellFolder.add(this.settings, 'movementSpeed', 0, 20, 0.1).name('Speed px/s')
    cellFolder.add(this.settings, 'motionJitter', 0, 12, 0.1).name('Jitter')
    cellFolder.add(this.settings, 'motionDamping', 0.6, 1.0, 0.005).name('Damping')
    cellFolder.add(this.settings, 'addOnClick').name('Click seed')

    const colorFolder = gui.addFolder('Color')
    colorFolder.close()
    colorFolder.add(this.settings, 'colorMode', { Single: 0, Palette: 1 }).name('Color mode')
    colorFolder
      .add(this.settings, 'paletteName', paletteOptions())
      .name('Palette')
      .onChange(() => this.applyPalette())
    colorFolder.addColor(this.settings, 'blobColor').name('Blob color')
    colorFolder.addColor(this.settings, 'background').name('Background')
    colorFolder.add(this.settings, 'edgeSoftness', 0.04, 0.4, 0.01).name('Edge softness')

    const bloomFolder = gui.addFolder('Bloom')
    bloomFolder.close()
    bloomFolder
      .add(this.settings, 'bloomEnabled')
      .name('Enabled')
      .onChange(() => {
        if (this.bloomPass) this.bloomPass.enabled = this.settings.bloomEnabled
        this.frameDirty = true
      })
    bloomFolder
      .add(this.settings, 'bloomStrength', 0, 3, 0.01)
      .name('Strength')
      .onChange(() => {
        if (this.bloomPass) this.bloomPass.strength = this.settings.bloomStrength
        this.frameDirty = true
      })
    bloomFolder
      .add(this.settings, 'bloomRadius', 0, 1, 0.01)
      .name('Radius')
      .onChange(() => {
        if (this.bloomPass) this.bloomPass.radius = this.settings.bloomRadius
        this.frameDirty = true
      })
    bloomFolder
      .add(this.settings, 'bloomThreshold', 0, 1, 0.01)
      .name('Threshold')
      .onChange(() => {
        if (this.bloomPass) this.bloomPass.threshold = this.settings.bloomThreshold
        this.frameDirty = true
      })
    bloomFolder.add(this.settings, 'bloomGain', 0, 4, 0.05).name('Cell glow')
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

  private updateMaterials() {
    const blobColor = this.baseMaterial.uniforms.uBlobColor!.value as THREE.Color
    const bloomBlobColor = this.bloomMaterial.uniforms.uBlobColor!.value as THREE.Color
    blobColor.set(this.settings.blobColor)
    bloomBlobColor.set(this.settings.blobColor)
    this.baseMaterial.uniforms.uColorMode!.value = this.settings.colorMode
    this.bloomMaterial.uniforms.uColorMode!.value = this.settings.colorMode
    this.baseMaterial.uniforms.uEdgeSoftness!.value = this.settings.edgeSoftness
    this.bloomMaterial.uniforms.uBloomGain!.value = this.settings.bloomGain
  }

  private applyPalette() {
    const palette = getPalette(this.settings.paletteName)
    ;(this.baseMaterial.uniforms.uPalette0!.value as THREE.Color).setRGB(
      palette.colors[0].r,
      palette.colors[0].g,
      palette.colors[0].b,
    )
    ;(this.baseMaterial.uniforms.uPalette1!.value as THREE.Color).setRGB(
      palette.colors[1].r,
      palette.colors[1].g,
      palette.colors[1].b,
    )
    ;(this.baseMaterial.uniforms.uPalette2!.value as THREE.Color).setRGB(
      palette.colors[2].r,
      palette.colors[2].g,
      palette.colors[2].b,
    )
    ;(this.bloomMaterial.uniforms.uPalette2!.value as THREE.Color).copy(
      this.baseMaterial.uniforms.uPalette2!.value as THREE.Color,
    )
    this.frameDirty = true
  }

  private reset() {
    this.cells = []
    this.growthAccumulator = 0

    const initialCount = Math.floor(rndFloat(INITIAL_CELL_MIN, INITIAL_CELL_MAX + 0.999))
    for (let i = 0; i < initialCount; i++) {
      this.spawnSeedRandom()
    }

    this.syncInstances()
    this.lastMs = 0
    this.frameDirty = true
  }

  private spawnSeedRandom() {
    const radius = this.randomCellRadius()
    const dishRadius = this.getDomainRadiusPx()
    for (let attempt = 0; attempt < 24; attempt++) {
      const ang = rndFloat(0, Math.PI * 2)
      const rad = rndFloat(0, Math.max(1, dishRadius - radius))
      const x = Math.cos(ang) * rad
      const y = Math.sin(ang) * rad
      if (!this.canPlaceCell(x, y, radius, -1)) continue
      this.addCell(x, y, radius, rndFloat(-2, 2), rndFloat(-2, 2))
      return true
    }
    return false
  }

  private randomCellRadius() {
    const minRadius = Math.min(this.settings.cellRadiusMin, this.settings.cellRadiusMax)
    const maxRadius = Math.max(this.settings.cellRadiusMin, this.settings.cellRadiusMax)
    return rndFloat(minRadius, maxRadius)
  }

  private getDomainRadiusPx() {
    return Math.min(this.width, this.height) * PETRI_INNER_RADIUS_RATIO
  }

  private addCell(x: number, y: number, r: number, vx: number, vy: number) {
    if (this.cells.length >= ABSOLUTE_MAX_CELLS) return false
    const cell: Cell = { x, y, r, vx, vy, seed: Math.random() }
    this.cells.push(cell)
    return true
  }

  private spawnBudFromPopulation() {
    if (this.cells.length === 0 || this.cells.length >= this.settings.maxCells) return false

    const retryCount = 48
    for (let attempt = 0; attempt < retryCount; attempt++) {
      const parentIndex = this.pickParentIndex()
      const parent = this.cells[parentIndex]
      if (!parent) continue

      const childRadius = this.randomCellRadius()
      const angle = rndFloat(0, Math.PI * 2)
      const distance = parent.r + childRadius + this.settings.buddingGap
      const x = parent.x + Math.cos(angle) * distance
      const y = parent.y + Math.sin(angle) * distance

      if (!this.canPlaceCell(x, y, childRadius, parentIndex)) continue

      const kick = 1.8
      const vx = parent.vx * 0.35 + Math.cos(angle) * rndFloat(0, kick)
      const vy = parent.vy * 0.35 + Math.sin(angle) * rndFloat(0, kick)
      return this.addCell(x, y, childRadius, vx, vy)
    }
    return false
  }

  private pickParentIndex() {
    const total = this.cells.length
    const newestWindow = Math.max(1, Math.floor(total * clamp(this.settings.parentBiasNewest, 0.05, 1.0)))
    const start = Math.max(0, total - newestWindow)
    return Math.floor(rndFloat(start, total))
  }

  private canPlaceCell(x: number, y: number, r: number, ignoreIndex: number) {
    const dishRadius = this.getDomainRadiusPx()
    const margin = r + this.settings.collisionGap
    if (x * x + y * y > (dishRadius - margin) * (dishRadius - margin)) return false

    const minDistScale = 1.0
    for (let i = 0; i < this.cells.length; i++) {
      if (i === ignoreIndex) continue
      const c = this.cells[i]
      if (!c) continue
      const dx = x - c.x
      const dy = y - c.y
      const minDist = (r + c.r + this.settings.collisionGap) * minDistScale
      if (dx * dx + dy * dy < minDist * minDist) return false
    }
    return true
  }

  private syncInstances() {
    const count = Math.min(this.cells.length, ABSOLUTE_MAX_CELLS)
    for (let i = 0; i < count; i++) {
      const c = this.cells[i]
      if (!c) continue
      this.tmpObject.position.set(c.x, c.y, 0)
      this.tmpObject.scale.set(c.r, c.r, 1)
      this.tmpObject.updateMatrix()
      this.baseMesh.setMatrixAt(i, this.tmpObject.matrix)
      this.bloomMesh.setMatrixAt(i, this.tmpObject.matrix)
      this.instanceSeedAttr.array[i] = c.seed
    }

    this.baseMesh.count = count
    this.bloomMesh.count = count
    this.baseMesh.instanceMatrix.needsUpdate = true
    this.bloomMesh.instanceMatrix.needsUpdate = true
    this.instanceSeedAttr.needsUpdate = true
  }

  private tick(dt: number) {
    const dishRadius = this.getDomainRadiusPx()
    const maxSpeed = this.settings.movementSpeed
    const jitter = this.settings.motionJitter
    const damping = Math.pow(this.settings.motionDamping, dt * 60)

    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i]
      if (!c) continue

      c.vx += rndFloat(-1, 1) * jitter * dt
      c.vy += rndFloat(-1, 1) * jitter * dt
      c.vx *= damping
      c.vy *= damping

      const v = Math.hypot(c.vx, c.vy)
      if (v > maxSpeed && v > 1e-6) {
        const scale = maxSpeed / v
        c.vx *= scale
        c.vy *= scale
      }

      c.x += c.vx * dt
      c.y += c.vy * dt

      const allowed = Math.max(0, dishRadius - c.r - this.settings.collisionGap)
      const d2 = c.x * c.x + c.y * c.y
      if (d2 > allowed * allowed && d2 > 1e-6) {
        const d = Math.sqrt(d2)
        const nx = c.x / d
        const ny = c.y / d
        c.x = nx * allowed
        c.y = ny * allowed
        const rv = reflect(c.vx, c.vy, nx, ny)
        c.vx = rv.vx * 0.5
        c.vy = rv.vy * 0.5
      }
    }

    this.growthAccumulator += this.settings.growthRate * dt
    let births = Math.floor(this.growthAccumulator)
    if (births > 0) this.growthAccumulator -= births

    while (births > 0 && this.cells.length < this.settings.maxCells) {
      if (!this.spawnBudFromPopulation()) break
      births--
    }

    this.syncInstances()
    this.frameDirty = true
  }

  private resize = () => {
    this.width = Math.max(1, this.container.clientWidth || window.innerWidth)
    this.height = Math.max(1, this.container.clientHeight || window.innerHeight)
    this.renderer.setSize(this.width, this.height, false)
    this.bloomComposer?.setPixelRatio(this.renderer.getPixelRatio())
    this.bloomComposer?.setSize(this.width, this.height)
    this.bloomPass?.setSize(this.width, this.height)

    this.camera.left = -this.width / 2
    this.camera.right = this.width / 2
    this.camera.top = this.height / 2
    this.camera.bottom = -this.height / 2
    this.camera.updateProjectionMatrix()

    this.overlayMesh.scale.set(this.width, this.height, 1)
    this.frameDirty = true
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.settings.addOnClick || this.cells.length >= this.settings.maxCells) return

    const rect = this.renderer.domElement.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / Math.max(1, rect.width)
    const ny = (e.clientY - rect.top) / Math.max(1, rect.height)
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return

    const ndcX = nx * 2 - 1
    const ndcY = -(ny * 2 - 1)
    const p = this.tmpVec3.set(ndcX, ndcY, 0).unproject(this.camera)

    if (this.cells.length === 0) {
      const radius = this.randomCellRadius()
      if (this.canPlaceCell(p.x, p.y, radius, -1)) {
        this.addCell(p.x, p.y, radius, rndFloat(-1, 1), rndFloat(-1, 1))
        this.syncInstances()
        this.frameDirty = true
      }
      return
    }

    let nearestIndex = 0
    let nearestD2 = Number.POSITIVE_INFINITY
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i]
      if (!c) continue
      const dx = p.x - c.x
      const dy = p.y - c.y
      const d2 = dx * dx + dy * dy
      if (d2 < nearestD2) {
        nearestD2 = d2
        nearestIndex = i
      }
    }

    const parent = this.cells[nearestIndex]
    if (!parent) return
    const childR = this.randomCellRadius()
    const dirX = p.x - parent.x
    const dirY = p.y - parent.y
    const dirLen = Math.hypot(dirX, dirY)
    const nxDir = dirLen > 1e-4 ? dirX / dirLen : Math.cos(rndFloat(0, Math.PI * 2))
    const nyDir = dirLen > 1e-4 ? dirY / dirLen : Math.sin(rndFloat(0, Math.PI * 2))
    const distance = parent.r + childR + this.settings.buddingGap
    const x = parent.x + nxDir * distance
    const y = parent.y + nyDir * distance

    if (!this.canPlaceCell(x, y, childR, nearestIndex)) return
    this.addCell(x, y, childR, rndFloat(-1, 1), rndFloat(-1, 1))
    this.syncInstances()
    this.frameDirty = true
  }

  dispose() {
    window.removeEventListener('resize', this.resize)
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown)
    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    this.gui?.destroy()
    this.gui = null

    this.stats?.dom.remove()
    this.stats = null

    this.bloomComposer?.dispose()
    this.bloomComposer = null
    this.bloomPass = null

    this.baseMaterial.dispose()
    this.bloomMaterial.dispose()
    this.overlayMaterial.dispose()
    this.cellGeometry.dispose()
    this.overlayMesh.geometry.dispose()

    this.scene.clear()
    this.bloomScene.clear()
    this.overlayScene.clear()

    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}

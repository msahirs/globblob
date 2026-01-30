import * as THREE from 'three'
import GUI from 'lil-gui'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { SobelOperatorShader } from 'three/examples/jsm/shaders/SobelOperatorShader.js'
import { InfoDialog } from './InfoDialog'
import { INFO_TEXT } from './InfoText'
import { PingPongShaderBuilder, ShaderBuilder } from './builders'
import { MouseSpawnTexture } from './MouseSpawnTexture'
import {
  DIFFUSE_DECAY_FRAGMENT,
  FINAL_RENDER_FRAGMENT,
  PASS_THROUGH_VERTEX,
  RENDER_DOTS_FRAGMENT,
  RENDER_DOTS_VERTEX,
  UPDATE_DOTS_FRAGMENT,
} from './shaders'
import { orthographicCamera, rndFloat, rndInt, Vector } from './util'
import type { PingPongShader } from './PingPongShader'
import type { Shader } from './Shader'

type MousePos = { x: number; y: number }

export class PhysarumRender {
  private width: number
  private height: number
  private time = 0

  private particleWidth = 256
  private mouseDown = false
  private mousePos: MousePos = { x: 0, y: 0 }

  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private composer: EffectComposer
  private sobelPass: ShaderPass

  private textureLoader: THREE.TextureLoader

  private diffuseShader: PingPongShader
  private updateDotsShader: PingPongShader | null = null
  private renderDotsShader: Shader | null = null
  private mouseSpawnTexture: MouseSpawnTexture

  private finalMat: THREE.ShaderMaterial
  private finalMesh: THREE.Mesh

  private gui: GUI | null = null
  private guiGroups: GUI[] | null = null
  private infoButtonEl: HTMLDivElement | null = null

  private readonly container: HTMLElement
  private activeCells = 0

  private readonly settings: {
    speciesCount: 1 | 3
    singleTeam: 0 | 1 | 2
    seedMode: 'Edges' | 'Center'
    initialActiveParticles: number
    isMousePush: boolean
    showCellCount: boolean

    mouseRad: number
    mousePlaceAmount: number
    mousePlaceRadius: number
    mousePlaceColor: number

    isSobelFilter: boolean
    isMonochrome: boolean
    dotOpacity: number
    trailOpacity: number

    isParticleTexture: boolean
    particleTexture: string
    decay: number
    isDisplacement: boolean
    isRestrictToMiddle: boolean

    randChance: number[]
    moveSpeed: number[]
    sensorDistance: number[]
    rotationAngle: number[]
    sensorAngle: number[]
    colors: string[]
    infectious: number[]
    dotSizes: number[]
    attract0: number[]
    attract1: number[]
    attract2: number[]
  }

  private readonly onMouseMove = (ev: MouseEvent) => {
    ev.preventDefault()
    this.mousePos = {
      x: ev.clientX - this.width * 0.5,
      y: this.height * 0.5 - ev.clientY,
    }
  }

  private readonly onTouchMove = (ev: TouchEvent) => {
    ev.preventDefault()
    if (!ev.touches) return
    this.mousePos = {
      x: ev.touches[0]!.clientX - this.width * 0.5,
      y: this.height * 0.5 - ev.touches[0]!.clientY,
    }
  }

  private readonly onMouseDown = (ev: MouseEvent) => {
    this.mousePos = {
      x: ev.clientX - this.width * 0.5,
      y: this.height * 0.5 - ev.clientY,
    }
    this.mouseDown = true
  }

  private readonly onTouchStart = (ev: TouchEvent) => {
    ev.preventDefault()
    if (ev.touches) {
      this.mousePos = {
        x: ev.touches[0]!.clientX - this.width * 0.5,
        y: this.height * 0.5 - ev.touches[0]!.clientY,
      }
    }
    this.mouseDown = true
  }

  private readonly onMouseUp = () => {
    this.mouseDown = false
  }

  constructor(container: HTMLElement) {
    this.container = container
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.textureLoader = new THREE.TextureLoader()

    this.scene = new THREE.Scene()
    this.camera = orthographicCamera(this.width, this.height)
    this.camera.position.z = 1

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
    })
    this.renderer.setSize(this.width, this.height)

    this.settings = this.initSettings()

    // Placeholder init; real init in initShaders() after settings exist.
    this.mouseSpawnTexture = new MouseSpawnTexture(this.particleWidth, this.particleWidth)
     
    this.diffuseShader = null!
     
    this.finalMat = null!
     
    this.finalMesh = null!
     
    this.composer = null!
     
    this.sobelPass = null!
  }

  init() {
    this.width = this.container.clientWidth || window.innerWidth
    this.height = this.container.clientHeight || window.innerHeight

    this.camera = orthographicCamera(this.width, this.height)
    this.camera.position.z = 1

    this.renderer.setSize(this.width, this.height)
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'

    if (!this.renderer.capabilities.isWebGL2) {
      InfoDialog.create(
        "This page requires WebGL2. Your browser does not currently support it. You can check <a href='https://caniuse.com/webgl2'>https://caniuse.com/webgl2</a> to see which browsers are supported.",
      )
      return false
    }

    this.initMouse()
    this.initShaders()
    this.initComposer()
    this.initGUI()

    this.container.appendChild(this.renderer.domElement)
    return true
  }

  private initMouse() {
    this.mousePos = { x: 0, y: 0 }
    this.mouseSpawnTexture = new MouseSpawnTexture(this.particleWidth, this.particleWidth)

    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove)
    this.renderer.domElement.addEventListener('touchmove', this.onTouchMove, { passive: false })
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown)
    this.renderer.domElement.addEventListener('touchstart', this.onTouchStart, { passive: false })
    document.addEventListener('mouseup', this.onMouseUp)
    document.addEventListener('touchend', this.onMouseUp)
  }

  private initSettings() {
    const settings = {
      // New "growth" defaults: start as a single species with a small amount of active particles,
      // and allow the user to add more by clicking/dragging.
      speciesCount: 1 as 1 | 3,
      singleTeam: 0 as 0 | 1 | 2,
      seedMode: 'Edges' as 'Edges' | 'Center',
      initialActiveParticles: 900,
      isMousePush: true,
      showCellCount: false,

      mouseRad: 100,
      mousePlaceAmount: 60,
      mousePlaceRadius: 40,
      mousePlaceColor: 0,

      isSobelFilter: false,
      isMonochrome: true,
      dotOpacity: 0,
      trailOpacity: 1,

      isParticleTexture: false,
      particleTexture: 'None',
      // Higher decay makes trails persist longer (more "growth", less "die-off").
      decay: 0.995,
      isDisplacement: true,
      isRestrictToMiddle: false,

      // Currently unused in the shader (random turn is commented out), but kept for parity.
      randChance: [0, 0, 0],

      // Stable, gentle movement defaults.
      moveSpeed: [1.5, 1.5, 1.5],
      sensorDistance: [6, 6, 6],
      rotationAngle: [0.55, 0.55, 0.55],
      sensorAngle: [0.8, 0.8, 0.8],
      colors: ['rgb(255,250,60)', 'rgb(255,0,0)', 'rgb(92,255,111)'],
      infectious: [0, 0, 0],
      dotSizes: [1, 1, 1],
      // Each species follows only its own trail by default.
      attract0: [1, 0, 0],
      attract1: [0, 1, 0],
      attract2: [0, 0, 1],
    }

    return settings
  }

  private initShaders() {
    const dotAmount = this.particleWidth * this.particleWidth
    const arrays = this.getDataArrays(dotAmount)

    this.diffuseShader = new PingPongShaderBuilder()
      .withDimensions(this.width, this.height)
      .withVertex(PASS_THROUGH_VERTEX)
      .withFragment(DIFFUSE_DECAY_FRAGMENT)
      .withUniform('points', null)
      .withUniform('decay', this.settings.decay)
      .withUniform('resolution', new THREE.Vector2(this.width, this.height))
      .create()

    this.getRenderDotsShader(arrays.pos, arrays.uvs)

    const base = import.meta.env.BASE_URL ?? '/'
    if (this.settings.particleTexture !== 'None') {
      this.textureLoader.load(`${base}physarum/particles/${this.settings.particleTexture}.png`, (tex) => {
        this.getRenderDotsShader().setUniform('isParticleTexture', this.settings.particleTexture !== 'None')
        this.renderDotsShader?.setUniform('particleTexture', tex)
      })
    }

    this.initFinalMat()
    this.resetPositions()
  }

  private initFinalMat() {
    this.finalMat = new THREE.ShaderMaterial({
      uniforms: {
        diffuseTexture: { value: null },
        pointsTexture: { value: null },
        col0: { value: new THREE.Color(this.settings.colors[0]) },
        col1: { value: new THREE.Color(this.settings.colors[1]) },
        col2: { value: new THREE.Color(this.settings.colors[2]) },
        isFlatShading: { value: false },
        colorThreshold: { value: 0.5 },
        dotOpacity: { value: this.settings.dotOpacity },
        trailOpacity: { value: this.settings.trailOpacity },
        isMonochrome: { value: this.settings.isMonochrome },
        resolution: { value: new THREE.Vector2(this.width, this.height) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      vertexShader: PASS_THROUGH_VERTEX,
      fragmentShader: FINAL_RENDER_FRAGMENT,
    })

    this.finalMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.finalMat)
    this.finalMesh.position.set(0, 0, 0)
    this.finalMesh.scale.set(this.width, this.height, 1)
    this.scene.add(this.finalMesh)
  }

  private getDataArrays(dotAmount: number) {
    const pos = new Float32Array(dotAmount * 3)
    const uvs = new Float32Array(dotAmount * 2)
    for (let i = 0; i < dotAmount; i++) {
      pos[i * 3] = pos[i * 3 + 1] = pos[i * 3 + 2] = 0
      uvs[i * 2] = (i % this.particleWidth) / this.particleWidth
      uvs[i * 2 + 1] = ~~(i / this.particleWidth) / this.particleWidth
    }
    return { pos, uvs }
  }

  private resetPositions() {
    const dotAmount = this.particleWidth * this.particleWidth
    const positionsAndDirections = new Float32Array(dotAmount * 4)

    const activeCount = Math.min(dotAmount, Math.max(0, Math.floor(this.settings.initialActiveParticles)))
    const maxRadius = Math.min(this.width, this.height) * 0.48
    const jitter = Math.min(this.width, this.height) * 0.02

    const pickTeam = (): 0 | 1 | 2 => {
      if (this.settings.speciesCount === 1) return this.settings.singleTeam
      return rndInt(0, 2) as 0 | 1 | 2
    }

    for (let i = 0; i < dotAmount; i++) {
      const id = i * 4
      if (i >= activeCount) {
        positionsAndDirections[id] = 0
        positionsAndDirections[id + 1] = 0
        positionsAndDirections[id + 2] = 0
        positionsAndDirections[id + 3] = -1
        continue
      }

      const team = pickTeam()
      const ang = rndFloat(0, Math.PI * 2)

      let x = 0
      let y = 0
      let direction = 0
      if (this.settings.seedMode === 'Edges') {
        const r = maxRadius + rndFloat(-jitter, jitter)
        x = Math.cos(ang) * r
        y = Math.sin(ang) * r
        direction = ang + Math.PI + rndFloat(-0.25, 0.25)
      } else {
        const r = rndFloat(0, maxRadius * 0.12)
        x = Math.cos(ang) * r
        y = Math.sin(ang) * r
        direction = rndFloat(0, Math.PI * 2)
      }

      positionsAndDirections[id] = x
      positionsAndDirections[id + 1] = y
      positionsAndDirections[id + 2] = direction
      positionsAndDirections[id + 3] = team
    }

    // Spawn new particles into the "inactive" pool first (so clicks add cells instead of relocating).
    this.mouseSpawnTexture.setCounter(activeCount)
    this.activeCells = activeCount

    this.updateDotsShader?.dispose()
    this.updateDotsShader = null
    this.getUpdateDotsShader(positionsAndDirections)
  }

  private changeParticleAmount(newAmount: number) {
    this.particleWidth = Math.sqrt(newAmount)

    this.mouseSpawnTexture.dispose()
    this.mouseSpawnTexture = new MouseSpawnTexture(this.particleWidth, this.particleWidth)

    const arrays = this.getDataArrays(newAmount)
    this.updateDotsShader?.dispose()
    this.updateDotsShader = null
    this.renderDotsShader?.dispose()
    this.renderDotsShader = null
    this.getRenderDotsShader(arrays.pos, arrays.uvs)
    this.resetPositions()
  }

  private getUpdateDotsShader(positionsAndDirections?: Float32Array) {
    if (!this.updateDotsShader) {
      this.updateDotsShader = new PingPongShaderBuilder()
        .withDimensions(this.particleWidth, this.particleWidth)
        .withVertex(PASS_THROUGH_VERTEX)
        .withFragment(UPDATE_DOTS_FRAGMENT)
        .withTextureData(positionsAndDirections ?? new Float32Array(this.particleWidth * this.particleWidth * 4))
        .withUniform('diffuseTexture', null)
        .withUniform('pointsTexture', null)
        .withUniform('mouseSpawnTexture', null)
        .withUniform('isRestrictToMiddle', this.settings.isRestrictToMiddle)
        .withUniform('time', 0)
        .withUniform('resolution', Vector([this.width, this.height]))
        .withUniform('textureDimensions', Vector([this.particleWidth, this.particleWidth]))
        .withUniform('mouseRad', this.settings.mouseRad)
        .withUniform('mousePos', Vector([this.mousePos.x, this.mousePos.y]))
        .withUniform('isDisplacement', this.settings.isDisplacement)
        .withUniform('sensorAngle', Vector(this.settings.sensorAngle))
        .withUniform('rotationAngle', Vector(this.settings.rotationAngle))
        .withUniform('sensorDistance', Vector(this.settings.sensorDistance))
        .withUniform('randChance', Vector(this.settings.randChance))
        .withUniform('attract0', Vector(this.settings.attract0))
        .withUniform('attract1', Vector(this.settings.attract1))
        .withUniform('attract2', Vector(this.settings.attract2))
        .withUniform('moveSpeed', Vector(this.settings.moveSpeed))
        .withUniform('infectious', Vector(this.settings.infectious))
        .create()
    }
    return this.updateDotsShader
  }

  private getRenderDotsShader(pos?: Float32Array, uvs?: Float32Array) {
    if (!this.renderDotsShader) {
      if (!pos || !uvs) throw new Error('RenderDotsShader requires pos/uvs on first creation')
      this.renderDotsShader = new ShaderBuilder()
        .withDimensions(this.width, this.height)
        .withVertex(RENDER_DOTS_VERTEX)
        .withFragment(RENDER_DOTS_FRAGMENT)
        .withUniform('isParticleTexture', this.settings.isParticleTexture)
        .withUniform('particleTexture', null)
        .withUniform('positionTexture', null)
        .withUniform('dotSizes', Vector(this.settings.dotSizes))
        .withUniform('resolution', Vector([this.width, this.height]))
        .withAttribute('position', new THREE.BufferAttribute(pos, 3, false))
        .withAttribute('uv', new THREE.BufferAttribute(uvs, 2, false))
        .create()
    }
    return this.renderDotsShader
  }

  render() {
    if (!this.renderer.capabilities.isWebGL2) return
    this.time++

    if (this.mouseDown) {
      this.activeCells = Math.min(this.getMaxCells(), this.activeCells + this.settings.mousePlaceAmount)
      const spawnColor =
        this.settings.speciesCount === 1 ? this.settings.singleTeam : this.settings.mousePlaceColor
      this.mouseSpawnTexture.drawMouse(
        this.mousePos,
        this.settings.mousePlaceRadius,
        this.settings.mousePlaceAmount,
        spawnColor,
      )
      this.updateDotsShader?.setUniform('mouseSpawnTexture', this.mouseSpawnTexture.getTexture())
    }

    this.getUpdateDotsShader().setUniform(
      'mouseRad',
      this.settings.isMousePush ? this.settings.mouseRad : 0,
    )
    const infectious = this.settings.speciesCount === 1 ? [0, 0, 0] : this.settings.infectious
    this.getUpdateDotsShader().setUniform('infectious', Vector(infectious))
    this.getUpdateDotsShader().setUniform('time', this.time)
    this.diffuseShader.setUniform('points', this.getRenderDotsShader().getTexture())
    this.diffuseShader.render(this.renderer)

    this.getUpdateDotsShader().setUniform('mousePos', new THREE.Vector2(this.mousePos.x, this.mousePos.y))
    this.getUpdateDotsShader().setUniform('pointsTexture', this.getRenderDotsShader().getTexture())
    this.getUpdateDotsShader().setUniform('diffuseTexture', this.diffuseShader.getTexture())

    this.getUpdateDotsShader().render(this.renderer, {})

    this.getRenderDotsShader().setUniform('positionTexture', this.getUpdateDotsShader().getTexture())
    this.getRenderDotsShader().render(this.renderer)

    this.finalMat.uniforms['pointsTexture']!.value = this.getRenderDotsShader().getTexture()
    this.finalMat.uniforms['diffuseTexture']!.value = this.diffuseShader.getTexture()

    this.renderer.setSize(this.width, this.height)
    this.renderer.clear()

    this.mouseSpawnTexture.clear()
    this.getUpdateDotsShader().setUniform('mouseSpawnTexture', this.mouseSpawnTexture.getTexture())

    this.composer.render()
  }

  getCellCount() {
    return this.activeCells
  }

  getMaxCells() {
    return this.particleWidth * this.particleWidth
  }

  getShowCellCount() {
    return this.settings.showCellCount
  }

  private initComposer() {
    this.composer = new EffectComposer(this.renderer)
    this.composer.setSize(this.width, this.height)

    const renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(renderPass)

    this.sobelPass = new ShaderPass(SobelOperatorShader)
    const sobelRes = this.sobelPass.uniforms['resolution']!.value as THREE.Vector2
    sobelRes.x = this.width
    sobelRes.y = this.height
    this.sobelPass.enabled = this.settings.isSobelFilter
    this.composer.addPass(this.sobelPass)
  }

  private initGUI() {
    const infoButton = document.createElement('div')
    infoButton.classList.add('infoButton')
    this.container.appendChild(infoButton)
    this.infoButtonEl = infoButton

    const infoField = document.createElement('div')
    infoField.classList.add('infoField')
    infoField.innerHTML = 'i'
    infoButton.appendChild(infoField)
    infoButton.onclick = () => {
      InfoDialog.create(INFO_TEXT)
    }

    const gui = new GUI()
    this.gui = gui
    gui.close()

    const growthFolder = gui.addFolder('Growth')
    growthFolder.close()
    growthFolder
      .add(this.settings, 'speciesCount', { Single: 1, Three: 3 })
      .name('Species')
      .onChange(() => this.resetPositions())
    growthFolder
      .add(this.settings, 'singleTeam', { Slime0: 0, Slime1: 1, Slime2: 2 })
      .name('Single team')
      .onChange(() => {
        if (this.settings.speciesCount === 1) this.resetPositions()
      })
    growthFolder
      .add(this.settings, 'seedMode', { Edges: 'Edges', Center: 'Center' })
      .name('Seed')
      .onChange(() => this.resetPositions())
    growthFolder
      .add(this.settings, 'initialActiveParticles', 0, this.particleWidth * this.particleWidth, 50)
      .name('Initial cells')
      .onFinishChange(() => this.resetPositions())
    growthFolder.add(this.settings, 'showCellCount').name('Show cell count')

    const amountFolder = gui.addFolder('Particle amount')
    for (let i = 0; i < 6; i++) {
      const amnt = Math.pow(Math.pow(2, 6 + 1 * i), 2)
      amountFolder
        .add({ changeParticleAmount: this.changeParticleAmount.bind(this, amnt) }, 'changeParticleAmount')
        .name(`${amnt}`)
    }
    amountFolder.close()

    const placing: Record<string, boolean> = { Slime0: true, Slime1: false, Slime2: false, Random: false }
    const controls = gui.addFolder('Controls')
    controls.close()

    controls
      .add(this.settings, 'isMousePush')
      .name('Mouse push')
      .onChange(() =>
        this.getUpdateDotsShader().setUniform(
          'mouseRad',
          this.settings.isMousePush ? this.settings.mouseRad : 0,
        ),
      )
    controls
      .add(this.settings, 'mouseRad', 0, 500, 0.1)
      .name('Mouse push radius')
      .onChange(() => this.getUpdateDotsShader().setUniform('mouseRad', this.settings.mouseRad))

    controls.add(this.settings, 'mousePlaceRadius', 1, 500, 1).name('Click spawn radius')
    controls.add(this.settings, 'mousePlaceAmount', 1, 500000, 1).name('Click spawn amount')

    const placingColors = controls.addFolder('Place color')
    placingColors.close()
    for (const key in placing) {
      placingColors.add(placing, key).onChange(() => {
        for (const key2 in placing) placing[key2] = false
        placing[key] = true
        this.settings.mousePlaceColor = key === 'Slime0' ? 0 : key === 'Slime1' ? 1 : key === 'Slime2' ? 2 : -1
        placingColors.controllers.forEach((contr) => contr.updateDisplay())
      })
    }

    gui
      .add(this.diffuseShader.getUniforms().decay as unknown as { value: number }, 'value', 0.01, 1.0, 0.01)
      .name('Decay')

    gui
      .add(this.settings, 'isDisplacement')
      .name('One particle per pixel')
      .onChange(() => this.getUpdateDotsShader().setUniform('isDisplacement', this.settings.isDisplacement))

    gui
      .add(this.settings, 'isRestrictToMiddle')
      .name('Restrict to middle')
      .onChange(() => this.getUpdateDotsShader().setUniform('isRestrictToMiddle', this.settings.isRestrictToMiddle))

    const renderingFolder = gui.addFolder('Rendering')
    renderingFolder.close()
    renderingFolder
      .add(this.settings, 'isSobelFilter')
      .name('Sobel filter')
      .onChange((t: boolean) => (this.sobelPass.enabled = t))
    renderingFolder
      .add(this.finalMat.uniforms.isMonochrome as unknown as { value: number }, 'value', 0, 1, 1)
      .name('Monochrome')
    renderingFolder
      .add(this.finalMat.uniforms.isFlatShading as unknown as { value: boolean }, 'value')
      .name('Flat shading')
    renderingFolder
      .add(this.finalMat.uniforms.colorThreshold as unknown as { value: number }, 'value', 0, 1, 0.0001)
      .name('Color threshold')
    renderingFolder
      .add(this.finalMat.uniforms.dotOpacity as unknown as { value: number }, 'value', 0, 1, 0.01)
      .name('Dots opacity')
    renderingFolder
      .add(this.finalMat.uniforms.trailOpacity as unknown as { value: number }, 'value', 0, 1, 0.01)
      .name('Trails opacity')

    const teamNames = ['Slime0', 'Slime1', 'Slime2']
    const attract = [this.settings.attract0, this.settings.attract1, this.settings.attract2]
    this.guiGroups = []
    for (let i = 0; i < 3; i++) {
      const group = gui.addFolder(teamNames[i]!)
      group.close()
      this.guiGroups.push(group)

      group
        .addColor(this.settings.colors, i)
        .name('Color')
        .onChange((t: string) => {
          ;(this.finalMat.uniforms['col' + i] as THREE.IUniform).value = new THREE.Color(t)
        })

      group
        .add(this.settings.sensorAngle, i, 0.01, 2, 0.01)
        .name('Sensor Angle')
        .onChange(() => this.getUpdateDotsShader().setUniform('sensorAngle', Vector(this.settings.sensorAngle)))

      group
        .add(this.settings.rotationAngle, i, 0.01, 2, 0.01)
        .name('Rotation Angle')
        .onChange(() => this.getUpdateDotsShader().setUniform('rotationAngle', Vector(this.settings.rotationAngle)))

      group
        .add(this.settings.sensorDistance, i, 0.1, 50, 0.1)
        .name('Sensor Distance')
        .onChange(() => this.getUpdateDotsShader().setUniform('sensorDistance', Vector(this.settings.sensorDistance)))

      group
        .add(this.settings.moveSpeed, i, 0.1, 20, 0.1)
        .name('Move Distance')
        .onChange(() => this.getUpdateDotsShader().setUniform('moveSpeed', Vector(this.settings.moveSpeed)))

      group
        .add(this.settings.dotSizes, i, 1, 5, 1)
        .name('Dot Size')
        .onChange(() => this.getRenderDotsShader().setUniform('dotSizes', Vector(this.settings.dotSizes)))

      group
        .add(this.settings.infectious, i, 0, 1, 1)
        .name('Infectious to  ' + teamNames[(i + 1) % 3])
        .onChange(() => this.getUpdateDotsShader().setUniform('infectious', Vector(this.settings.infectious)))

      for (let j = 0; j < 3; j++) {
        group
          .add(attract[i]!, j, -1, 1, 0.05)
          .name('Attraction to ' + teamNames[j])
          .onChange(() =>
            this.getUpdateDotsShader().setUniform('attract' + i, Vector(attract[i]!)),
          )
      }

      group.add({ randomizeSettings: this.randomizeSettings.bind(this, i, this.settings) }, 'randomizeSettings').name(
        'Randomize ' + teamNames[i] + ' Settings',
      )
    }

    gui.add({ randomizeSettings: this.randomizeSettings.bind(this, -1, this.settings) }, 'randomizeSettings').name(
      'Randomize All Settings',
    )
    gui.add({ resetPositions: this.resetPositions.bind(this) }, 'resetPositions').name('Reset Positions')

    gui
      .add(
        this.settings,
        'particleTexture',
        'None,circle_01,circle_02,circle_03,circle_04,circle_05,dirt_01,dirt_02,dirt_03,fire_01,fire_02,flame_01,flame_02,flame_03,flame_04,flame_05,flame_06,flare_01,light_01,light_02,light_03,magic_01,magic_02,magic_03,magic_04,magic_05,muzzle_01,muzzle_02,muzzle_03,muzzle_04,muzzle_05,scorch_01,scorch_02,scorch_03,scratch_01,slash_01,slash_02,slash_03,slash_04,smoke_01,smoke_02,smoke_03,smoke_04,smoke_05,smoke_06,smoke_07,smoke_08,smoke_09,smoke_10,spark_01,spark_02,spark_03,spark_04,spark_05,spark_06,spark_07,star_01,star_02,star_03,star_04,star_05,star_06,star_07,star_08,star_09,symbol_01,symbol_02,trace_01,trace_02,trace_03,trace_04,trace_05,trace_06,trace_07,twirl_01,twirl_02,twirl_03,window_01,window_02,window_03,window_04'.split(
          ',',
        ),
      )
      .name('Dot Texture')
      .onChange(() => {
        const base = import.meta.env.BASE_URL ?? '/'
        this.getRenderDotsShader().setUniform('isParticleTexture', this.settings.particleTexture !== 'None')
        if (this.settings.particleTexture !== 'None') {
          this.textureLoader.load(`${base}physarum/particles/${this.settings.particleTexture}.png`, (tex) =>
            this.getRenderDotsShader().setUniform('particleTexture', tex),
          )
        }
      })
  }

  private randomizeSettings(teamIndex: number, settings: PhysarumRender['settings']) {
    if (teamIndex === -1) {
      this.randomizeSettings(0, settings)
      this.randomizeSettings(1, settings)
      this.randomizeSettings(2, settings)
      return
    }

    settings.randChance[teamIndex] = rndFloat(0.05, 0.085)
    settings.moveSpeed[teamIndex] = rndFloat(1, 5)
    settings.sensorDistance[teamIndex] = Math.min(50, rndFloat(1.5, 6) * settings.moveSpeed[teamIndex]!)
    settings.rotationAngle[teamIndex] = rndFloat(0.3, 1)
    settings.sensorAngle[teamIndex] = Math.max(1, rndFloat(1, 1.5) * settings.rotationAngle[teamIndex]!)
    settings.infectious[teamIndex] = 0
    settings.dotSizes[teamIndex] = rndFloat(1, 1)

    for (let i = 0; i < 3; i++) {
      const attractArr = teamIndex === 0 ? settings.attract0 : teamIndex === 1 ? settings.attract1 : settings.attract2
      attractArr[i] = rndFloat(i === teamIndex ? 0 : -1, 1)
    }

    if (this.guiGroups) {
      type ControllerLike = { updateDisplay: () => void; _onChange?: () => void; _name?: string }
      ;(this.guiGroups[teamIndex]!.controllers as unknown as ControllerLike[]).forEach((contr) => {
        if (contr._onChange && contr._name !== 'Color') contr._onChange()
        contr.updateDisplay()
      })
    }
  }

  dispose() {
    this.renderer.domElement.removeEventListener('mousemove', this.onMouseMove)
    this.renderer.domElement.removeEventListener('touchmove', this.onTouchMove)
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown)
    this.renderer.domElement.removeEventListener('touchstart', this.onTouchStart)
    document.removeEventListener('mouseup', this.onMouseUp)
    document.removeEventListener('touchend', this.onMouseUp)

    this.gui?.destroy()
    this.gui = null
    this.guiGroups = null

    this.infoButtonEl?.remove()
    this.infoButtonEl = null

    this.updateDotsShader?.dispose()
    this.updateDotsShader = null
    this.renderDotsShader?.dispose()
    this.renderDotsShader = null
    this.diffuseShader.dispose()
    this.mouseSpawnTexture.dispose()

    this.finalMat.dispose()
    ;(this.finalMesh.geometry as THREE.BufferGeometry).dispose()

    this.composer.dispose()

    this.scene.clear()

    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import * as THREE from 'three'
import Stats from 'three/examples/jsm/libs/stats.module.js'
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'
import {
  ToonShader1,
  ToonShader2,
  ToonShaderHatching,
  ToonShaderDotted,
} from 'three/examples/jsm/shaders/ToonShader.js'

const containerRef = ref<HTMLDivElement | null>(null)

const effectController = {
  material: 'shiny',
  speed: 1.0,
  numBlobs: 10,
  resolution: 28,
  isolation: 80,
  floor: true,
  wallx: false,
  wallz: false,
}

let stats: Stats
let camera: THREE.PerspectiveCamera, scene: THREE.Scene, renderer: THREE.WebGLRenderer
let materials: Record<string, THREE.Material>, current_material: string
let light: THREE.DirectionalLight, pointLight: THREE.PointLight, ambientLight: THREE.AmbientLight
let effect: MarchingCubes, resolution: number
let time = 0
const clock = new THREE.Clock()
let gui: GUI

function generateMaterials() {
  const path = 'https://threejs.org/examples/textures/cube/SwedishRoyalCastle/'
  const format = '.jpg'
  const urls = [
    path + 'px' + format,
    path + 'nx' + format,
    path + 'py' + format,
    path + 'ny' + format,
    path + 'pz' + format,
    path + 'nz' + format,
  ]

  const cubeTextureLoader = new THREE.CubeTextureLoader()
  const reflectionCube = cubeTextureLoader.load(urls)
  const refractionCube = cubeTextureLoader.load(urls)
  refractionCube.mapping = THREE.CubeRefractionMapping

  const toonMaterial1 = createShaderMaterial(ToonShader1, light, ambientLight)
  const toonMaterial2 = createShaderMaterial(ToonShader2, light, ambientLight)
  const hatchingMaterial = createShaderMaterial(ToonShaderHatching, light, ambientLight)
  const dottedMaterial = createShaderMaterial(ToonShaderDotted, light, ambientLight)

  const textureLoader = new THREE.TextureLoader()
  const texture = textureLoader.load('https://threejs.org/examples/textures/uv_grid_opengl.jpg')
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace

  const materialsRecord: Record<string, THREE.Material> = {
    shiny: new THREE.MeshStandardMaterial({
      color: 0x9c0000,
      envMap: reflectionCube,
      roughness: 0.1,
      metalness: 1.0,
    }),
    chrome: new THREE.MeshLambertMaterial({ color: 0xffffff, envMap: reflectionCube }),
    liquid: new THREE.MeshLambertMaterial({
      color: 0xffffff,
      envMap: refractionCube,
      refractionRatio: 0.85,
    }),
    matte: new THREE.MeshPhongMaterial({ specular: 0x494949, shininess: 1 }),
    flat: new THREE.MeshLambertMaterial({ flatShading: true }),
    textured: new THREE.MeshPhongMaterial({
      color: 0xffffff,
      specular: 0x111111,
      shininess: 1,
      map: texture,
    }),
    colors: new THREE.MeshPhongMaterial({
      color: 0xffffff,
      specular: 0xffffff,
      shininess: 2,
      vertexColors: true,
    }),
    multiColors: new THREE.MeshPhongMaterial({ shininess: 2, vertexColors: true }),
    plastic: new THREE.MeshPhongMaterial({ specular: 0xc1c1c1, shininess: 250 }),
    toon1: toonMaterial1,
    toon2: toonMaterial2,
    hatching: hatchingMaterial,
    dotted: dottedMaterial,
  }

  return materialsRecord
}

function createShaderMaterial(
  shader: {
    uniforms: Record<string, THREE.IUniform>
    vertexShader: string
    fragmentShader: string
  },
  light: THREE.DirectionalLight,
  ambientLight: THREE.AmbientLight,
) {
  const u = THREE.UniformsUtils.clone(shader.uniforms)
  const vs = shader.vertexShader
  const fs = shader.fragmentShader
  const material = new THREE.ShaderMaterial({ uniforms: u, vertexShader: vs, fragmentShader: fs })

  if (material.uniforms['uDirLightPos']) material.uniforms['uDirLightPos'].value = light.position
  if (material.uniforms['uDirLightColor']) material.uniforms['uDirLightColor'].value = light.color
  if (material.uniforms['uAmbientLightColor'])
    material.uniforms['uAmbientLightColor'].value = ambientLight.color

  return material
}

function setupGui() {
  const createHandler = function (id: string) {
    return function () {
      current_material = id
      const material = materials[id]
      if (material) {
        effect.material = material
      }
      effect.enableUvs = current_material === 'textured'
      effect.enableColors = current_material === 'colors' || current_material === 'multiColors'
    }
  }

  gui = new GUI()
  const hMaterials = gui.addFolder('Materials')

  // Create a separate object for material buttons to avoid modifying effectController dynamically
  const materialButtons: Record<string, () => void> = {}
  for (const m in materials) {
    materialButtons[m] = createHandler(m)
    hMaterials.add(materialButtons, m).name(m)
  }

  const hSimulation = gui.addFolder('Simulation')
  hSimulation.add(effectController, 'speed', 0.1, 8.0, 0.05)
  hSimulation.add(effectController, 'numBlobs', 1, 50, 1)
  hSimulation.add(effectController, 'resolution', 14, 100, 1)
  hSimulation.add(effectController, 'isolation', 10, 300, 1)
  hSimulation.add(effectController, 'floor')
  hSimulation.add(effectController, 'wallx')
  hSimulation.add(effectController, 'wallz')
}

function updateCubes(
  object: MarchingCubes,
  time: number,
  numblobs: number,
  floor: boolean,
  wallx: boolean,
  wallz: boolean,
) {
  object.reset()

  const rainbow = [
    new THREE.Color(0xff0000),
    new THREE.Color(0xffbb00),
    new THREE.Color(0xffff00),
    new THREE.Color(0x00ff00),
    new THREE.Color(0x0000ff),
    new THREE.Color(0x9400bd),
    new THREE.Color(0xc800eb),
  ]
  const subtract = 12
  const strength = 1.2 / ((Math.sqrt(numblobs) - 1) / 4 + 1)

  for (let i = 0; i < numblobs; i++) {
    const ballx = Math.sin(i + 1.26 * time * (1.03 + 0.5 * Math.cos(0.21 * i))) * 0.27 + 0.5
    const bally = Math.abs(Math.cos(i + 1.12 * time * Math.cos(1.22 + 0.1424 * i))) * 0.77
    const ballz = Math.cos(i + 1.32 * time * 0.1 * Math.sin(0.92 + 0.53 * i)) * 0.27 + 0.5

    if (current_material === 'multiColors') {
      object.addBall(ballx, bally, ballz, strength, subtract, rainbow[i % 7])
    } else {
      object.addBall(ballx, bally, ballz, strength, subtract)
    }
  }

  if (floor) object.addPlaneY(2, 12)
  if (wallz) object.addPlaneZ(2, 12)
  if (wallx) object.addPlaneX(2, 12)

  object.update()
}

function onWindowResize() {
  if (!containerRef.value) return
  camera.aspect = containerRef.value.clientWidth / containerRef.value.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
}

function animate() {
  render()
  stats.update()
}

function render() {
  const delta = clock.getDelta()
  time += delta * effectController.speed * 0.5

  if (effectController.resolution !== resolution) {
    resolution = effectController.resolution
    effect.init(Math.floor(resolution))
  }

  if (effectController.isolation !== effect.isolation) {
    effect.isolation = effectController.isolation
  }

  updateCubes(
    effect,
    time,
    effectController.numBlobs,
    effectController.floor,
    effectController.wallx,
    effectController.wallz,
  )
  renderer.render(scene, camera)
}

onMounted(() => {
  if (!containerRef.value) return

  camera = new THREE.PerspectiveCamera(
    45,
    containerRef.value.clientWidth / containerRef.value.clientHeight,
    1,
    10000,
  )
  camera.position.set(-500, 500, 1500)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050505)

  light = new THREE.DirectionalLight(0xffffff, 3)
  light.position.set(0.5, 0.5, 1)
  scene.add(light)

  pointLight = new THREE.PointLight(0xff7c00, 3, 0, 0)
  pointLight.position.set(0, 0, 100)
  scene.add(pointLight)

  ambientLight = new THREE.AmbientLight(0x323232, 3)
  scene.add(ambientLight)

  materials = generateMaterials()
  current_material = 'shiny'

  resolution = 28
  const initialMaterial = materials[current_material]
  if (!initialMaterial) throw new Error('Initial material not found')

  effect = new MarchingCubes(resolution, initialMaterial, true, true, 100000)
  effect.position.set(0, 0, 0)
  effect.scale.set(700, 700, 700)
  effect.enableUvs = false
  effect.enableColors = false
  scene.add(effect)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
  renderer.setAnimationLoop(animate)
  containerRef.value.appendChild(renderer.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.minDistance = 500
  controls.maxDistance = 5000

  stats = new Stats()
  containerRef.value.appendChild(stats.dom)
  stats.dom.style.position = 'absolute'

  setupGui()

  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
  if (gui) gui.destroy()
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
  }
})
</script>

<template>
  <div class="blob-container">
    <div ref="containerRef" class="canvas-container"></div>
    <div class="info">
      <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> - marching cubes<br />
      based on greggman's <a href="https://webglsamples.org/blob/blob.html">blob</a>, original code
      by Henrik Rydgård
    </div>
  </div>
</template>

<style scoped>
.blob-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

.info {
  position: absolute;
  top: 10px;
  width: 100%;
  text-align: center;
  color: #fff;
  z-index: 100;
  display: block;
}

.info a {
  color: #08f;
}
</style>

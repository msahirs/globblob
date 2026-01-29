import * as THREE from 'three'
import { rndFloat } from './util'

export class MouseSpawnTexture {
  private counter = 0
  private toClear = 0
  private data: Float32Array
  private dataTexture: THREE.DataTexture

  constructor(width: number, height: number) {
    const data = new Float32Array(width * height * 4)
    for (let i = 0; i < data.length; i++) data[i] = 0
    this.data = data
    this.dataTexture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType)
    this.dataTexture.needsUpdate = true
  }

  setCounter(counter: number) {
    const max = this.data.length / 4
    const next = Math.floor(counter)
    this.counter = max > 0 ? ((next % max) + max) % max : 0
    this.toClear = 0
  }

  drawMouse(
    pos: { x: number; y: number },
    radius: number,
    amount: number,
    color: number,
  ) {
    const team = () => {
      if (color !== -1) return color
      const rnd = rndFloat(0, 1)
      return rnd < 2 / 3 ? (rnd < 1 / 3 ? 0 : 1) : 2
    }

    for (let i = this.counter; i < this.counter + amount; i++) {
      const rndAng = rndFloat(0, Math.PI * 2)
      const rndDis = rndFloat(0, radius)
      const x = pos.x
      const y = pos.y

      const index = (i * 4) % this.data.length
      this.data[index] = x + rndDis * Math.cos(rndAng)
      this.data[index + 1] = y + rndDis * Math.sin(rndAng)
      this.data[index + 2] = rndAng
      this.data[index + 3] = team()
    }

    this.toClear += amount
    this.counter = (this.counter + amount) % (this.data.length / 4)
    this.dataTexture.needsUpdate = true
  }

  clear() {
    for (let i = this.counter - this.toClear; i < this.counter; i++) {
      const index = (i * 4 + this.data.length) % this.data.length
      this.data[index] = 0
      this.data[index + 1] = 0
      this.data[index + 2] = 0
      this.data[index + 3] = 0
    }
    this.toClear = 0
    this.dataTexture.needsUpdate = true
  }

  getTexture() {
    return this.dataTexture
  }

  dispose() {
    this.dataTexture.dispose()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this.data as any) = null
  }
}

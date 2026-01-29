import * as THREE from 'three'

export function rndFloat(min: number, max: number) {
  return min + (max - min) * Math.random()
}

export function rndInt(min: number, max: number) {
  return Math.round(min + (max - min) * Math.random())
}

export const Vector = (arr: number[]) => {
  if (arr.length === 2) return new THREE.Vector2(arr[0]!, arr[1]!)
  if (arr.length === 3) return new THREE.Vector3(arr[0]!, arr[1]!, arr[2]!)
  if (arr.length === 4) return new THREE.Vector4(arr[0]!, arr[1]!, arr[2]!, arr[3]!)
  throw new Error(`Cant create vector with ${arr.length} elements`)
}

export const orthographicCamera = (w: number, h: number) =>
  new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 100)


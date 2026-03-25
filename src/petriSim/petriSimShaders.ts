export const PASS_THROUGH_VERTEX = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
}
`

export const BLOOM_OVERLAY_FRAGMENT = `
precision highp float;

varying vec2 vUv;
uniform sampler2D tBloom;
uniform float uBloomMix;

void main() {
  vec3 b = texture2D(tBloom, vUv).rgb;
  gl_FragColor = vec4(b * uBloomMix, 1.0);
}
`

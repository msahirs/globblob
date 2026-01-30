export const PASS_THROUGH_VERTEX = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
}
`

export const FIELD_FRAGMENT = `
precision highp float;

uniform vec2 uWorldSize;
uniform vec2 uFieldSize;
uniform int uBallCount;
uniform vec4 uBalls[32]; // x, y, r, unused

float metaball(vec2 p, vec4 b) {
  vec2 d = p - b.xy;
  float d2 = dot(d, d);
  float r2 = b.z * b.z;
  return r2 / max(d2, 0.0001);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uFieldSize;
  vec2 p = (uv - 0.5) * uWorldSize;

  float sum = 0.0;
  for (int i = 0; i < 32; i++) {
    if (i >= uBallCount) break;
    sum += metaball(p, uBalls[i]);
  }

  gl_FragColor = vec4(sum, 0.0, 0.0, 1.0);
}
`

export const MARCHING_SQUARES_FRAGMENT = `
precision highp float;

uniform sampler2D uField;
uniform vec2 uResolution;
uniform vec2 uFieldSize;
uniform float uThreshold;
uniform float uLineWidthPx;
uniform float uSoftness;
uniform bool uShowContours;
uniform vec3 uPalette0;
uniform vec3 uPalette1;
uniform vec3 uPalette2;
uniform bool uUsePaletteBg;
uniform int uColorMode; // 0=single, 1=palette
uniform vec3 uBlobColor;
uniform vec3 uBgColor;

float sampleField(vec2 ij) {
  vec2 uv = (ij + 0.5) / uFieldSize;
  return texture2D(uField, uv).r;
}

float lerpEdge(float a, float b, float t) {
  float d = b - a;
  if (abs(d) < 1e-6) return 0.5;
  return clamp((t - a) / d, 0.0, 1.0);
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float drawSegment(vec2 p, vec2 a, vec2 b, float w) {
  float d = sdSegment(p, a, b);
  return 1.0 - smoothstep(w, w * 1.8, d);
}

vec3 palette3(float t) {
  t = clamp(t, 0.0, 1.0);
  return (t < 0.5)
    ? mix(uPalette0, uPalette1, t * 2.0)
    : mix(uPalette1, uPalette2, (t - 0.5) * 2.0);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5) / uResolution;
  uv = clamp(uv, 0.0, 1.0);

  vec2 grid = uv * (uFieldSize - 1.0);
  vec2 cell = floor(grid);
  cell = min(cell, uFieldSize - 2.0);
  vec2 local = grid - cell; // 0..1 within cell

  vec2 c00 = cell;
  vec2 c10 = cell + vec2(1.0, 0.0);
  vec2 c01 = cell + vec2(0.0, 1.0);
  vec2 c11 = cell + vec2(1.0, 1.0);

  // Corner samples (bottom-left origin)
  float SW = sampleField(c00);
  float SE = sampleField(c10);
  float NW = sampleField(c01);
  float NE = sampleField(c11);

  float bSW = SW > uThreshold ? 1.0 : 0.0;
  float bSE = SE > uThreshold ? 1.0 : 0.0;
  float bNE = NE > uThreshold ? 1.0 : 0.0;
  float bNW = NW > uThreshold ? 1.0 : 0.0;

  int cellType = int(bSW + bSE * 2.0 + bNE * 4.0 + bNW * 8.0 + 0.5);

  // Edge intersections (0..1)
  float N = (bNW == bNE) ? 0.5 : lerpEdge(NW, NE, uThreshold);
  float S = (bSW == bSE) ? 0.5 : lerpEdge(SW, SE, uThreshold);
  float W = (bSW == bNW) ? 0.5 : lerpEdge(SW, NW, uThreshold);
  float E = (bSE == bNE) ? 0.5 : lerpEdge(SE, NE, uThreshold);

  vec2 pN = vec2(N, 1.0);
  vec2 pS = vec2(S, 0.0);
  vec2 pW = vec2(0.0, W);
  vec2 pE = vec2(1.0, E);

  // Bilinear field for fill (gives a smooth, stable surface).
  float v0 = mix(SW, SE, local.x);
  float v1 = mix(NW, NE, local.x);
  float v = mix(v0, v1, local.y);
  float vCenter = (SW + SE + NW + NE) * 0.25;

  float iso = uThreshold;
  float softness = max(1e-6, uSoftness);
  float inside = smoothstep(iso - softness, iso + softness, v);

  // Simple shading from bilinear gradient (fake "3D" look).
  float dvdx = mix(SE - SW, NE - NW, local.y);
  float dvdy = mix(NW - SW, NE - SE, local.x);
  vec3 n = normalize(vec3(-dvdx, -dvdy, 1.0));
  vec3 l = normalize(vec3(0.35, 0.55, 1.0));
  float lit = clamp(dot(n, l), 0.0, 1.0);

  vec3 bg = (uUsePaletteBg ? uPalette0 : uBgColor);

  // Normalize field intensity relative to threshold for palette mapping.
  float t = clamp((v - iso) / max(iso, 1e-6), 0.0, 1.0);
  float tShaped = sqrt(t); // emphasize lower values for a "biolab" feel

  float spec = pow(clamp(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 32.0);

  vec3 baseSingle = uBlobColor * (0.52 + 0.48 * lit) + vec3(1.0) * spec * 0.25;
  vec3 basePalette = palette3(0.10 + 0.90 * tShaped) * (0.55 + 0.45 * lit) + vec3(1.0) * spec * 0.22;
  vec3 base = (uColorMode == 0) ? baseSingle : basePalette;

  vec3 col = mix(bg, base, inside);

  // Marching squares contour overlay (line segments per cell).
  if (uShowContours && cellType != 0 && cellType != 15) {
    vec2 cellSizePx = uResolution / (uFieldSize - 1.0);
    float wLocal = uLineWidthPx / max(1.0, min(cellSizePx.x, cellSizePx.y));
    float line = 0.0;

    // Mapping from Jamie Wong's blog post (cell-type-to-poly-corners.js).
    if (cellType == 1)      line = drawSegment(local, pW, pS, wLocal);
    else if (cellType == 2) line = drawSegment(local, pE, pS, wLocal);
    else if (cellType == 3) line = drawSegment(local, pW, pE, wLocal);
    else if (cellType == 4) line = drawSegment(local, pN, pE, wLocal);
    else if (cellType == 5) {
      if (vCenter > uThreshold) line = max(drawSegment(local, pN, pW, wLocal), drawSegment(local, pS, pE, wLocal));
      else line = max(drawSegment(local, pN, pE, wLocal), drawSegment(local, pS, pW, wLocal));
    }
    else if (cellType == 6) line = drawSegment(local, pN, pS, wLocal);
    else if (cellType == 7) line = drawSegment(local, pN, pW, wLocal);
    else if (cellType == 8) line = drawSegment(local, pN, pW, wLocal);
    else if (cellType == 9) line = drawSegment(local, pN, pS, wLocal);
    else if (cellType == 10) {
      if (vCenter > uThreshold) line = max(drawSegment(local, pN, pE, wLocal), drawSegment(local, pS, pW, wLocal));
      else line = max(drawSegment(local, pN, pW, wLocal), drawSegment(local, pS, pE, wLocal));
    }
    else if (cellType == 11) line = drawSegment(local, pN, pE, wLocal);
    else if (cellType == 12) line = drawSegment(local, pE, pW, wLocal);
    else if (cellType == 13) line = drawSegment(local, pE, pS, wLocal);
    else if (cellType == 14) line = drawSegment(local, pS, pW, wLocal);

    vec3 lineCol = mix((uColorMode == 0 ? uBlobColor : uPalette2), vec3(1.0), 0.35);
    col = mix(col, lineCol, line);
  }

  // Subtle outer glow.
  float glow = smoothstep(iso - softness * 6.0, iso - softness * 0.5, v) - smoothstep(iso - softness * 0.5, iso + softness, v);
  vec3 glowCol = (uColorMode == 0) ? uBlobColor : uPalette2;
  col += glowCol * glow * 0.35;

  gl_FragColor = vec4(col, 1.0);
}
`

export const BLOOM_MASK_FRAGMENT = `
precision highp float;

uniform sampler2D uField;
uniform vec2 uResolution;
uniform vec2 uFieldSize;
uniform float uThreshold;
uniform float uSoftness;
uniform vec3 uPalette0;
uniform vec3 uPalette1;
uniform vec3 uPalette2;
uniform int uColorMode; // 0=single, 1=palette
uniform vec3 uBlobColor;

float sampleField(vec2 ij) {
  vec2 uv = (ij + 0.5) / uFieldSize;
  return texture2D(uField, uv).r;
}

vec3 palette3(float t) {
  t = clamp(t, 0.0, 1.0);
  return (t < 0.5)
    ? mix(uPalette0, uPalette1, t * 2.0)
    : mix(uPalette1, uPalette2, (t - 0.5) * 2.0);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5) / uResolution;
  uv = clamp(uv, 0.0, 1.0);

  vec2 grid = uv * (uFieldSize - 1.0);
  vec2 cell = floor(grid);
  cell = min(cell, uFieldSize - 2.0);
  vec2 local = grid - cell; // 0..1 within cell

  vec2 c00 = cell;
  vec2 c10 = cell + vec2(1.0, 0.0);
  vec2 c01 = cell + vec2(0.0, 1.0);
  vec2 c11 = cell + vec2(1.0, 1.0);

  float SW = sampleField(c00);
  float SE = sampleField(c10);
  float NW = sampleField(c01);
  float NE = sampleField(c11);

  float v0 = mix(SW, SE, local.x);
  float v1 = mix(NW, NE, local.x);
  float v = mix(v0, v1, local.y);

  float iso = uThreshold;
  float softness = max(1e-6, uSoftness);
  float inside = smoothstep(iso - softness, iso + softness, v);

  float dvdx = mix(SE - SW, NE - NW, local.y);
  float dvdy = mix(NW - SW, NE - SE, local.x);
  vec3 n = normalize(vec3(-dvdx, -dvdy, 1.0));
  vec3 l = normalize(vec3(0.35, 0.55, 1.0));
  float lit = clamp(dot(n, l), 0.0, 1.0);

  float t = clamp((v - iso) / max(iso, 1e-6), 0.0, 1.0);
  float tShaped = sqrt(t);

  // Bright core + halo so bloom feels like a light source on the blob.
  float core = inside * (0.35 + 0.65 * lit);
  float halo = smoothstep(iso - softness * 8.0, iso - softness * 0.75, v) - smoothstep(iso - softness * 0.75, iso + softness, v);
  float mask = clamp(core * 0.85 + halo * 1.25, 0.0, 1.0);

  vec3 glowCol = (uColorMode == 0) ? uBlobColor : palette3(0.85);
  gl_FragColor = vec4(glowCol * mask, 1.0);
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

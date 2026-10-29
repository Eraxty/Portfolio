import * as THREE from 'three';

// Aperture wall panels: square tiles with hairline seams, a faint per-panel tone and travelling light strips.
export function panelMaterial({ tile = 1.4, base = '#0c0c0e', seam = '#1d1d21', floor = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTile: { value: tile },
      uBase: { value: new THREE.Color(base).convertLinearToSRGB() },
      uSeam: { value: new THREE.Color(seam).convertLinearToSRGB() },
      uTime: { value: 0 },
      uFloor: { value: floor ? 1 : 0 },
      uFogNear: { value: 6 },
      uFogFar: { value: 26 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying float vDepth;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vec4 mv = viewMatrix * w;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTile, uTime, uFloor, uFogNear, uFogFar;
      uniform vec3 uBase, uSeam;
      varying vec3 vWorld;
      varying float vDepth;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 p = mix(vWorld.xy, vWorld.xz, uFloor);
        vec2 g = p / uTile;
        vec2 cell = floor(g);
        vec2 f = fract(g);
        float seam = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
        float line = 1.0 - smoothstep(0.0, fwidth(seam) * 1.5 + 0.004, seam);
        float tone = hash(cell) * 0.018;
        vec3 col = uBase + tone;
        col = mix(col, uSeam, line);
        // the odd lit panel, breathing slowly
        float lit = step(0.985, hash(cell + 7.3));
        col += lit * vec3(0.05, 0.05, 0.055) * (0.6 + 0.4 * sin(uTime * 0.7 + hash(cell) * 6.28));
        float fog = smoothstep(uFogNear, uFogFar, vDepth);
        col = mix(col, vec3(0.039, 0.039, 0.043), fog);
        // authored in sRGB, the pipeline expects linear
        gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
      }`,
  });
}

// A Portal portal: a ragged glowing ellipse rim with a swirling interior. uOpen grows it, uFill solidifies the inside.
export function portalMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uOpen: { value: 0 },
      uFill: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime, uOpen, uFill;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float size = max(uOpen, 0.0001);
        float edgeNoise = noise(vec2(a * 4.0, uTime * 1.4)) * 0.045 + noise(vec2(a * 11.0, -uTime * 2.6)) * 0.02;
        float rr = r / size + edgeNoise;
        float aa = fwidth(rr) * 1.5;
        // a crisp hot rim, a thin outer glow and a dark, slowly turning inside
        float rim = smoothstep(0.86 - aa, 0.9, rr) * (1.0 - smoothstep(0.97, 0.97 + aa + 0.01, rr));
        float halo = exp(-max(rr - 0.97, 0.0) * 22.0) * step(0.97, rr) * 0.35;
        float inside = 1.0 - smoothstep(0.86, 0.9, rr);
        float swirl = noise(vec2(a * 3.0 + rr * 6.0 - uTime * 1.2, rr * 4.0 + uTime * 0.5));
        // when filling: a tunnel of radial streaks rushing outward
        float streak = noise(vec2(a * 18.0, rr * 2.0 - uTime * 6.0));
        streak = smoothstep(0.55, 0.95, streak) * smoothstep(0.0, 0.8, rr);
        vec3 deep = uColor * (0.05 + swirl * 0.22);
        vec3 filled = uColor * (0.55 + swirl * 0.35) + vec3(1.0) * streak * 0.35;
        vec3 col = uColor * rim * 3.2 + uColor * halo;
        col += mix(deep, filled, uFill) * inside;
        float alpha = clamp(rim + halo + inside * mix(0.92, 1.0, uFill), 0.0, 1.0);
        alpha *= smoothstep(0.0, 0.06, uOpen);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
}

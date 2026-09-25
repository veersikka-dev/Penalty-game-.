import * as THREE from 'three';

/**
 * Stylised glass: fresnel rim, glowing bevelled edges, fake reflection streaks
 * and a procedural radial crack pattern driven by uCrack/uCrackCenter.
 * One instance per pooled glass object so each can crack independently.
 */
export function createGlassMaterial(color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: 0.28 },
        uCrackCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uCrack: { value: 0 },
        uDamage: { value: 0 },
        uFlash: { value: 0 },
        uSize: { value: new THREE.Vector2(4, 3) },
        uTime: { value: 0 },
        uEdge: { value: 2.4 },
      },
    ]),
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity, uCrack, uDamage, uFlash, uTime, uEdge;
      uniform vec2 uCrackCenter, uSize;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      #include <fog_pars_fragment>
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        vec3 n = normalize(vNormalW);
        float fres = pow(1.0 - abs(dot(n, normalize(vViewDir))), 2.5);
        vec2 e = min(vUv, 1.0 - vUv) * uSize;
        float edgeD = min(e.x, e.y);
        float edge = 1.0 - smoothstep(0.0, 0.07, edgeD);
        float inner = (1.0 - smoothstep(0.1, 0.16, edgeD)) * smoothstep(0.07, 0.1, edgeD);
        // diagonal reflection streaks that drift slightly
        float s = (vUv.x * uSize.x + vUv.y * uSize.y) * 0.35 + uTime * 0.05;
        float streak = smoothstep(0.08, 0.0, abs(fract(s) - 0.5) - 0.12) * 0.25;
        vec3 col = uColor * (0.18 + fres * 1.3) + vec3(streak) * uColor;
        float alpha = uOpacity * (0.45 + fres * 0.9) + streak * 0.2;

        // Radial cracks around the latest impact
        float crack = 0.0;
        if (uCrack > 0.001) {
          vec2 d = (vUv - uCrackCenter) * uSize;
          float r = length(d);
          float a = atan(d.y, d.x);
          float spokes = 9.0 + uDamage * 5.0;
          float sector = (a / 6.2831853 + 0.5) * spokes;
          float id = floor(sector);
          float f = fract(sector) - 0.5 - (hash(id) - 0.5) * 0.5;
          float jag = sin(r * 9.0 + id * 3.0) * 0.06;
          float dist = abs(sin((f + jag) * 6.2831853 / spokes)) * r;
          float len = uCrack * (1.2 + hash(id + 7.0) * 2.4) * max(uSize.x, uSize.y) * 0.5;
          crack = smoothstep(0.035, 0.0, dist) * step(r, len);
          float ring1 = smoothstep(0.03, 0.0, abs(r - 0.35 * uCrack - 0.04 * sin(a * 11.0)));
          float ring2 = smoothstep(0.03, 0.0, abs(r - 0.8 * uCrack - 0.06 * sin(a * 7.0 + 1.0))) * step(0.3, uDamage);
          crack = max(crack, max(ring1, ring2) * step(0.05, uCrack));
          crack = max(crack, smoothstep(0.12, 0.0, r) * uCrack);
        }
        col += vec3(0.85, 0.95, 1.0) * crack * 2.2;
        alpha += crack * 0.7;
        col += uColor * edge * uEdge + uColor * inner * 0.5;
        alpha += edge * 0.7 + inner * 0.15;
        col += vec3(uFlash) * 1.5;
        alpha = clamp(alpha + uFlash * 0.4, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    fog: true,
    side: THREE.FrontSide,
  });
}

/** Scrolling energy surface used for the Core tunnel and the boss. */
export function createEnergyMaterial(colorA: number, colorB: number, opts: { side?: THREE.Side; scale?: number; intensity?: number } = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uA: { value: new THREE.Color(colorA) },
        uB: { value: new THREE.Color(colorB) },
        uScale: { value: opts.scale ?? 1 },
        uIntensity: { value: opts.intensity ?? 1 },
        uCrack: { value: 0 },
      },
    ]),
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uScale, uIntensity, uCrack;
      uniform vec3 uA, uB;
      varying vec3 vPos;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec3 p = vPos * uScale;
        float ang = atan(p.y - 2.5 * uScale, p.x);
        vec2 q = vec2(ang * 3.0, p.z * 0.25 + uTime * 1.6);
        float n = noise(q * 2.0) * 0.6 + noise(q * 5.0 + uTime * 0.3) * 0.4;
        float bands = smoothstep(0.92, 1.0, fract(p.z * 0.12 + uTime * 0.9)) * 1.5;
        float lines = smoothstep(0.994, 1.0, abs(sin(ang * 6.0))) * 0.6;
        float fres = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), 2.0);
        vec3 col = mix(uA, uB, n) * (0.03 + pow(n, 4.0) * 0.9 + bands * 0.8 + lines * 0.7 + fres * 0.25);
        col += vec3(1.0, 0.9, 0.8) * uCrack * smoothstep(0.7, 0.72, n) * 3.0;
        gl_FragColor = vec4(col * uIntensity, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
    side: opts.side ?? THREE.FrontSide,
  });
}

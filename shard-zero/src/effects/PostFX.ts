import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { QualityProfile } from '../core/Settings';

/**
 * Final composite: radial speed blur, chromatic aberration, speed lines,
 * vignette, desaturation, flash, damage tint and film grain. Runs in linear HDR
 * before the OutputPass applies tone mapping.
 */
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uVignette: { value: 0.55 },
    uCA: { value: 0.0 },
    uSpeed: { value: 0.0 },
    uLines: { value: 0.0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uFlash: { value: 0 },
    uDamage: { value: 0 },
    uDesat: { value: 0 },
    uGrain: { value: 0.035 },
    uTint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uAspect, uVignette, uCA, uSpeed, uLines, uFlash, uDamage, uDesat, uGrain;
    uniform vec3 uFlashColor, uTint;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r = length(c * vec2(uAspect, 1.0));
      vec3 col;
      if (uSpeed > 0.001) {
        vec3 acc = vec3(0.0);
        for (int i = 0; i < 6; i++) {
          float f = float(i) / 5.0;
          acc += texture2D(tDiffuse, 0.5 + c * (1.0 - f * uSpeed * 0.035 * r)).rgb;
        }
        col = acc / 6.0;
      } else {
        col = texture2D(tDiffuse, vUv).rgb;
      }
      if (uCA > 0.0001) {
        vec2 off = c * uCA * (0.3 + r * 1.4) * 0.02;
        col.r = texture2D(tDiffuse, vUv + off).r;
        col.b = texture2D(tDiffuse, vUv - off).b;
      }
      // Speed lines streaking from the edges
      if (uLines > 0.001) {
        float ang = atan(c.y, c.x);
        float id = floor((ang + 3.14159) * 260.0);
        float h = hash(vec2(id, floor(uTime * 9.0 + hash(vec2(id, 3.0)) * 9.0)));
        float streak = step(0.975, h) * smoothstep(0.32, 0.8, r);
        col += vec3(0.7, 0.85, 1.0) * streak * uLines * 0.22;
      }
      col *= uTint;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(l) * vec3(0.85, 0.92, 1.1), uDesat);
      col += vec3(0.9, 0.05, 0.12) * uDamage * smoothstep(0.25, 0.85, r);
      col *= 1.0 - uVignette * smoothstep(0.3, 0.95, r);
      col = mix(col, uFlashColor * 1.5, clamp(uFlash, 0.0, 1.0));
      col += (hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 100.0) - 0.5) * uGrain;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export type FinalUniforms = typeof FinalShader.uniforms;

export class PostFX {
  composer: EffectComposer | null = null;
  bloom: UnrealBloomPass | null = null;
  final: ShaderPass | null = null;
  uniforms: FinalUniforms;
  private width = 1;
  private height = 1;
  private msaa = -1;

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    this.uniforms = THREE.UniformsUtils.clone(FinalShader.uniforms) as FinalUniforms;
  }

  /** (Re)builds the composer for a quality profile. Returns false if post-processing is unavailable. */
  configure(profile: QualityProfile, bloom: { strength: number; radius: number; threshold: number }): boolean {
    try {
      if (!this.composer || this.msaa !== profile.msaa) {
        this.composer?.dispose();
        const rt = new THREE.WebGLRenderTarget(this.width, this.height, { type: THREE.HalfFloatType, samples: profile.msaa });
        const composer = new EffectComposer(this.renderer, rt);
        composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), bloom.strength, bloom.radius, bloom.threshold);
        composer.addPass(this.bloom);
        this.final = new ShaderPass({ ...FinalShader, uniforms: this.uniforms });
        composer.addPass(this.final);
        composer.addPass(new OutputPass());
        this.composer = composer;
        this.msaa = profile.msaa;
      }
      this.bloom!.enabled = profile.bloom;
      this.setBloom(bloom);
      this.uniforms.uGrain.value = profile.post ? 0.018 : 0;
      this.setSize(this.width, this.height, profile.bloomScale);
      return true;
    } catch (err) {
      console.warn('[SHARD//ZERO] Post-processing unavailable; rendering directly.', err);
      this.composer = null;
      return false;
    }
  }

  setBloom(b: { strength: number; radius: number; threshold: number }) {
    if (!this.bloom) return;
    this.bloom.strength = b.strength;
    this.bloom.radius = b.radius;
    this.bloom.threshold = b.threshold;
  }

  setSize(w: number, h: number, bloomScale = 1) {
    this.width = w;
    this.height = h;
    this.uniforms.uAspect.value = w / Math.max(1, h);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
      this.bloom?.setSize(Math.floor(w * bloomScale * this.renderer.getPixelRatio()), Math.floor(h * bloomScale * this.renderer.getPixelRatio()));
    }
  }

  render(dt: number) {
    this.uniforms.uTime.value += dt;
    if (this.composer) {
      this.composer.render(dt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

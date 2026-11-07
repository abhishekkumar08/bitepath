import * as THREE from 'three';
import type { GradientStop, HaloOptions, RimOptions } from '@/scene/lens/types';

const FACING = 'float facing = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));';

export function gradientTexture(stops: readonly GradientStop[]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  if (g) {
    const fill = g.createLinearGradient(0, 0, 0, 256);
    for (const [at, color] of stops) fill.addColorStop(at, color);
    g.fillStyle = fill;
    g.fillRect(0, 0, 4, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function rimMaterial(opts: RimOptions): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: opts.color,
    roughness: opts.roughness,
    transparent: true,
    opacity: opts.opacity,
    depthWrite: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: new THREE.Color(opts.rimColor) };
    shader.uniforms.rimGlow = { value: opts.glow };
    shader.uniforms.rimAlpha = { value: opts.rimAlpha };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 rimColor;\nuniform float rimGlow;\nuniform float rimAlpha;\nvoid main() {')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n${FACING}\nfloat rim = facing * facing;\ntotalEmissiveRadiance += rimColor * (0.2 + rim) * rimGlow;\ndiffuseColor.a = mix(diffuseColor.a, rimAlpha, rim);`,
      );
  };
  return material;
}

export function haloMaterial(opts: HaloOptions): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.3,
    transparent: opts.transparent ?? false,
    ...(opts.color === undefined ? {} : { color: opts.color, emissive: opts.color, emissiveIntensity: opts.emissiveIntensity ?? 0 }),
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.haloGlow = { value: opts.halo };
    shader.uniforms.vertexGlow = { value: opts.vertexGlow ?? 0 };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float haloGlow;\nuniform float vertexGlow;\nvoid main() {')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n${FACING}\ntotalEmissiveRadiance += vec3(facing * facing * facing * haloGlow);\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor.rgb * vertexGlow;\n#endif`,
      );
  };
  return material;
}

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createOrganGlow } from '@/scene/beats/flowView';
import type { OrganId } from '@/models/types';
import type { LoadedBody } from '@/scene/types';

function bodyWith(id: OrganId, emissive: number, intensity: number): { body: LoadedBody; material: THREE.MeshPhysicalMaterial } {
  const material = new THREE.MeshPhysicalMaterial({ emissive, emissiveIntensity: intensity });
  const organ = new THREE.Group();
  organ.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  return { body: { organs: { [id]: organ } } as unknown as LoadedBody, material };
}

describe('createOrganGlow', () => {
  it('restores a non-star organ to its own nonzero rest colour and intensity', () => {
    const { body, material } = bodyWith('pancreas', 0x224466, 0.35);
    const glow = createOrganGlow(body, 'pancreas');
    glow.set(0xff0000, 1.2);
    expect(material.emissive.getHex()).toBe(0xff0000);
    expect(material.emissiveIntensity).toBe(1.2);
    glow.restore();
    expect(material.emissive.getHex()).toBe(0x224466);
    expect(material.emissiveIntensity).toBe(0.35);
  });

  it('restores a star organ to dark, whatever the star pass left on it', () => {
    const { body, material } = bodyWith('heart', 0x884400, 0.9);
    const glow = createOrganGlow(body, 'heart');
    glow.set(0x00ff00, 0.5);
    glow.restore();
    expect(material.emissive.getHex()).toBe(0);
    expect(material.emissiveIntensity).toBe(0);
  });
});
